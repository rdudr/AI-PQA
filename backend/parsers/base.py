from __future__ import annotations

import re
from abc import ABC, abstractmethod
import numpy as np
import pandas as pd

STANDARD_COLUMNS: tuple[str, ...] = (
    "timestamp",
    "date",
    "time",
    "voltage_phase_a",
    "voltage_phase_b",
    "voltage_phase_c",
    "current_phase_a",
    "current_phase_b",
    "current_phase_c",
    "kw",
    "kva",
    "pf",
    "frequency",
    "vthd_a",
    "vthd_b",
    "vthd_c",
    "ithd_a",
    "ithd_b",
    "ithd_c",
    "kvar",
    "nkvar",
    "dkvar",
    "dpf",
)


def slug_column(name: str) -> str:
    import unicodedata
    s = str(name)
    # Map ALM specific unicode small caps to standard letters (ʀᴍꜱ -> rms)
    s = s.replace("\u0280", "r").replace("\u1d0d", "m").replace("\ua731", "s")
    s = unicodedata.normalize('NFKC', s).strip().lower()
    s = re.sub(r"[%\s]+", "_", s)
    s = re.sub(r"[^a-z0-9_]+", "_", s)
    return re.sub(r"_+", "_", s).strip("_")


def _normalize_name(name: str) -> str:
    import unicodedata
    if not name:
        return ""
    s = unicodedata.normalize('NFKC', str(name)).strip().lower()
    s = re.sub(r"[\s\-_/]+", "", s)
    return s


def _fuzzy_normalize_name(name: str) -> str:
    import unicodedata
    if not name:
        return ""
    s = unicodedata.normalize('NFKC', str(name)).strip().lower()
    # Strip common units (with boundaries or inside parenthesis/brackets)
    s = re.sub(r"\b(kvarh|kvar|kwh|kw|kvah|kva|varh|var|wh|va|w|ka|a|v|volt|amps|amp|ampere|amperes|watts|watt)\b", "", s)
    s = re.sub(r"\((kvarh|kvar|kwh|kw|kvah|kva|varh|var|wh|va|w|ka|a|v|volt|amps|amp|ampere|amperes|watts|watt)\)", "", s)
    s = re.sub(r"\[(kvarh|kvar|kwh|kw|kvah|kva|varh|var|wh|va|w|ka|a|v|volt|amps|amp|ampere|amperes|watts|watt)\]", "", s)
    s = re.sub(r"[\s\-_/()\[\]]+", "", s)
    return s


