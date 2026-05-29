from __future__ import annotations

import pandas as pd

from parsers.base import BasePQParser
FLUKE_SYNONYMS: dict[str, tuple[str, ...]] = {
    "timestamp": ("date_time", "start_time", "time_stamp"),
    "voltage_phase_a": (
        "vrms_a",
        "vrms_an",
        "v_a_rms",
        "phase_a_vrms",
        "voltage_a",
    ),
    "voltage_phase_b": ("vrms_b", "vrms_bn", "v_b_rms", "phase_b_vrms", "voltage_b"),
    "voltage_phase_c": ("vrms_c", "vrms_cn", "v_c_rms", "phase_c_vrms", "voltage_c"),
    "current_phase_a": ("irms_a", "irms_an", "i_a_rms", "phase_a_irms", "current_a"),
    "current_phase_b": ("irms_b", "irms_bn", "i_b_rms", "phase_b_irms", "current_b"),
    "current_phase_c": ("irms_c", "irms_cn", "i_c_rms", "phase_c_irms", "current_c"),
    "kw": ("kw", "active_power", "p_3phase", "power_kw", "real_power"),
    "kva": ("kva", "apparent_power", "s_3phase", "va_total"),
    "pf": ("pf", "power_factor", "pf_3phase", "cos_phi"),
    "frequency": ("freq", "frequency_hz", "line_frequency"),
    "vthd_a": ("thd_v_a", "vthd_a", "uthd_a"),
    "vthd_b": ("thd_v_b", "vthd_b", "uthd_b"),
    "vthd_c": ("thd_v_c", "vthd_c", "uthd_c"),
    "ithd_a": ("thd_i_a", "ithd_a"),
    "ithd_b": ("thd_i_b", "ithd_b"),
    "ithd_c": ("thd_i_c", "ithd_c"),
}


class FlukeParser(BasePQParser):
    vendor_key = "fluke"

    def __init__(self) -> None:
        super().__init__(FLUKE_SYNONYMS)

    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        return self._standard_frame(df)
