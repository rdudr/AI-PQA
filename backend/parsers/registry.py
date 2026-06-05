from __future__ import annotations

import pandas as pd

from parsers.alm import ALMParser
from parsers.base import BasePQParser, GenericParser, slug_column
from parsers.custom_csv import CustomCsvParser
from parsers.dranetz import DranetzParser
from parsers.fluke import FlukeParser
from parsers.hioki import HiokiParser
from parsers.schneider import SchneiderParser


class _ConfiguredParser(BasePQParser):
    """Wraps any base parser and adds user-saved column mappings on top."""

    vendor_key = "configured"

    def __init__(self, base: BasePQParser, mappings: dict[str, str]) -> None:
        # Build extra_synonyms from saved mappings: {standard_col: (raw_col,)}
        extra: dict[str, tuple[str, ...]] = {}
        for raw, standard in mappings.items():
            if standard == "NA" or not standard:
                continue
            slug = slug_column(raw)
            extra[standard] = extra.get(standard, ()) + (slug,)
        super().__init__(extra)
        self._base = base
        # Merge the base parser's own synonym map so auto-detection still works
        self._synonym_map = {**base._synonym_map, **self._synonym_map}

    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        return self._standard_frame(df)


def _slug_vendor(vendor: str) -> str:
    """Normalize a vendor name for parser routing.

    Strips spaces, dashes, underscores, and lowercases so that user-visible
    display names (e.g. "ALM-45", "Hioki PQ-3198") route to the same parser
    as the legacy slugs ("alm_45", "hioki_p3198").
    """
    return "".join(ch for ch in str(vendor).strip().lower() if ch.isalnum())


def get_parser(vendor: str) -> BasePQParser:
    """Return the appropriate parser, layering any user-saved config on top."""
    vendor_str = str(vendor)
    key = _slug_vendor(vendor_str)

    # Match on the normalized key so "ALM-45", "alm_45", "alm45" all resolve.
    base: BasePQParser
    if key.startswith("alm"):                                # alm20/31/36/45
        base = ALMParser()
    elif "hioki" in key:                                     # hiokipq3198, hiokipw3198
        base = HiokiParser()
    elif "fluke" in key:
        base = FlukeParser()
    elif "schneider" in key or "powerlogic" in key:
        base = SchneiderParser()
    elif "dranetz" in key or "hdpq" in key:
        base = DranetzParser()
    elif "customcsv" in key or key == "custom":
        base = CustomCsvParser()
    else:
        base = GenericParser()

    # Layer saved user mappings on top (if any)
    try:
        from services.config_store import get_mappings
        saved = get_mappings(vendor_str)
        if saved:
            return _ConfiguredParser(base, saved)
    except Exception:
        pass

    return base
