from __future__ import annotations

import io
from datetime import datetime

import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse

from models.schema import AuditMetadata, ProcessResponse, TablePageResponse
from services import db
from services.config_store import get_custom_columns, get_mappings
from services.processing import _rows_from_df, _scale_power_columns, process_bytes
from services.session_store import session_store
from services.table_query import (
    apply_table_filters,
    parse_column_filters_json,
    sort_frame,
)
from parsers.preprocess import prepare_tabular_export

router = APIRouter(tags=["upload"])

MAX_TABLE_PAGE = 500


# ── Helpers for normalized Excel download ──────────────────────────────────────

def _try_parse_html_or_csv(raw: bytes) -> tuple[pd.DataFrame, str] | None:
    try:
        text = raw.decode("utf-8-sig", errors="replace")
    except Exception:
        return None

    # Check if it looks like HTML table
    if "<table" in text.lower() and "</table" in text.lower():
        try:
            from html.parser import HTMLParser
            class SimpleHTMLTableParser(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.tables = []
                    self.current_table = []
                    self.current_row = []
                    self.current_cell = []
                    self.in_cell = False

                def handle_starttag(self, tag, attrs):
                    if tag in ("td", "th"):
                        self.in_cell = True
                        self.current_cell = []
                    elif tag == "tr":
                        self.current_row = []

                def handle_endtag(self, tag):
                    if tag in ("td", "th"):
                        self.in_cell = False
                        self.current_row.append("".join(self.current_cell).strip())
                    elif tag == "tr":
                        if self.current_row:
                            self.current_table.append(self.current_row)
                    elif tag == "table":
                        if self.current_table:
                            self.tables.append(self.current_table)
                            self.current_table = []

                def handle_data(self, data):
                    if self.in_cell:
                        self.current_cell.append(data)

            parser = SimpleHTMLTableParser()
            parser.feed(text)
            if parser.tables and len(parser.tables[0]) > 0:
                table = parser.tables[0]
                width = max(len(r) for r in table)
                padded = [r + [""] * (width - len(r)) for r in table]
                return pd.DataFrame(padded), "Sheet1"
        except Exception:
            pass

    # Check if it's a CSV
    try:
        import csv as _csv
        reader = _csv.reader(io.StringIO(text))
        rows = [r for r in reader if any(c.strip() for c in r)]
        if rows:
            width = max(len(r) for r in rows)
            padded = [r + [""] * (width - len(r)) for r in rows]
            return pd.DataFrame(padded), "CSV"
    except Exception:
        pass

    return None


def _read_all_pages_for_mapping(filename: str, raw: bytes) -> list[dict]:
    """Return a list of page dicts with sheet name and dataframe.

    Similar to config.py's _read_all_pages but used for data processing.
    """
    name = filename.lower()
    pages: list[dict] = []

    if name.endswith(".csv"):
        text = raw.decode("utf-8-sig", errors="replace")
        import csv as _csv
        reader = _csv.reader(io.StringIO(text))
        rows = [r for r in reader if any(c.strip() for c in r)]
        if not rows:
            return pages
        width = max(len(r) for r in rows)
        padded = [r + [""] * (width - len(r)) for r in rows]
        raw_df = pd.DataFrame(padded)
        processed = prepare_tabular_export(raw_df)
        if not processed.empty:
            pages.append({"sheet_name": "CSV", "df": processed})
        return pages

    if name.endswith((".xlsx", ".xls", ".xlsb", ".xlsm")):
        # Robust engine selection with fallback chain (legacy .xls + xlrd,
        # modern .xlsx + calamine, mis-extensioned files all handled).
        from utils.excel_open import open_excel
        try:
            xls, engine = open_excel(filename, raw)
            for sheet in xls.sheet_names:
                try:
                    raw_df = pd.read_excel(xls, sheet_name=sheet, header=None, engine=engine)
                    processed = prepare_tabular_export(raw_df)
                    if not processed.empty and len(processed.columns) >= 2:
                        pages.append({"sheet_name": str(sheet), "df": processed})
                except Exception:
                    continue
        except Exception as exc:
            # Fallback for fake .xls files (e.g. HTML tables or CSV named as .xls)
            fallback_res = _try_parse_html_or_csv(raw)
            if fallback_res:
                raw_df, sheet_name = fallback_res
                processed = prepare_tabular_export(raw_df)
                if not processed.empty and len(processed.columns) >= 2:
                    pages.append({"sheet_name": sheet_name, "df": processed})
                    return pages
            raise exc

    return pages


def _normalize_name(name: str) -> str:
    import re
    import unicodedata
    if not name:
        return ""
    s = unicodedata.normalize('NFKC', str(name)).strip().lower()
    s = re.sub(r"[\s\-_/]+", "", s)
    return s


# Match sampling-interval tokens in a PQ-analyzer sheet name so the same
# saved mapping works for a 5-second, 1-minute, 10-minute, hourly, daily file.
# Examples it strips:  "5 s", "1 min", "10 mins", "1 minute", "2 hours", "30 sec".
_INTERVAL_RE = __import__("re").compile(
    r"\b\d+\s*(?:ms|millis|millisecond|milliseconds|"
    r"s|sec|secs|second|seconds|"
    r"min|mins|minute|minutes|"
    r"h|hr|hrs|hour|hours|"
    r"d|day|days)\b",
    __import__("re").IGNORECASE,
)


def _normalize_sheet_name(name: str) -> str:
    """Normalize a sheet-name for fuzzy matching against saved mappings.

    Beyond standard whitespace/casing fixes, this strips sampling-interval
    tokens (e.g. "5 s", "1 min") so that a mapping saved against
    "Trend 5 s U h f" still resolves correctly when the same vendor exports
    the same kind of sheet at a different rate, e.g. "Trend 1 min U h f".
    """
    import re
    import unicodedata
    if not name:
        return ""
    s = unicodedata.normalize('NFKC', str(name)).strip().lower()
    # Strip interval tokens BEFORE collapsing whitespace so the regex's `\b`
    # anchors still see the surrounding boundaries.
    s = _INTERVAL_RE.sub("", s)
    s = re.sub(r"[\s\-_/]+", "", s)
    return s


def _apply_mappings_to_dataframe(
    pages: list[dict],
    mappings: dict[str, str],
    source_pages: dict[str, str] | None = None,
    custom_cols: list[dict] | None = None,
) -> pd.DataFrame:
    """
    Apply saved mappings to extract only mapped columns from the data.

    Args:
        pages: List of dicts with "sheet_name" and "df" keys
        mappings: Dict mapping raw_column_name -> standard_column_name or
                  {"standard_column": str, "source_page": str}
        source_pages: Optional dict mapping raw_column_name -> preferred sheet_name
                      (for columns from the main table)
        custom_cols: Optional list of custom column entries
                     [{"name": raw_col, "sheet": sheet_name, "mapTo": standard_col}, ...]
                     Used when the SAME raw column name appears on multiple sheets
                     with different meanings — each one maps to a DIFFERENT standard column.

    Returns:
        DataFrame with only mapped columns, renamed to standard names
    """
    if not pages or (not mappings and not custom_cols):
        raise ValueError("No pages or mappings provided")

    source_pages = source_pages or {}

    # Normalize mappings keys
    norm_mappings = {}
    for raw_name, val in mappings.items():
        norm_mappings[_normalize_name(raw_name)] = val

    # Normalize source_pages keys
    norm_source_pages = {}
    for raw_name, val in source_pages.items():
        norm_source_pages[_normalize_name(raw_name)] = val

    # Create a lookup of normalized_raw_column -> (standard_col, original_raw_col, sheet_name)
    # Prefer the user-specified source_page over the first matching sheet
    col_to_source: dict[str, tuple[str, str, str]] = {}

    for page in pages:
        sheet_name = page["sheet_name"]
        norm_sheet = _normalize_sheet_name(sheet_name)
        df = page["df"]
        for col in df.columns:
            raw_col_orig = str(col)
            norm_col = _normalize_name(raw_col_orig)
            if norm_col not in norm_mappings:
                continue

            mapping_val = norm_mappings[norm_col]
            # Handle both flat string and {standard_column, source_page} dict
            if isinstance(mapping_val, dict):
                standard_col = mapping_val.get("standard_column", "")
                embedded_page = mapping_val.get("source_page")
            else:
                standard_col = str(mapping_val)
                embedded_page = None

            if not standard_col or standard_col == "NA":
                continue

            # Preferred sheet: explicit source_pages arg > embedded source_page in mapping
            preferred_sheet = norm_source_pages.get(norm_col) or embedded_page
            norm_preferred_sheet = _normalize_sheet_name(preferred_sheet) if preferred_sheet else None

            if norm_preferred_sheet:
                if norm_preferred_sheet == norm_sheet:
                    # This IS the preferred sheet — always win
                    col_to_source[norm_col] = (standard_col, raw_col_orig, sheet_name)
                elif norm_col not in col_to_source:
                    # Not the preferred sheet but nothing recorded yet — use as fallback
                    col_to_source[norm_col] = (standard_col, raw_col_orig, sheet_name)
            elif norm_col not in col_to_source:
                # No preference — use first sheet found
                col_to_source[norm_col] = (standard_col, raw_col_orig, sheet_name)

    # Build a quick lookup so we don't loop pages × columns
    sheet_lookup: dict[str, pd.DataFrame] = {p["sheet_name"]: p["df"] for p in pages}
    norm_sheet_lookup: dict[str, pd.DataFrame] = {
        _normalize_sheet_name(p["sheet_name"]): p["df"] for p in pages
    }

    # Collect Series directly — no `.tolist()` conversion (was the main bottleneck
    # on large files: turned a 1M-row column into 1M Python objects per column).
    result_series: dict[str, pd.Series] = {}

    for norm_col, (standard_col, raw_col_orig, sheet_name) in col_to_source.items():
        source_df = sheet_lookup.get(sheet_name)
        if source_df is None or raw_col_orig not in source_df.columns:
            continue
        col_data = source_df[raw_col_orig]
        if isinstance(col_data, pd.DataFrame):
            col_data = col_data.iloc[:, 0]
        result_series[standard_col] = col_data.reset_index(drop=True)

    # ── Custom columns: same raw column name on different sheet → different std column
    for cc in (custom_cols or []):
        raw_name = (cc.get("name") or "").strip()
        sheet = (cc.get("sheet") or "").strip()
        map_to = (cc.get("mapTo") or "").strip()
        if not raw_name or not sheet or not map_to or map_to == "NA":
            continue
        if map_to in result_series:
            # Same standard column already filled by main mapping — skip duplicate
            continue

        norm_raw_name = _normalize_name(raw_name)
        norm_sheet = _normalize_sheet_name(sheet)

        source_df = norm_sheet_lookup.get(norm_sheet)
        if source_df is None:
            continue

        # Find matching column in sheet (normalized)
        matched_col = None
        for col in source_df.columns:
            if _normalize_name(col) == norm_raw_name:
                matched_col = col
                break

        if matched_col is None:
            continue

        col_data = source_df[matched_col]
        if isinstance(col_data, pd.DataFrame):
            col_data = col_data.iloc[:, 0]
        result_series[map_to] = col_data.reset_index(drop=True)

    if not result_series:
        raise ValueError("No mapped columns found in data")

    # pd.concat handles ragged column lengths via NaN padding internally — way
    # faster than building Python lists and appending None in a loop.
    output_df = pd.concat(result_series, axis=1)

    # Convert numeric columns — skip known text/datetime columns
    _TEXT_COLS = {"timestamp", "date", "time"}
    for col in output_df.columns:
        if col.lower() in _TEXT_COLS:
            continue
        try:
            converted = pd.to_numeric(output_df[col], errors="coerce")
            # Only replace if at least some values converted successfully (avoid wiping text cols)
            if converted.notna().any():
                output_df[col] = converted
        except Exception:
            pass

    # ── Normalize date / time columns that may arrive as Excel serial numbers ───
    # Excel stores dates as days-since-1899-12-30 (floats like 45832.0)
    # and times as fractions of a day (0.0 = midnight, 0.5 = noon).
    # Convert these to proper strings so the frontend can display them.
    output_df = _normalize_date_time_cols(output_df)

    return output_df


def _normalize_date_time_cols(df: pd.DataFrame) -> pd.DataFrame:
    """Convert Excel-serial date/time columns to human-readable strings."""
    import math

    for col in df.columns:
        col_lower = col.lower()
        if col_lower not in ("date", "time", "timestamp"):
            continue

        series = df[col]

        # Already proper strings? Check the first non-null value.
        first_val = next((v for v in series if v is not None), None)
        if first_val is None:
            continue

        # If it's already a non-numeric string, leave it.
        if isinstance(first_val, str):
            # Try to detect Excel-style date serial encoded as a string ("45832.0")
            try:
                float(first_val)
            except (ValueError, TypeError):
                continue  # looks like a real date string — skip

        # Values are numeric (float/int) or numeric-strings
        try:
            numeric = pd.to_numeric(series, errors="coerce")
        except Exception:
            continue

        valid_pct = numeric.notna().sum() / max(len(numeric), 1)
        if valid_pct < 0.5:
            continue  # not mostly numeric, skip

        if col_lower == "date":
            # Excel date serial → "YYYY-MM-DD"
            EXCEL_EPOCH = pd.Timestamp("1899-12-30")
            def _serial_to_date(v: float) -> str | None:
                if v is None or (isinstance(v, float) and math.isnan(v)):
                    return None
                try:
                    return (EXCEL_EPOCH + pd.Timedelta(days=float(v))).strftime("%Y-%m-%d")
                except Exception:
                    return str(v)
            df[col] = numeric.apply(_serial_to_date)

        elif col_lower == "time":
            # Excel time fraction → "HH:MM:SS"
            def _frac_to_time(v: float) -> str | None:
                if v is None or (isinstance(v, float) and math.isnan(v)):
                    return None
                try:
                    total_sec = round(float(v) * 86400)
                    h, rem = divmod(total_sec, 3600)
                    m, s = divmod(rem, 60)
                    return f"{int(h):02d}:{int(m):02d}:{int(s):02d}"
                except Exception:
                    return str(v)
            df[col] = numeric.apply(_frac_to_time)

        elif col_lower == "timestamp":
            # Could be a combined serial (date + time fraction); convert to ISO string
            EXCEL_EPOCH = pd.Timestamp("1899-12-30")
            def _serial_to_ts(v: float) -> str | None:
                if v is None or (isinstance(v, float) and math.isnan(v)):
                    return None
                try:
                    return (EXCEL_EPOCH + pd.Timedelta(days=float(v))).strftime("%Y-%m-%d %H:%M:%S")
                except Exception:
                    return str(v)
            df[col] = numeric.apply(_serial_to_ts)

    return df


@router.post("/process", response_model=ProcessResponse)
async def process_upload(
    file: UploadFile = File(...),
    metadata: str = Form(...),
) -> ProcessResponse:
    try:
        meta = AuditMetadata.model_validate_json(metadata)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=422, detail=f"Invalid metadata: {exc}") from exc

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty upload.")

    try:
        return process_bytes(file.filename or "measurement.csv", raw, meta)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Processing failed: {exc}") from exc