BASE_SYNONYMS: dict[str, tuple[str, ...]] = {
    "timestamp": ("timestamp", "datetime", "date_time"),
    "date": ("date", "day", "date_only", "d", "recorddate"),
    "time": ("time", "time_only", "t", "recordtime", "hms"),
    "voltage_phase_a": (
        "voltage_phase_a", "va", "v_a", "phase_a_voltage", "u_a", "van", "urms_a", "v_rms_a", "rms_voltage_a",
        "v1_n_1_min", "u12_rms", "u12_rms_1_2_cycle_max", "u12_rms1_2_max", "v1_n", "u12", "v1rms", "u12rms"
    ),
    "voltage_phase_b": (
        "voltage_phase_b", "vb", "v_b", "phase_b_voltage", "u_b", "vbn", "urms_b", "v_rms_b", "rms_voltage_b",
        "v2_n_1_min", "u23_rms", "u23_rms_1_2_cycle_max", "u23_rms1_2_max", "v2_n", "u23", "v2rms", "u23rms"
    ),
    "voltage_phase_c": (
        "voltage_phase_c", "vc", "v_c", "phase_c_voltage", "u_c", "vcn", "urms_c", "v_rms_c", "rms_voltage_c",
        "v3_n_1_min", "u31_rms", "u31_rms_1_2_cycle_max", "u31_rms1_2_max", "v3_n", "u31", "v3rms", "u31rms"
    ),
    "current_phase_a": (
        "current_phase_a", "ia", "i_a", "phase_a_current", "irms_a", "i_rms_a", "rms_current_a",
        "a1_rms", "a1", "i1_rms1_2_max", "i1_rms", "i1", "i1_1_min", "a1rms"
    ),
    "current_phase_b": (
        "current_phase_b", "ib", "i_b", "phase_b_current", "irms_b", "i_rms_b", "rms_current_b",
        "a2_rms", "a2", "i2_rms1_2_max", "i2_rms", "i2", "i2_1_min", "a2rms"
    ),
    "current_phase_c": (
        "current_phase_c", "ic", "i_c", "phase_c_current", "irms_c", "i_rms_c", "rms_current_c",
        "a3_rms", "a3", "i3_rms1_2_max", "i3_rms", "i3", "i3_1_min", "a3rms"
    ),
    "kw": ("kw", "p_kw", "active_power", "power_kw", "p_out_kw", "p_t_w", "pt_w", "ep_1_min", "ep1_wh", "ept_wh", "p_w", "p_sum", "p_sum_avg", "p1_avg", "p1"),
    "kva": ("kva", "s_kva", "apparent_power", "skva", "s_t_va", "st_va", "es_1_min", "es_vah", "s_va"),
    "pf": ("pf", "power_factor", "cos_phi", "cosphi"),
    "frequency": ("frequency", "freq", "hz", "f_hz"),
    "vthd_a": ("vthd_a", "uthd_a", "thd_v_a", "thdv_a", "v_thd_a", "u12_thdf", "v1_thdf", "u1_thdf", "u12_h0", "u1_h0"),
    "vthd_b": ("vthd_b", "uthd_b", "thd_v_b", "thdv_b", "v_thd_b", "u23_thdf", "v2_thdf", "u2_thdf", "u23_h0", "u2_h0"),
    "vthd_c": ("vthd_c", "uthd_c", "thd_v_c", "thdv_c", "v_thd_c", "u31_thdf", "v3_thdf", "u3_thdf", "u31_h0", "u3_h0"),
    "ithd_a": ("ithd_a", "thd_i_a", "thdi_a", "i_thd_a", "a1_thdf", "i1_thdf", "a1_h0", "i1_h0"),
    "ithd_b": ("ithd_b", "thd_i_b", "thdi_b", "i_thd_b", "a2_thdf", "i2_thdf", "a2_h0", "i2_h0"),
    "ithd_c": ("ithd_c", "thd_i_c", "thdi_c", "i_thd_c", "a3_thdf", "i3_thdf", "a3_h0", "i3_h0"),
    "kvar": ("kvar", "q_kvar", "reactive_power", "q", "total_reactive_power", "q_t_var", "qt_var", "eq_1_min", "eq1_varh", "eqt_varh"),
    "nkvar": ("nkvar", "n_kvar", "non_active_power", "n", "n_var"),
    "dkvar": ("dkvar", "d_kvar", "distortion_power", "d", "d_t_var", "dt_var"),
    "dpf": ("dpf", "displacement_pf", "displacement_power_factor"),
}


def _invert_synonyms(extra: dict[str, tuple[str, ...]] | None = None) -> dict[str, str]:
    inverted: dict[str, str] = {}
    pools: dict[str, tuple[str, ...]] = {**BASE_SYNONYMS}
    if extra:
        for key, aliases in extra.items():
            pools[key] = pools.get(key, ()) + aliases
    for canonical, aliases in pools.items():
        for alias in aliases:
            inverted[slug_column(alias)] = canonical
    return inverted


def robust_to_datetime(series: pd.Series, utc: bool = False) -> pd.Series:
    """Robust conversion to datetime that handles DD-MM-YYYY vs YYYY-MM-DD correctly."""
    import re
    import pandas as pd
    str_series = series.astype(str).str.strip()
    sample = None
    for v in str_series:
        if pd.notna(v) and str(v) not in ("", "nan", "None", "NaT"):
            sample = str(v)
            break
    if not sample:
        return pd.to_datetime(series, errors="coerce", utc=utc)
    if re.match(r"^\d{4}", sample):
        return pd.to_datetime(series, errors="coerce", utc=utc, dayfirst=False)
    else:
        return pd.to_datetime(series, errors="coerce", utc=utc, dayfirst=True)


