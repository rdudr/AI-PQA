from __future__ import annotations

import pandas as pd

from parsers.base import GenericParser
from parsers.detect import detect_vendor
from parsers.dranetz import DranetzParser
from parsers.fluke import FlukeParser
from parsers.hioki import HiokiParser
from parsers.schneider import SchneiderParser


_VENDOR_PARSERS = {
    "hioki": HiokiParser,
    "fluke": FlukeParser,
    "schneider": SchneiderParser,
    "dranetz": DranetzParser,
}


class CustomCsvParser(GenericParser):
    vendor_key = "custom_csv"

    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        detected = detect_vendor(df)
        if detected is not None:
            key = detected.value
            parser_cls = _VENDOR_PARSERS.get(key)
            if parser_cls is not None:
                return parser_cls().normalize(df)
        return self._standard_frame(df)
