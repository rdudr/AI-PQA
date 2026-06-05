"""Shared Excel opener that tolerates broken or mis-extensioned files.

Real-world PQ analyzer exports come in many shapes:

  * .xls  — legacy BIFF8 binary (Excel 97-2003)            → needs xlrd
  * .xlsx — modern OOXML zip                                → needs openpyxl or calamine
  * .xlsb — Excel binary workbook                            → needs calamine (or pyxlsb)
  * .xlsm — macro-enabled OOXML                              → needs openpyxl or calamine
  * "xls" filename but actually OOXML inside  (very common
    on devices that auto-save as legacy) — only calamine
    or openpyxl can read it.
  * "xlsx" filename but actually CSV inside  (rare but seen).

Trying a single hard-coded engine therefore fails on ~10% of real files.
This helper opens the workbook with a fallback chain of engines and
returns the first one that succeeds — or raises a clear ValueError
naming every engine that was tried.
"""
from __future__ import annotations

import io

import pandas as pd

# Engine attempt order per file extension.
# - Primary engine first (matches the on-disk format)
# - calamine is a strong second because it reads .xlsx / .xls / .xlsb
# - openpyxl is a last-resort for OOXML
_ENGINE_CHAIN: dict[str, tuple[str, ...]] = {
    ".xls":  ("xlrd",     "calamine", "openpyxl"),
    ".xlsx": ("calamine", "openpyxl", "xlrd"),
    ".xlsm": ("calamine", "openpyxl"),
    ".xlsb": ("calamine",),
}


def open_excel(filename: str, raw: bytes) -> tuple[pd.ExcelFile, str]:
    """Return (ExcelFile, engine_used).

    Tries each engine in `_ENGINE_CHAIN[ext]` in order; first success wins.
    Raises ValueError with a list of attempted engines + their errors
    if none of them can parse the file.
    """
    name = filename.lower()
    # Pick the engine chain by extension; default to the broadest order
    chain: tuple[str, ...] = ()
    for ext, engines in _ENGINE_CHAIN.items():
        if name.endswith(ext):
            chain = engines
            break
    if not chain:
        chain = ("calamine", "openpyxl", "xlrd")

    errors: list[str] = []
    for eng in chain:
        try:
            xls = pd.ExcelFile(io.BytesIO(raw), engine=eng)
            # Touch sheet_names to force the actual parse — if the engine
            # is wrong this is where it raises.
            _ = xls.sheet_names
            return xls, eng
        except ImportError as e:
            errors.append(f"{eng}: not installed ({e})")
        except Exception as e:  # noqa: BLE001 — we want every parse error caught
            errors.append(f"{eng}: {type(e).__name__}: {e}")

    raise ValueError(
        f"Could not parse Excel file '{filename}' with any available engine. "
        f"Attempts: {'; '.join(errors)}"
    )
