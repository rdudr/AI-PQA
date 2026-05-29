from __future__ import annotations

import pandas as pd

from parsers.base import BasePQParser

# Column synonyms for ALM series PQ analyzers (ALM-20, ALM-31, ALM-36, ALM-45)
# and compatible devices (Elspec, Circutor, generic IEC-style multi-sheet exports).
# Covers both CSV exports (V_A style) and multi-sheet Excel (U1/I1/P_kW style).
ALM_SYNONYMS: dict[str, tuple[str, ...]] = {
    "timestamp": (
        "timestamp",
        "date_time",
        "datetime",
        "recording_time",
        "record_time",
        "time_stamp",
        "t",
    ),
    "voltage_phase_a": (
        # ALM Excel typical
        "u1", "u_1", "ul1", "u_l1", "u_l1_rms", "ul1_rms",
        "v_a", "va", "v1", "v_1", "v_l1", "v_rms_l1",
        "volt_l1", "volt_a", "voltage_l1", "voltage_a",
        "urms1", "u_rms1", "urms_l1", "v1_rms",
        "phase_a_v", "phase_1_v", "pha_v",
        # Elspec / IEC
        "u_phase_a", "van", "vln_a", "v_ln_a",
        # Solar/LV
        "u1_avg", "u1_rms_avg", "v_a_avg",
    ),
    "voltage_phase_b": (
        "u2", "u_2", "ul2", "u_l2", "u_l2_rms", "ul2_rms",
        "v_b", "vb", "v2", "v_2", "v_l2", "v_rms_l2",
        "volt_l2", "volt_b", "voltage_l2", "voltage_b",
        "urms2", "u_rms2", "urms_l2", "v2_rms",
        "phase_b_v", "phase_2_v", "phb_v",
        "u_phase_b", "vbn", "vln_b", "v_ln_b",
        "u2_avg", "u2_rms_avg", "v_b_avg",
    ),
    "voltage_phase_c": (
        "u3", "u_3", "ul3", "u_l3", "u_l3_rms", "ul3_rms",
        "v_c", "vc", "v3", "v_3", "v_l3", "v_rms_l3",
        "volt_l3", "volt_c", "voltage_l3", "voltage_c",
        "urms3", "u_rms3", "urms_l3", "v3_rms",
        "phase_c_v", "phase_3_v", "phc_v",
        "u_phase_c", "vcn", "vln_c", "v_ln_c",
        "u3_avg", "u3_rms_avg", "v_c_avg",
    ),
    "current_phase_a": (
        "i1", "i_1", "il1", "i_l1", "i_l1_rms", "il1_rms",
        "i_a", "ia", "a1", "a_1",
        "amp_l1", "amp_a", "current_l1", "current_a",
        "irms1", "i_rms1", "irms_l1", "i1_rms",
        "phase_a_i", "phase_1_i", "pha_i",
        "i_phase_a",
        "i1_avg", "i1_rms_avg", "i_a_avg",
    ),
    "current_phase_b": (
        "i2", "i_2", "il2", "i_l2", "i_l2_rms", "il2_rms",
        "i_b", "ib", "a2", "a_2",
        "amp_l2", "amp_b", "current_l2", "current_b",
        "irms2", "i_rms2", "irms_l2", "i2_rms",
        "phase_b_i", "phase_2_i", "phb_i",
        "i_phase_b",
        "i2_avg", "i2_rms_avg", "i_b_avg",
    ),
    "current_phase_c": (
        "i3", "i_3", "il3", "i_l3", "i_l3_rms", "il3_rms",
        "i_c", "ic", "a3", "a_3",
        "amp_l3", "amp_c", "current_l3", "current_c",
        "irms3", "i_rms3", "irms_l3", "i3_rms",
        "phase_c_i", "phase_3_i", "phc_i",
        "i_phase_c",
        "i3_avg", "i3_rms_avg", "i_c_avg",
    ),
    "kw": (
        "p_kw", "p_kw_total", "p_tot_kw", "pkw", "p_3ph_kw",
        "active_power_kw", "active_power", "p_total", "p_tot",
        "kw_total", "kw_3ph", "kw_3p",
        "ep_kw", "real_power_kw",
        "p_avg", "p_kw_avg",
    ),
    "kva": (
        "s_kva", "s_kva_total", "s_tot_kva", "skva", "s_3ph_kva",
        "apparent_power_kva", "apparent_power", "s_total", "s_tot",
        "kva_total", "kva_3ph", "kva_3p",
    ),
    "pf": (
        "pf_total", "pf_tot", "pf_3ph", "pf_3p",
        "power_factor_total", "power_factor",
        "cos_phi", "cosphi", "cos_phi_total",
        "pf_avg",
    ),
    "frequency": (
        "freq", "f", "hz", "f_hz", "freq_avg", "freq_hz",
        "frequency_avg", "line_freq", "net_freq",
        "f_avg",
    ),
    "vthd_a": (
        # numbered variants (most common in ALM/Elspec exports)
        "vthd_1", "vthd1", "vthd_l1",
        "thdv1", "thdv_1", "thdv_l1",
        # U-style (IEC voltage symbol)
        "thd_u1", "thd_u_1", "thd_u_l1", "uthd1", "uthd_l1", "uthd_1",
        "u1_thd", "u_thd_1", "u_thd_l1",
        # V-style
        "thd_v1", "thd_v_1", "thd_v_l1",
        "v1_thd", "v_thd_1", "v_thd_l1",
        "voltage_thd_l1", "voltage_thd_1",
        # letter-phase style
        "vthd_a", "v_thd_a", "thd_va", "thd_volt_a",
    ),
    "vthd_b": (
        "vthd_2", "vthd2", "vthd_l2",
        "thdv2", "thdv_2", "thdv_l2",
        "thd_u2", "thd_u_2", "thd_u_l2", "uthd2", "uthd_l2", "uthd_2",
        "u2_thd", "u_thd_2", "u_thd_l2",
        "thd_v2", "thd_v_2", "thd_v_l2",
        "v2_thd", "v_thd_2", "v_thd_l2",
        "voltage_thd_l2", "voltage_thd_2",
        "vthd_b", "v_thd_b", "thd_vb", "thd_volt_b",
    ),
    "vthd_c": (
        "vthd_3", "vthd3", "vthd_l3",
        "thdv3", "thdv_3", "thdv_l3",
        "thd_u3", "thd_u_3", "thd_u_l3", "uthd3", "uthd_l3", "uthd_3",
        "u3_thd", "u_thd_3", "u_thd_l3",
        "thd_v3", "thd_v_3", "thd_v_l3",
        "v3_thd", "v_thd_3", "v_thd_l3",
        "voltage_thd_l3", "voltage_thd_3",
        "vthd_c", "v_thd_c", "thd_vc", "thd_volt_c",
    ),
    "ithd_a": (
        # numbered variants
        "ithd_1", "ithd1", "ithd_l1",
        "thdi1", "thdi_1", "thdi_l1",
        # I-style
        "thd_i1", "thd_i_1", "thd_i_l1",
        "i1_thd", "i_thd_1", "i_thd_l1",
        "current_thd_l1", "current_thd_1",
        # letter-phase style
        "ithd_a", "i_thd_a", "thd_ia", "thd_curr_a",
    ),
    "ithd_b": (
        "ithd_2", "ithd2", "ithd_l2",
        "thdi2", "thdi_2", "thdi_l2",
        "thd_i2", "thd_i_2", "thd_i_l2",
        "i2_thd", "i_thd_2", "i_thd_l2",
        "current_thd_l2", "current_thd_2",
        "ithd_b", "i_thd_b", "thd_ib", "thd_curr_b",
    ),
    "ithd_c": (
        "ithd_3", "ithd3", "ithd_l3",
        "thdi3", "thdi_3", "thdi_l3",
        "thd_i3", "thd_i_3", "thd_i_l3",
        "i3_thd", "i_thd_3", "i_thd_l3",
        "current_thd_l3", "current_thd_3",
        "ithd_c", "i_thd_c", "thd_ic", "thd_curr_c",
    ),
    "kvar": (
        "q_kvar", "q_kvar_total", "q_tot_kvar", "qkvar", "q_3ph_kvar",
        "reactive_power_kvar", "reactive_power", "q_total", "q_tot",
        "kvar_total", "kvar_3ph", "kvar_3p",
        "q_avg", "q_kvar_avg",
    ),
    "dpf": (
        "dpf", "displacement_pf", "displacement_power_factor",
        "cos_phi_fund", "pf_fund", "fundamental_pf",
    ),
}


class ALMParser(BasePQParser):
    """Parser for ALM-series PQ analyzers (ALM-20, 31, 36, 45) and compatible exports."""
    vendor_key = "alm"

    def __init__(self) -> None:
        super().__init__(ALM_SYNONYMS)

    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        return self._standard_frame(df)
