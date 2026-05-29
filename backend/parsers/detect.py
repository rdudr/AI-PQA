from __future__ import annotations

import pandas as pd

from parsers.base import slug_column


VENDOR_SIGNATURES: dict[str, tuple[str, ...]] = {
    "hioki": (
        "hioki",
        "pw3198",
        "pw3365",
        "mr8880",
        "thdv_1",
        "thdi_1",
        "freq_avg",
        "kw_3p",
    ),
    "fluke": (
        "fluke",
        "1736",
        "1770",
        "vrms_an",
        "irms_an",
        "power_3p",
    ),
    "schneider": (
        "ion",
        "pm8000",
        "schneider",
        "i_1_rms",
        "v_1_rms",
        "u_ll_1",
    ),
    "dranetz": (
        "dranetz",
        "pp4300",
        "volts_a_rms",
        "amps_a_rms",
        "thd_v_a",
    ),
    "alm": (
        "alm",
        "v_a",
        "v_b",
        "v_c",
        "i_a",
        "i_b",
        "i_c",
        "vthd_a",
    ),
}


def detect_vendor(df: pd.DataFrame) -> str | None:
    """Best-effort vendor guess from column slugs (after header detection)."""
    slugs = {slug_column(c) for c in df.columns}
    blob = " ".join(slugs)
    scores: dict[str, int] = {}
    for vendor, hints in VENDOR_SIGNATURES.items():
        scores[vendor] = sum(1 for h in hints if h in slugs or h in blob)
    if not scores:
        return None
    best = max(scores, key=scores.get)
    if scores[best] < 2:
        return None
    return best
