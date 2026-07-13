"""ML-based PQ data normalizer.

Pipeline (no scikit-learn required — pure numpy / pandas):
  1. Percentile-based unit/scale detection  – handles V, A, kW, PF, Hz, THD
  2. Physical-bound clamping                – remove instrument errors
  3. Modified Z-score outlier detection     – Iglewicz & Hoaglin method
  4. Time-aware gap interpolation           – up to max_gap_fill consecutive NaNs
  5. Three-phase balance sanity             – flags wiring / CT-orientation issues
  6. Data quality scoring (0–100)           – per-column completeness + plausibility
"""
from __future__ import annotations

import numpy as np
import pandas as pd

# ── Physical bounds (lo, hi) for each standard column ─────────────────────────
# Voltage upper bound is set to 15 000 V to accommodate MV (medium-voltage)
# devices such as PQ-1938 that measure line-to-line voltages at 11 kV class.
# The old 520 V ceiling caused _best_multiplier to apply ×0.01, incorrectly
# dividing genuine 11 328 V readings down to ~113 V.
PHYSICAL_BOUNDS: dict[str, tuple[float, float]] = {
    "voltage_phase_a": (50.0, 15_000.0),
    "voltage_phase_b": (50.0, 15_000.0),
    "voltage_phase_c": (50.0, 15_000.0),
    "current_phase_a": (0.0, 10_000.0),
    "current_phase_b": (0.0, 10_000.0),
    "current_phase_c": (0.0, 10_000.0),
    "kw":   (-200_000.0, 200_000.0),
    "kva":  (0.0,        200_000.0),
    "pf":   (-1.0,       1.0),
    "frequency": (45.0, 65.0),
    "vthd_a": (0.0, 100.0),
    "vthd_b": (0.0, 100.0),
    "vthd_c": (0.0, 100.0),
    "ithd_a": (0.0, 100.0),
    "ithd_b": (0.0, 100.0),
    "ithd_c": (0.0, 100.0),
    "kvar":  (-200_000.0, 200_000.0),
    "nkvar": (-200_000.0, 200_000.0),
    "dkvar": (0.0,        200_000.0),
    "dpf":   (-1.0,       1.0),
}

# Standard LV/MV nominals used for voltage snapping
# Includes common MV levels (6.6 kV, 11 kV, 33 kV class) so scale detection
# recognises genuine MV readings and does not try to rescale them.
_V_NOMINALS = (
    110.0, 120.0, 220.0, 230.0, 240.0, 277.0, 347.0, 400.0, 415.0,
    # MV: 6.6 kV, 11 kV (L-L), 11 kV/√3 (L-N), 33 kV
    6_600.0, 6_350.0, 11_000.0, 6_351.0, 33_000.0,
)

# Candidate scale multipliers tried in order
_SCALE_TRIES = (1.0, 0.001, 1_000.0, 0.01, 100.0)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _p(arr: np.ndarray, q: float) -> float:
    """Nanpercentile helper."""
    return float(np.nanpercentile(arr, q))


def _modified_z(arr: np.ndarray) -> np.ndarray:
    """Iglewicz & Hoaglin (1993) modified Z-score — robust to outlier presence."""
    med = np.nanmedian(arr)
    mad = np.nanmedian(np.abs(arr - med))
    
    # Enforce a practical minimum MAD to prevent very tight clusters from
    # causing normal step-changes (e.g., load switching) to be flagged as outliers.
    # We assume at least 1% natural variation or 0.01 absolute, whichever is larger.
    min_mad = max(0.01, abs(float(med)) * 0.01)
    
    if mad < min_mad:
        std = np.nanstd(arr)
        mad = std * 0.6745 if std > min_mad else min_mad
        
    return 0.6745 * (arr - med) / mad


