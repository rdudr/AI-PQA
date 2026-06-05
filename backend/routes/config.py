"""API routes for PQ model configuration management."""
from __future__ import annotations

import io

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile, Response
from pydantic import BaseModel

from parsers.base import STANDARD_COLUMNS, slug_column, _invert_synonyms
from parsers.alm import ALM_SYNONYMS
from parsers.hioki import HIOKI_SYNONYMS
from parsers.preprocess import prepare_tabular_export
from services.config_store import (
    add_model,
    get_custom_columns,
    get_mappings,
    list_models,
    remove_model,
    save_custom_columns,
    save_mappings,
)

router = APIRouter(tags=["config"])
STANDARD_COLUMNS_LIST = list(STANDARD_COLUMNS)

# Build a global reverse-synonym map (all known aliases → standard name)
_all_extra: dict[str, tuple] = {}
for _d in (ALM_SYNONYMS, HIOKI_SYNONYMS):
    for _k, _v in _d.items():
        _all_extra[_k] = _all_extra.get(_k, ()) + _v
_REV_MAP: dict[str, str] = _invert_synonyms(_all_extra)


# ── Helpers ────────────────────────────────────────────────────────────────────

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


def _read_all_pages(filename: str, raw: bytes) -> list[dict]:
    """Return a list of page dicts, one per sheet (Excel) or one for CSV.

    Each page dict:
      {
        "sheet_name": str,
        "df": pd.DataFrame        # after header-row detection
      }
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
        # Robust engine selection with fallback chain (handles legacy .xls,
        # mis-extensioned files, etc.). Raises ValueError if nothing can
        # parse it — caller (the FastAPI route) maps that to HTTP 400.
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


def _classify_col(raw_name: str, saved: dict[str, str]) -> tuple[str | None, str]:
    """Return (matched_standard_name | None, match_source)."""
    if raw_name in saved:
        return saved[raw_name], "saved"
    slug = slug_column(raw_name)
    if slug in _REV_MAP:
        return _REV_MAP[slug], "auto"
    return None, "unmatched"


# ── Models list ────────────────────────────────────────────────────────────────

@router.get("/models")
def get_models(response: Response) -> list[dict]:
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    return list_models()


class AddModelRequest(BaseModel):
    name: str


@router.post("/models")
def create_model(body: AddModelRequest) -> dict:
    try:
        return add_model(body.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/models/{model_name}")
def delete_model(model_name: str) -> dict:
    try:
        remove_model(model_name)
        return {"deleted": model_name}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ── Column mappings ────────────────────────────────────────────────────────────

@router.get("/models/{model_name}/mappings")
def fetch_mappings(model_name: str) -> dict:
    return {"model": model_name, "mappings": get_mappings(model_name)}


from typing import Union

class SaveMappingsRequest(BaseModel):
    mappings: dict[str, Union[str, dict]]


@router.post("/models/{model_name}/mappings")
def store_mappings(model_name: str, body: SaveMappingsRequest) -> dict:
    # Preserve source_page info — only flatten when there is no source_page
    full_mappings: dict = {}
    for col_name, mapping_value in body.mappings.items():
        if isinstance(mapping_value, dict):
            standard_col = mapping_value.get("standard_column", "")
            source_page = mapping_value.get("source_page")
            if source_page:
                full_mappings[col_name] = {"standard_column": standard_col, "source_page": source_page}
            else:
                full_mappings[col_name] = standard_col
        else:
            full_mappings[col_name] = str(mapping_value)

    save_mappings(model_name, full_mappings)
    return {"model": model_name, "saved": len(full_mappings)}


# ── Custom columns ────────────────────────────────────────────────────────────

class CustomColumnItem(BaseModel):
    name: str
    sheet: str
    mapTo: str


class SaveCustomColumnsRequest(BaseModel):
    columns: list[CustomColumnItem]


@router.get("/models/{model_name}/custom-columns")
def fetch_custom_columns(model_name: str) -> dict:
    return {"model": model_name, "columns": get_custom_columns(model_name)}


@router.post("/models/{model_name}/custom-columns")
def store_custom_columns(model_name: str, body: SaveCustomColumnsRequest) -> dict:
    cols = [c.model_dump() for c in body.columns]
    save_custom_columns(model_name, cols)
    return {"model": model_name, "saved": len(cols)}


# ── File inspection — reads EVERY sheet / page ───────────────────────────────

@router.post("/models/{model_name}/inspect")
async def inspect_file(
    model_name: str,
    file: UploadFile = File(...),
) -> dict:
    """Read ALL sheets/pages of the uploaded file and return every column found,
    with auto-match suggestions and which sheet each column came from.
    """
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file.")

    # Read every sheet — surface a clear error if the file simply can't be
    # parsed (broken Excel, wrong extension, etc.) instead of silently
    # returning "no columns".
    try:
        pages = _read_all_pages(file.filename or "sample.xlsx", raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not pages:
        raise HTTPException(
            status_code=400,
            detail=(
                "No readable data found in file. The file opened correctly but "
                "no sheet contained ≥ 2 columns of tabular data. Verify the file "
                "is not blank, password-protected, or a chart-only workbook."
            ),
        )

    saved = get_mappings(model_name)

    # Collect columns across ALL sheets — track all sheet names for a column
    # key = raw_name, value = accumulated info
    col_index: dict[str, dict] = {}

    for page in pages:
        df: pd.DataFrame = page["df"]
        sheet_name: str = page["sheet_name"]

        for col in df.columns:
            raw_name = str(col).strip()
            if not raw_name or raw_name.startswith("col_"):
                continue

            matched, source = _classify_col(raw_name, saved)

            col_data = df[col]
            if isinstance(col_data, pd.DataFrame):
                col_data = col_data.iloc[:, 0]
            sample = [
                str(v) for v in col_data.dropna().head(3).tolist()
            ]

            if raw_name not in col_index:
                col_index[raw_name] = {
                    "raw_name": raw_name,
                    "slug": slug_column(raw_name),
                    "matched_to": matched,
                    "match_source": source,
                    "sample_values": sample,
                    "sheets": [sheet_name],
                }
            else:
                # Column appears in multiple sheets — merge sheet list
                if sheet_name not in col_index[raw_name]["sheets"]:
                    col_index[raw_name]["sheets"].append(sheet_name)
                # Prefer "saved" > "auto" > "unmatched"
                existing_src = col_index[raw_name]["match_source"]
                priority = {"saved": 0, "auto": 1, "unmatched": 2}
                if priority[source] < priority[existing_src]:
                    col_index[raw_name]["matched_to"] = matched
                    col_index[raw_name]["match_source"] = source
                # Add more sample values if we have space
                if len(col_index[raw_name]["sample_values"]) < 3:
                    col_index[raw_name]["sample_values"].extend(
                        [v for v in sample if v not in col_index[raw_name]["sample_values"]]
                    )

    columns_info = list(col_index.values())
    unmatched_count = sum(1 for c in columns_info if c["match_source"] == "unmatched")
    sheet_names = [p["sheet_name"] for p in pages]

    return {
        "model": model_name,
        "filename": file.filename,
        "sheets_found": sheet_names,
        "total_columns": len(columns_info),
        "unmatched_count": unmatched_count,
        "columns": columns_info,
        "standard_columns": STANDARD_COLUMNS_LIST,
    }
