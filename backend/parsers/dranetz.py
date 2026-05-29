from __future__ import annotations

import pandas as pd

from parsers.base import BasePQParser
DRANETZ_SYNONYMS: dict[str, tuple[str, ...]] = {
    "timestamp": ("date_time", "sample_time", "time_tag"),
    "voltage_phase_a": ("volts_a_rms", "v_a_rms", "phase_a_volts"),
    "voltage_phase_b": ("volts_b_rms", "v_b_rms", "phase_b_volts"),
    "voltage_phase_c": ("volts_c_rms", "v_c_rms", "phase_c_volts"),
    "current_phase_a": ("amps_a_rms", "i_a_rms", "phase_a_amps"),
    "current_phase_b": ("amps_b_rms", "i_b_rms", "phase_b_amps"),
    "current_phase_c": ("amps_c_rms", "i_c_rms", "phase_c_amps"),
    "kw": ("kw", "real_power", "p_kw"),
    "kva": ("kva", "apparent_power", "s_kva"),
    "pf": ("pf", "power_factor"),
    "frequency": ("frequency", "freq_hz"),
    "vthd_a": ("thd_v_a", "vthd_a"),
    "vthd_b": ("thd_v_b", "vthd_b"),
    "vthd_c": ("thd_v_c", "vthd_c"),
    "ithd_a": ("thd_i_a", "ithd_a"),
    "ithd_b": ("thd_i_b", "ithd_b"),
    "ithd_c": ("thd_i_c", "ithd_c"),
}


class DranetzParser(BasePQParser):
    vendor_key = "dranetz"

    def __init__(self) -> None:
        super().__init__(DRANETZ_SYNONYMS)

    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        return self._standard_frame(df)