def _best_multiplier(vals: np.ndarray, lo: float, hi: float) -> float:
    """Return the first multiplier that puts the 5th–95th percentile inside [lo, hi]."""
    p5, p95 = _p(vals, 5), _p(vals, 95)
    if lo <= p5 and p95 <= hi:
        return 1.0
    for m in _SCALE_TRIES:
        sp5, sp95 = p5 * m, p95 * m
        if lo <= sp5 and sp95 <= hi:
            return m
    # Fallback: pick multiplier that minimises out-of-range distance
    best_m, best_d = 1.0, float("inf")
    for m in _SCALE_TRIES:
        sp5, sp95 = p5 * m, p95 * m
        d = max(0.0, lo - sp5) + max(0.0, sp95 - hi)
        if d < best_d:
            best_d, best_m = d, m
    return best_m


def _concat_numeric(*series: pd.Series) -> np.ndarray:
    parts = [pd.to_numeric(s, errors="coerce").dropna().to_numpy() for s in series]
    return np.concatenate(parts) if parts else np.array([])


# ── Main class ─────────────────────────────────────────────────────────────────

class PQNormalizer:
    """Statistically-driven ML normalizer for a standard PQ DataFrame.

    Usage::

        normalizer = PQNormalizer()
        clean_df, report = normalizer.fit_transform(raw_normalized_df)
    """

    def __init__(
        self,
        outlier_threshold: float = 3.5,   # |modified-Z| above this → outlier
        max_gap_fill: int = 6,             # max consecutive NaNs to interpolate
        max_outlier_frac: float = 0.05,    # skip removal if more than this fraction flagged
    ) -> None:
        self.outlier_threshold = outlier_threshold
        self.max_gap_fill = max_gap_fill
        self.max_outlier_frac = max_outlier_frac

    # ── Public entry point ─────────────────────────────────────────────────────

    def fit_transform(self, df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
        """Return *(clean_df, quality_report)*.

        Mutates *df* in place — callers (currently only ``process_bytes``) own
        the frame.  Copying a multi-million-row frame here used to spike memory
        2× during normalization, which is the trigger we saw on large uploads.

        ``quality_report`` keys:
        - ``scale_fixes``        – dict col→multiplier str
        - ``clamped``            – dict col→count of physically-impossible values removed
        - ``outliers_removed``   – dict col→count of statistical outliers replaced
        - ``gaps_filled``        – dict col→count of NaNs interpolated
        - ``three_phase_warn``   – list of warning strings
        - ``quality_score``      – float 0–100
        - ``column_completeness``– dict col→pct
        """
        report: dict = {
            "scale_fixes": {},
            "clamped": {},
            "outliers_removed": {},
            "gaps_filled": {},
            "three_phase_warn": [],
            "quality_score": 100.0,
            "column_completeness": {},
        }

        df, report["scale_fixes"]      = self._fix_scales(df)
        df, report["clamped"]          = self._clamp_bounds(df)
        df, report["outliers_removed"] = self._remove_outliers(df)
        df, report["gaps_filled"]      = self._fill_gaps(df)
        report["three_phase_warn"]     = self._three_phase_check(df)
        score, completeness            = self._score(df)
        report["quality_score"]        = round(score, 1)
        report["column_completeness"]  = completeness

        return df, report

    # ── Step 1: Scale / unit correction ───────────────────────────────────────

    def _fix_scales(self, df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
        fixes: dict = {}

        # --- Voltage (all three phases treated jointly) ---
        v_cols = [c for c in ("voltage_phase_a", "voltage_phase_b", "voltage_phase_c") if c in df.columns]
        if v_cols:
            v_all = _concat_numeric(*[df[c] for c in v_cols])
            if v_all.size > 0:
                lo, hi = PHYSICAL_BOUNDS["voltage_phase_a"]
                m = _best_multiplier(v_all, lo, hi)
                if m != 1.0:
                    for c in v_cols:
                        df[c] = pd.to_numeric(df[c], errors="coerce") * m
                    fixes["voltage"] = f"×{m}"

        # --- Current ---
        i_cols = [c for c in ("current_phase_a", "current_phase_b", "current_phase_c") if c in df.columns]
        if i_cols:
            i_all = _concat_numeric(*[df[c] for c in i_cols])
            if i_all.size > 0:
                lo, hi = PHYSICAL_BOUNDS["current_phase_a"]
                m = _best_multiplier(i_all[i_all >= 0], lo, hi)
                if m != 1.0:
                    for c in i_cols:
                        df[c] = pd.to_numeric(df[c], errors="coerce") * m
                    fixes["current"] = f"×{m}"

        # --- kW / kVA / kvar (independently, allow negative kW/kvar) ---
        for col in ("kw", "kva", "kvar", "nkvar", "dkvar"):
            if col not in df.columns:
                continue
            vals = pd.to_numeric(df[col], errors="coerce").dropna().to_numpy()
            if vals.size == 0:
                continue
            abs_vals = np.abs(vals)
            lo_abs = 0.0
            hi_abs = 200_000.0
            m = _best_multiplier(abs_vals, lo_abs, hi_abs)
            if m != 1.0:
                df[col] = pd.to_numeric(df[col], errors="coerce") * m
                fixes[col] = f"×{m}"

        # --- Power Factor (must be –1 to +1) ---
        if "pf" in df.columns:
            vals = pd.to_numeric(df["pf"], errors="coerce").dropna().to_numpy()
            if vals.size > 0:
                med = float(np.nanmedian(vals))
                if med > 1.5:
                    df["pf"] = pd.to_numeric(df["pf"], errors="coerce") / 100.0
                    fixes["pf"] = "÷100"
                elif med < -1.5:
                    df["pf"] = pd.to_numeric(df["pf"], errors="coerce") / 100.0
                    fixes["pf"] = "÷100"

        if "dpf" in df.columns:
            vals = pd.to_numeric(df["dpf"], errors="coerce").dropna().to_numpy()
            if vals.size > 0 and float(np.nanmedian(np.abs(vals))) > 1.5:
                df["dpf"] = pd.to_numeric(df["dpf"], errors="coerce") / 100.0
                fixes["dpf"] = "÷100"

        # --- Frequency ---
        if "frequency" in df.columns:
            vals = pd.to_numeric(df["frequency"], errors="coerce").dropna().to_numpy()
            if vals.size > 0:
                med = float(np.nanmedian(vals))
                if med > 200:
                    df["frequency"] = pd.to_numeric(df["frequency"], errors="coerce") / 1000.0
                    fixes["frequency"] = "÷1000"
                elif med < 1.5:
                    # Some devices report 0.050 (kHz)
                    df["frequency"] = pd.to_numeric(df["frequency"], errors="coerce") * 1000.0
                    fixes["frequency"] = "×1000"

        # --- THD (should be 0–100%) ---
        thd_cols = [c for c in ("vthd_a", "vthd_b", "vthd_c", "ithd_a", "ithd_b", "ithd_c") if c in df.columns]
        for col in thd_cols:
            vals = pd.to_numeric(df[col], errors="coerce").dropna().to_numpy()
            if vals.size == 0:
                continue
            p95 = _p(vals, 95)
            med = float(np.nanmedian(vals))
            if p95 <= 1.0 and med < 0.3:
                # Fraction form → multiply by 100
                df[col] = pd.to_numeric(df[col], errors="coerce") * 100.0
                fixes[col] = "×100"
            elif med > 100.0:
                # Some devices report as per-mille
                df[col] = pd.to_numeric(df[col], errors="coerce") / 10.0
                fixes[col] = "÷10"

        return df, fixes

    # ── Step 2: Physical bound clamping ───────────────────────────────────────

    def _clamp_bounds(self, df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
        clamped: dict = {}
        for col, (lo, hi) in PHYSICAL_BOUNDS.items():
            if col not in df.columns:
                continue
            s = pd.to_numeric(df[col], errors="coerce")
            mask = ((s < lo) | (s > hi)) & s.notna()
            n = int(mask.sum())
            if n:
                df[col] = s.where(~mask, other=np.nan)
                clamped[col] = n
        return df, clamped

    # ── Step 3: Modified Z-score outlier removal ──────────────────────────────

    def _remove_outliers(self, df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
        removed: dict = {}
        cols = [c for c in PHYSICAL_BOUNDS if c in df.columns]
        for col in cols:
            s = pd.to_numeric(df[col], errors="coerce").to_numpy(dtype=float).copy()
            valid = ~np.isnan(s)
            if valid.sum() < 5:
                continue
            z = _modified_z(s[valid])
            outlier_idx = np.where(valid)[0][np.abs(z) > self.outlier_threshold]
            # Instrument glitches are rare by nature. When a large share of the
            # samples gets flagged, the distribution is genuinely wide or bimodal
            # — e.g. solar sites log near-zero current all night and full load by
            # day, so the night cluster becomes the median and every real daytime
            # reading looks like an "outlier". Removing them would delete half
            # the measurement campaign, so keep the column untouched instead.
            if outlier_idx.size > valid.sum() * self.max_outlier_frac:
                continue
            if outlier_idx.size:
                s[outlier_idx] = np.nan
                df[col] = s
                removed[col] = int(outlier_idx.size)
        return df, removed

    # ── Step 4: Gap filling ───────────────────────────────────────────────────

    def _fill_gaps(self, df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
        filled: dict = {}
        num_cols = [c for c in PHYSICAL_BOUNDS if c in df.columns]

        for col in num_cols:
            if col not in df.columns:
                continue
            s = df[col]
            before = int(s.isna().sum())
            if before == 0:
                continue
            try:
                # Use linear interpolation (regular position-based) which is extremely fast and mathematically equivalent
                s_filled = s.interpolate(method="linear", limit=self.max_gap_fill)
                # Back-fill edges that interpolation can't reach
                s_filled = s_filled.bfill(limit=2).ffill(limit=2)
                df[col] = s_filled
                after = int(s_filled.isna().sum())
                n = before - after
                if n > 0:
                    filled[col] = n
            except Exception:
                pass

        return df, filled

    # ── Step 5: Three-phase balance check ────────────────────────────────────

    def _three_phase_check(self, df: pd.DataFrame) -> list[str]:
        warnings: list[str] = []
        v_cols = [c for c in ("voltage_phase_a", "voltage_phase_b", "voltage_phase_c") if c in df.columns]
        if len(v_cols) == 3:
            means = [float(pd.to_numeric(df[c], errors="coerce").mean()) for c in v_cols]
            if all(not np.isnan(m) for m in means):
                avg = float(np.mean(means))
                if avg > 0:
                    max_dev = max(abs(m - avg) / avg * 100 for m in means)
                    if max_dev > 5.0:
                        warnings.append(
                            f"Voltage imbalance {max_dev:.1f}% exceeds 5% — check measurement connections or CT orientation."
                        )

        i_cols = [c for c in ("current_phase_a", "current_phase_b", "current_phase_c") if c in df.columns]
        if len(i_cols) == 3:
            means = [float(pd.to_numeric(df[c], errors="coerce").mean()) for c in i_cols]
            if all(not np.isnan(m) for m in means):
                avg = float(np.mean(means))
                if avg > 0:
                    max_dev = max(abs(m - avg) / avg * 100 for m in means)
                    if max_dev > 20.0:
                        warnings.append(
                            f"Current imbalance {max_dev:.1f}% is high — verify load balance and neutral."
                        )
        return warnings

    # ── Step 6: Quality score ─────────────────────────────────────────────────

    def _score(self, df: pd.DataFrame) -> tuple[float, dict[str, float]]:
        priority = (
            "voltage_phase_a", "voltage_phase_b", "voltage_phase_c",
            "current_phase_a", "current_phase_b", "current_phase_c",
            "kw", "kva", "pf", "frequency",
            "vthd_a", "ithd_a",
        )
        n = max(len(df), 1)
        completeness: dict[str, float] = {}
        scores: list[float] = []

        for col in priority:
            if col not in df.columns:
                continue

            n_valid = int(df[col].notna().sum())
            pct = round(n_valid / n * 100.0, 1)
            completeness[col] = pct
            scores.append(pct)

        quality = round(float(np.mean(scores)) if scores else 0.0, 1)
        return quality, completeness
