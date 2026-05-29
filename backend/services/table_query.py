from __future__ import annotations

import json

import pandas as pd

from parsers.base import STANDARD_COLUMNS


def filter_by_query(df: pd.DataFrame, q: str | None) -> pd.DataFrame:
    if not q or not str(q).strip():
        return df
    needle = str(q).strip().lower()
    mask = pd.Series(False, index=df.index)
    for col in df.columns:
        mask |= df[col].astype(str).str.lower().str.contains(needle, regex=False, na=False)
    return df.loc[mask]


def filter_by_columns(
    df: pd.DataFrame,
    column_filters: dict[str, str] | None,
) -> pd.DataFrame:
    if not column_filters:
        return df
    allowed = set(STANDARD_COLUMNS)
    out = df
    for col, raw in column_filters.items():
        if col not in allowed or col not in out.columns:
            continue
        needle = str(raw).strip().lower()
        if not needle:
            continue
        series = out[col].astype(str).str.lower()
        out = out.loc[series.str.contains(needle, regex=False, na=False)]
    return out


def parse_column_filters_json(raw: str | None) -> dict[str, str] | None:
    if not raw or not raw.strip():
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    return {str(k): str(v) for k, v in data.items() if v is not None and str(v).strip()}


def apply_table_filters(
    df: pd.DataFrame,
    q: str | None,
    column_filters: dict[str, str] | None,
) -> pd.DataFrame:
    return filter_by_columns(filter_by_query(df, q), column_filters)


def sort_frame(df: pd.DataFrame, sort: str | None, order: str | None) -> pd.DataFrame:
    allowed = set(STANDARD_COLUMNS)
    if not sort or sort not in allowed or sort not in df.columns:
        return df
    ascending = (order or "asc").lower() != "desc"
    try:
        return df.sort_values(by=sort, ascending=ascending, na_position="last")
    except Exception:  # noqa: BLE001
        return df
