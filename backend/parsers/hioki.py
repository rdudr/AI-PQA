from __future__ import annotations

import pandas as pd

from parsers.base import BasePQParser
# PW3198 / MR8880 / PQ One export style column aliases
HIOKI_SYNONYMS: dict[str, tuple[str, ...]] = {
    "timestamp": (
        "date_time",
        "measurement_time",
        "record_time",
        "sampling_time",
    ),
    "voltage_phase_a": (
        "chu1",
        "ch1_v",
        "v1",
        "phase1_v",
        "urms_l1",
        "voltage_l1",
        "v_l1",
        "van_rms",
        "v_rms_l1",
    ),
    "voltage_phase_b": (
        "chu2",
        "ch2_v",
        "v2",
        "phase2_v",
        "urms_l2",
        "voltage_l2",
        "v_l2",
        "vbn_rms",
        "v_rms_l2",
    ),
    "voltage_phase_c": (
        "chu3",
        "ch3_v",
        "v3",
        "phase3_v",
        "urms_l3",
        "voltage_l3",
        "v_l3",
        "vcn_rms",
        "v_rms_l3",
    ),
    "current_phase_a": (
        "chu4",
        "ch4_a",
        "i1",
        "phase1_i",
        "irms_l1",
        "current_l1",
        "i_l1",
        "ia_rms",
        "i_rms_l1",
    ),
    "current_phase_b": (
        "chu5",
        "ch5_a",
        "i2",
        "phase2_i",
        "irms_l2",
        "current_l2",
        "i_l2",
        "ib_rms",
        "i_rms_l2",
    ),
    "current_phase_c": (
        "chu6",
        "ch6_a",
        "i3",
        "phase3_i",
        "irms_l3",
        "current_l3",
        "i_l3",
        "ic_rms",
        "i_rms_l3",
    ),
    "kw": (
        "kw_3p",
        "p_kw_total",
        "active_power_total",
        "p_tot",
        "w_tot",
        "power_p",
    ),
    "kva": (
        "kva_3p",
        "s_kva_total",
        "apparent_power_total",
        "s_tot",
        "va_tot",
    ),
    "pf": ("pf_3p", "pf_tot", "power_factor_total", "cos_phi_tot", "pf_total"),
    "frequency": ("freq_avg", "frequency_avg", "freq_hz", "line_freq"),
    "vthd_a": ("thdv_1", "vthd1", "thd_v_l1", "uthd_l1", "v_thd_l1"),
    "vthd_b": ("thdv_2", "vthd2", "thd_v_l2", "uthd_l2", "v_thd_l2"),
    "vthd_c": ("thdv_3", "vthd3", "thd_v_l3", "uthd_l3", "v_thd_l3"),
    "ithd_a": ("thdi_1", "ithd1", "thd_i_l1", "i_thd_l1"),
    "ithd_b": ("thdi_2", "ithd2", "thd_i_l2", "i_thd_l2"),
    "ithd_c": ("thdi_3", "ithd3", "thd_i_l3", "i_thd_l3"),
}


class HiokiParser(BasePQParser):
    vendor_key = "hioki"

    def __init__(self) -> None:
        super().__init__(HIOKI_SYNONYMS)

    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        return self._standard_frame(df)
