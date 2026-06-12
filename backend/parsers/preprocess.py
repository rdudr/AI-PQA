from __future__ import annotations

import pandas as pd

from parsers.base import BASE_SYNONYMS, slug_column

# Tokens common in vendor export headers (beyond BASE_SYNONYMS)
HEADER_HINTS = (
    "urms",
    "irms",
    "thdv",
    "thdi",
    "vrms",
    "kw",
    "kva",
    "pf",
    "freq",
    "date",
    "time",
    "phase",
    "voltage",
    "current",
    "harmonic",
)


def _row_match_score(cells: list[str]) -> int:
    slugs = {slug_column(c) for c in cells if c and str(c).strip()}
    aliases = set()
    for aliases_tuple in BASE_SYNONYMS.values():
        for a in aliases_tuple:
            aliases.add(slug_column(a))
    score = len(slugs & aliases)
    for slug in slugs:
        if any(h in slug for h in HEADER_HINTS):
            score += 1
    return score


def locate_header_row(raw: pd.DataFrame, scan_rows: int = 40) -> int | None:
    """Return 0-based row index that looks like a measurement header row."""
    best_idx: int | None = None
    best_score = 0
    limit = min(scan_rows, len(raw))
    for i in range(limit):
        row = raw.iloc[i]
        cells = [str(v) for v in row.tolist() if pd.notna(v)]
        score = _row_match_score(cells)
        if score > best_score and score >= 2:
            best_score = score
            best_idx = i
    return best_idx


def prepare_tabular_export(raw: pd.DataFrame) -> pd.DataFrame:
    """
    Normalize preamble-heavy PQ exports (Hioki / Fluke / Schneider often ship metadata rows first).
    """
    if raw.empty:
        return raw

    header_idx = locate_header_row(raw)
    if header_idx is None:
        # Already has string column names
        if all(isinstance(c, str) for c in raw.columns):
            return raw
        return raw

    header_cells = [
        str(v).strip() if pd.notna(v) else f"col_{j}"
        for j, v in enumerate(raw.iloc[header_idx].tolist())
    ]
    body = raw.iloc[header_idx + 1 :].copy()
    body.columns = header_cells
    body = body.reset_index(drop=True)
    # Drop fully empty rows
    body = body.dropna(how="all")

    # Skip unit rows (typically follow headers in PQ analyzer exports)
    # Unit rows contain strings like 'V', 'A', 'var', '%', 'Hz', etc. in numeric columns
    # Identify by checking if first non-NaN numeric column contains a typical unit string
    unit_keywords = {'v', 'a', 'w', 'var', 'va', 'hz', '%', 'pf', 'thd', 'pct', 'percent'}
    if len(body) > 0:
        first_row = body.iloc[0]
        is_units_row = False
        for val in first_row:
            if pd.notna(val):
                val_str = str(val).strip().lower()
                if val_str in unit_keywords and len(val_str) <= 4:  # Keep short, don't match normal data
                    is_units_row = True
                    break
        if is_units_row:
            body = body.iloc[1:].reset_index(drop=True)

    return body