def guess_timestamp_series(df: pd.DataFrame) -> pd.Series | None:
    """Pick best-effort timestamp column or merge Date + Time."""
    mapping = {slug_column(c): c for c in df.columns}
    for key in ("timestamp", "datetime", "date_time"):
        if key in mapping:
            return robust_to_datetime(df[mapping[key]], utc=False)
    date_keys = ("date", "meas_date", "measurement_date")
    time_keys = ("time", "meas_time", "clock")
    date_col = next((mapping[k] for k in date_keys if k in mapping), None)
    time_col = next((mapping[k] for k in time_keys if k in mapping), None)
    if date_col and time_col:
        combo = df[date_col].astype(str).str.strip() + " " + df[time_col].astype(str).str.strip()
        return robust_to_datetime(combo, utc=False)
    if date_col:
        return robust_to_datetime(df[date_col], utc=False)
    if time_col:
        return robust_to_datetime(df[time_col], utc=False)
    return None


# Common physical-unit suffixes that vendors append to column names.
# When an exact-slug lookup fails, the resolver tries again with one of
# these stripped from the tail — so "P_sum_kW" / "S sum (kVA)" / "I1 (A)" /
# "U12 (V)" / "F (Hz)" all match their unit-less synonyms.
# Listed longest-first so e.g. "_kvar" is tried before "_var" / "_a".
_UNIT_SUFFIXES: tuple[str, ...] = (
    "_kvarh", "_kvar",
    "_kwh", "_kw",
    "_kva",
    "_varh", "_var",
    "_wh", "_va",
    "_w",
    "_hz",
    "_pct", "_percent",
    "_v",
    "_a",
)


class BasePQParser(ABC):
    vendor_key: str

    def __init__(self, extra_synonyms: dict[str, tuple[str, ...]] | None = None) -> None:
        self._synonym_map = _invert_synonyms(extra_synonyms)

    @abstractmethod
    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        raise NotImplementedError

    def _resolve_slug(self, slug: str) -> str | None:
        """Map a column slug to a canonical standard name.

        1. Exact match against the synonym map (fast path).
        2. Tail-strip a common unit suffix and try again.  This lets
           "p_sum_kw", "s_sum_kva", "i1_a", "u12_v", "f_hz" map to
           their unit-less synonyms ("p_sum"/"kw"/"i1"/"u12"/"f")
           without forcing every parser to enumerate the unit-tagged
           variants of every metric.
        """
        if slug in self._synonym_map:
            return self._synonym_map[slug]
        for suffix in _UNIT_SUFFIXES:
            if slug.endswith(suffix) and len(slug) > len(suffix):
                stripped = slug[: -len(suffix)].rstrip("_")
                if stripped and stripped in self._synonym_map:
                    return self._synonym_map[stripped]
        return None

    def _standard_frame(self, df: pd.DataFrame) -> pd.DataFrame:
        renamed: dict[str, pd.Series] = {}
        slug_map = {}
        for c in df.columns:
            slug = slug_column(c)
            if slug not in slug_map:
                slug_map[slug] = c

        ts = guess_timestamp_series(df)
        if ts is not None:
            renamed["timestamp"] = ts

        # Prefer slugs with "rms" or "avg" so that we pick Phase voltages (V1rms)
        # instead of Line-to-Line voltages (V1) if both are mapped to the same synonym.
        # Prefer U12/U23/U31 (Line-to-Line, ~430V) over V1/V2/V3 (Line-to-Neutral, ~250V)
        # because line-to-line is the standard for industrial PQ analysis.
        sorted_slugs = sorted(slug_map.items(), key=lambda x: (
            not ("u12" in x[0] or "u23" in x[0] or "u31" in x[0]),
            "rms" not in x[0],
            "avg" not in x[0]
        ))

        for slug, original in sorted_slugs:
            canonical = self._resolve_slug(slug)
            if canonical and canonical != "timestamp":
                # Preserve the first column matched per canonical name —
                # later duplicates are ignored so an exact-match wins over
                # a suffix-stripped fallback.
                if canonical not in renamed:
                    renamed[canonical] = pd.to_numeric(df[original], errors="coerce")

        out = pd.DataFrame(renamed)
        for col in STANDARD_COLUMNS:
            if col not in out.columns:
                out[col] = np.nan
        return out[list(STANDARD_COLUMNS)]


class GenericParser(BasePQParser):
    """CSV / loose vendor exports mapped purely via synonyms."""

    vendor_key = "generic"

    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        return self._standard_frame(df)