@router.get("/session/{session_id}/table", response_model=TablePageResponse)
def get_table_page(
    session_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=MAX_TABLE_PAGE),
    sort: str | None = Query(None, description="Column id from universal schema"),
    order: str = Query("asc"),
    q: str | None = Query(None, description="Substring filter across all columns"),
    filters: str | None = Query(
        None,
        description="JSON object of column_id -> substring filter",
    ),
) -> TablePageResponse:
    df = session_store.get(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session expired or unknown.")

    col_filters = parse_column_filters_json(filters)
    filtered = apply_table_filters(df, q, col_filters)
    order_norm = order.lower() if order.lower() in ("asc", "desc") else "asc"
    sorted_df = sort_frame(filtered, sort, order_norm)
    total = int(len(sorted_df))
    total_pages = max(1, (total + page_size - 1) // page_size)
    page = min(page, total_pages)
    start = (page - 1) * page_size
    page_df = sorted_df.iloc[start : start + page_size]

    return TablePageResponse(
        session_id=session_id,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        rows=_rows_from_df(page_df.reset_index(drop=True)),
        columns=[str(c) for c in df.columns],
    )


@router.get("/session/{session_id}/export.csv")
def export_session_csv(
    session_id: str,
    q: str | None = Query(None),
    filters: str | None = Query(None),
) -> StreamingResponse:
    df = session_store.get(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session expired or unknown.")

    col_filters = parse_column_filters_json(filters)
    filtered = apply_table_filters(df, q, col_filters)
    buf = io.StringIO()
    filtered.to_csv(buf, index=False)
    buf.seek(0)

    headers = {
        "Content-Disposition": f'attachment; filename="pq_normalized_{session_id[:8]}.csv"'
    }
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers=headers,
    )


@router.get("/session/{session_id}/normalized-excel")
def export_session_normalized_excel(session_id: str) -> StreamingResponse:
    df = session_store.get(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session expired or unknown.")

    output_buffer = io.BytesIO()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    with pd.ExcelWriter(output_buffer, engine="openpyxl") as writer:
        df.to_excel(
            writer,
            sheet_name="Data",
            index=False,
            engine="openpyxl",
        )

    output_buffer.seek(0)

    filename = f"pq_normalized_{session_id[:8]}_{timestamp}.xlsx"
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"'
    }

    return StreamingResponse(
        iter([output_buffer.getvalue()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


# ── Central history (persisted sessions; empty when DATABASE_URL unset) ────────

@router.get("/history")
def list_history() -> list[dict]:
    """List persisted session summaries, newest first."""
    return db.list_summaries()


@router.get("/session/{session_id}/full", response_model=ProcessResponse)
def get_session_full(session_id: str) -> ProcessResponse:
    """Return the full stored ProcessResponse for a persisted session."""
    payload = db.load_summary(session_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Session not found in history.")
    return ProcessResponse.model_validate(payload)


@router.delete("/session/{session_id}")
def delete_session(session_id: str) -> dict:
    """Remove a persisted session (summary + normalized frame)."""
    db.delete_session(session_id)
    return {"ok": True}


# ── Normalized Excel Download ──────────────────────────────────────────────────

@router.post("/models/{model_name}/normalized-excel")
async def download_normalized_excel(
    model_name: str,
    file: UploadFile = File(...),
) -> StreamingResponse:
    """
    Download normalized Excel file with only mapped columns.

    Applies the saved mappings for the model to the uploaded data file,
    creating a clean Excel output with standardized column names.
    """
    try:
        # Get saved mappings for this model
        mappings = get_mappings(model_name)
        if not mappings:
            raise HTTPException(
                status_code=400,
                detail=f"No mappings found for model '{model_name}'. Configure mappings first.",
            )

        # Read the uploaded file
        raw = await file.read()
        if not raw:
            raise HTTPException(status_code=400, detail="Empty upload.")

        # Parse all sheets/pages
        pages = _read_all_pages_for_mapping(file.filename or "data.xlsx", raw)
        if not pages:
            raise HTTPException(status_code=400, detail="No readable data found in file.")

        # Load custom columns — they handle the "same name from different sheet → different
        # standard col" case. They get processed AFTER the main mappings.
        custom_cols = get_custom_columns(model_name)

        # Apply main mappings + custom columns to create normalized dataframe
        output_df = _apply_mappings_to_dataframe(
            pages,
            mappings,
            source_pages=None,
            custom_cols=custom_cols,
        )
        output_df = _scale_power_columns(output_df)

        # Create Excel file in memory
        output_buffer = io.BytesIO()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        with pd.ExcelWriter(output_buffer, engine="openpyxl") as writer:
            output_df.to_excel(
                writer,
                sheet_name="Data",
                index=False,
                engine="openpyxl",
            )

        output_buffer.seek(0)

        filename = f"pq_data_normalized_{timestamp}.xlsx"
        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"'
        }

        return StreamingResponse(
            iter([output_buffer.getvalue()]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers=headers,
        )

    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate normalized Excel: {str(exc)}",
        ) from exc
