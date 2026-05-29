from __future__ import annotations

import pandas as pd

from parsers.base import BasePQParser
SCHNEIDER_SYNONYMS: dict[str, tuple[str, ...]] = {
    "timestamp": ("date_time", "timestamp_utc", "local_time"),
    "voltage_phase_a": (
        "u_ll_a",
        "vll_a",
        "v_1_rms",
        "voltage_l1",
        "phase_voltage_a",
    ),
    "voltage_phase_b": ("u_ll_b", "vll_b", "v_2_rms", "voltage_l2", "phase_voltage_b"),
    "voltage_phase_c": ("u_ll_c", "vll_c", "v_3_rms", "voltage_l3", "phase_voltage_c"),
    "current_phase_a": ("i_1_rms", "i1_rms", "current_l1", "i_a"),
    "current_phase_b": ("i_2_rms", "i2_rms", "current_l2", "i_b"),
    "current_phase_c": ("i_3_rms", "i3_rms", "current_l3", "i_c"),
    "kw": ("kw_tot", "active_power", "p_total", "kw_3ph"),
    "kva": ("kva_tot", "apparent_power", "s_total", "kva_3ph"),
    "pf": ("pf_tot", "power_factor", "pf_3ph"),
    "frequency": ("frequency", "freq", "line_freq"),
    "vthd_a": ("thd_v1", "vthd_1", "uthd_1"),
    "vthd_b": ("thd_v2", "vthd_2", "uthd_2"),
    "vthd_c": ("thd_v3", "vthd_3", "uthd_3"),
    "ithd_a": ("thd_i1", "ithd_1"),
    "ithd_b": ("thd_i2", "ithd_2"),
    "ithd_c": ("thd_i3", "ithd_3"),
}


class SchneiderParser(BasePQParser):
    vendor_key = "schneider"

    def __init__(self) -> None:
        super().__init__(SCHNEIDER_SYNONYMS)

    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        return self._standard_frame(df)
