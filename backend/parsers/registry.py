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


def get_parser(vendor: str) -> BasePQParser:
    """Return the appropriate parser, layering any user-saved config on top."""
    # Resolve base parser
    vendor_str = str(vendor)

    match vendor_str:
        case "hioki" | "hioki_p3198":
            base: BasePQParser = HiokiParser()
        case "fluke":
            base = FlukeParser()
        case "schneider":
            base = SchneiderParser()
        case "dranetz":
            base = DranetzParser()
        case "alm_36" | "alm_31" | "alm_20" | "alm_45":
            base = ALMParser()
        case "custom_csv":
            base = CustomCsvParser()
        case _:
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
