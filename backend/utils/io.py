from __future__ import annotations

import csv
import io

import pandas as pd

from parsers.preprocess import prepare_tabular_export


def _read_csv_ragged(raw: bytes) -> pd.DataFrame:
    """Parse CSV with preamble rows that may have fewer columns than the data table."""
    text = raw.decode("utf-8-sig", errors="replace")
    reader = csv.reader(io.StringIO(text))
    rows = [row for row in reader if any(cell.strip() for cell in row)]
    if not rows:
        return pd.DataFrame()
    width = max(len(r) for r in rows)
    padded = [r + [""] * (width - len(r)) for r in rows]
    return pd.DataFrame(padded)


def _unify_datetime(df: pd.DataFrame) -> pd.DataFrame:
    """Create a _sync_ts column from separate Date+Time columns if present."""
    import warnings
    from parsers.base import slug_column
    warnings.filterwarnings("ignore", category=UserWarning)

    date_col, time_col = None, None
    for c in df.columns:
        slug = slug_column(str(c))
        if slug in ("date", "date_", "datestarted", "meas_date"):
            date_col = c
        if slug in ("time", "time_", "timestarted", "meas_time", "clock"):
            time_col = c

    if date_col and time_col:
        combined = df[date_col].astype(str) + " " + df[time_col].astype(str)
        df = df.copy()
        df["_sync_ts"] = pd.to_datetime(combined, errors="coerce")
        return df.dropna(subset=["_sync_ts"])
    return df


def _sheet_has_timestamp(df: pd.DataFrame) -> bool:
    """Return True if the sheet has any recognisable timestamp column."""
    from parsers.base import slug_column
    ts_slugs = {"timestamp", "datetime", "date_time", "date", "time"}
    return any(slug_column(str(c)) in ts_slugs for c in df.columns)


def _find_ts_col(df: pd.DataFrame) -> str | None:
    """Return the name of the first timestamp-like column in df, or None."""
    from parsers.base import slug_column
    priority = ("timestamp", "datetime", "date_time")
    for c in df.columns:
        if slug_column(str(c)) in priority:
            return c
    return None


def _merge_plain_sheets(sheets: list[pd.DataFrame]) -> pd.DataFrame | None:
    """Merge plain sheets that each have a combined Timestamp/DateTime column.

    Uses an outer join on the parsed timestamp so all measurements (voltage,
    current, THD, power — potentially in separate sheets) end up in one frame.
    Sheets without a parseable timestamp are appended column-wise to the first
    sheet if their row count matches exactly.
    """
    keyed: list[pd.DataFrame] = []
    rowcount_only: list[pd.DataFrame] = []

    for df in sheets:
        ts_col = _find_ts_col(df)
        if ts_col:
            tmp = df.copy()
            tmp["_ts_key"] = pd.to_datetime(tmp[ts_col], errors="coerce")
            tmp = tmp.dropna(subset=["_ts_key"])
            if not tmp.empty:
                keyed.append(tmp)
        else:
            rowcount_only.append(df)

    if not keyed:
        return None

    # Sort sheets longest-first so the primary data frame is first
    keyed.sort(key=len, reverse=True)
    merged = keyed[0]

    for other in keyed[1:]:
        new_cols = [
            c for c in other.columns
            if c not in merged.columns and c != "_ts_key"
        ]
        if not new_cols:
            continue
        merged = pd.merge(
            merged,
            other[["_ts_key"] + new_cols],
            on="_ts_key",
            how="outer",
        )

    # Sheets with no timestamp but matching row count → join column-wise
    base_len = len(merged)
    for other in rowcount_only:
        if len(other) == base_len:
            new_cols = [c for c in other.columns if c not in merged.columns]
            if new_cols:
                merged = pd.concat(
                    [merged.reset_index(drop=True), other[new_cols].reset_index(drop=True)],
                    axis=1,
                )

    return merged.drop(columns=["_ts_key"], errors="ignore")


def load_dataframe(filename: str, raw: bytes) -> pd.DataFrame:
    """Load vendor export; merges multi-sheet Excel on Date/Time when possible,
    otherwise returns the largest usable sheet."""
    name = filename.lower()
    buffer = io.BytesIO(raw)

    if name.endswith(".csv"):
        raw_df = _read_csv_ragged(raw)
        return prepare_tabular_export(raw_df)

    if name.endswith((".xlsx", ".xls", ".xlsb", ".xlsm")):
        # Robust engine selection with fallback chain
        from utils.excel_open import open_excel
        xls, engine = open_excel(filename, raw)

        sync_sheets: list[pd.DataFrame] = []   # sheets merged via Date+Time columns
        plain_sheets: list[pd.DataFrame] = []  # sheets with a combined Timestamp

        for sheet in xls.sheet_names:
            try:
                raw_sheet = pd.read_excel(xls, sheet_name=sheet, header=None, engine=engine)
                processed = prepare_tabular_export(raw_sheet)
                if processed.empty:
                    continue

                with_sync = _unify_datetime(processed)
                if "_sync_ts" in with_sync.columns:
                    sync_sheets.append(with_sync)
                elif _sheet_has_timestamp(processed):
                    plain_sheets.append(processed)
                elif len(processed.columns) >= 3:
                    # Sheet has numeric data but no obvious timestamp — keep as fallback
                    plain_sheets.append(processed)
            except Exception:
                continue

        # --- Strategy 1: merge sheets that share a Date+Time stamp ---
        if sync_sheets:
            merged = sync_sheets[0]
            for other in sync_sheets[1:]:
                new_cols = [c for c in other.columns if c not in merged.columns and c != "_sync_ts"]
                if not new_cols:
                    continue
                merged = pd.merge(
                    merged,
                    other[["_sync_ts"] + new_cols],
                    on="_sync_ts",
                    how="outer",
                )
            merged = merged.drop(columns=["_sync_ts"], errors="ignore")
            merged = merged.dropna(axis=1, how="all")
            return merged

        # --- Strategy 2: merge plain sheets on shared timestamp column ---
        if plain_sheets:
            merged = _merge_plain_sheets(plain_sheets)
            if merged is not None and not merged.empty:
                return merged.dropna(axis=1, how="all")
            # Final fallback: return the largest sheet
            best = max(plain_sheets, key=len)
            return best.dropna(axis=1, how="all")

    return pd.DataFrame()
