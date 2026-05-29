from __future__ import annotations

import numpy as np
import pandas as pd

from models.schema import AnalyticsPayload, MetricBlock


def _col(df: pd.DataFrame, name: str) -> pd.Series:
    """Safely return a column, or an empty float Series if it doesn't exist."""
    return df[name] if name in df.columns else pd.Series(dtype=float)


def _metric_block(series: pd.Series) -> MetricBlock:
    s = pd.to_numeric(series, errors="coerce").dropna()
    if s.empty:
        return MetricBlock()
    arr = s.to_numpy(dtype=float)
    return MetricBlock(
        min=float(arr.min()),
        max=float(arr.max()),
        avg=float(arr.mean()),
        rms=float(np.sqrt(np.mean(np.square(arr)))),
    )


def _three_phase_imbalance_pct(
    df: pd.DataFrame,
    cols: tuple[str, str, str],
) -> float | None:
    if not all(c in df.columns for c in cols):
        return None
    slice_df = df.loc[:, list(cols)].apply(pd.to_numeric, errors="coerce").dropna(how="any")
    if slice_df.empty:
        return None
    avg = slice_df.mean(axis=1)
    valid = avg.replace(0, np.nan).dropna()
    if valid.empty:
        return None
    deviation = (slice_df.sub(avg, axis=0)).abs().max(axis=1)
    pct = deviation / avg.replace(0, np.nan) * 100.0
    return float(pct.mean(skipna=True))


def compute_analytics(df: pd.DataFrame) -> AnalyticsPayload:
    return AnalyticsPayload(
        voltage={
            "phase_a": _metric_block(_col(df, "voltage_phase_a")),
            "phase_b": _metric_block(_col(df, "voltage_phase_b")),
            "phase_c": _metric_block(_col(df, "voltage_phase_c")),
            "imbalance_pct": _three_phase_imbalance_pct(
                df,
                ("voltage_phase_a", "voltage_phase_b", "voltage_phase_c"),
            ),
        },
        current={
            "phase_a": _metric_block(_col(df, "current_phase_a")),
            "phase_b": _metric_block(_col(df, "current_phase_b")),
            "phase_c": _metric_block(_col(df, "current_phase_c")),
            "imbalance_pct": _three_phase_imbalance_pct(
                df,
                ("current_phase_a", "current_phase_b", "current_phase_c"),
            ),
        },
        kw=_metric_block(_col(df, "kw")),
        kva=_metric_block(_col(df, "kva")),
        pf=_metric_block(_col(df, "pf")),
        frequency=_metric_block(_col(df, "frequency")),
        vthd={
            "phase_a": _metric_block(_col(df, "vthd_a")),
            "phase_b": _metric_block(_col(df, "vthd_b")),
            "phase_c": _metric_block(_col(df, "vthd_c")),
        },
        ithd={
            "phase_a": _metric_block(_col(df, "ithd_a")),
            "phase_b": _metric_block(_col(df, "ithd_b")),
            "phase_c": _metric_block(_col(df, "ithd_c")),
        },
        kvar=_metric_block(_col(df, "kvar")),
        nkvar=_metric_block(_col(df, "nkvar")),
        dkvar=_metric_block(_col(df, "dkvar")),
        dpf=_metric_block(_col(df, "dpf")),
    )


def build_ai_observations(df: pd.DataFrame, analytics: AnalyticsPayload) -> list[str]:
    notes: list[str] = []
    pf_avg = analytics.pf.avg
    if pf_avg is not None:
        if pf_avg < 0.85:
            notes.append("Average power factor sits below 0.85 — investigate reactive compensation.")
        elif pf_avg > 0.98:
            notes.append("Power factor is strongly elevated — validate PF column scaling.")

    v_imb = analytics.voltage.get("imbalance_pct") if isinstance(analytics.voltage, dict) else None
    if isinstance(v_imb, float) and v_imb > 2.0:
        notes.append(f"Voltage imbalance averaging {v_imb:.2f}% exceeds typical 2% advisory.")

    i_imb = analytics.current.get("imbalance_pct") if isinstance(analytics.current, dict) else None
    if isinstance(i_imb, float) and i_imb > 10.0:
        notes.append("Current imbalance is elevated — check loading and neutral path.")

    freq_avg = analytics.frequency.avg
    if freq_avg is not None:
        if freq_avg < 49 or freq_avg > 61:
            notes.append(
                "Frequency excursions versus nominal envelopes — verify analyzer nominal selection.",
            )

    vals = [
        analytics.vthd["phase_a"].avg,
        analytics.vthd["phase_b"].avg,
        analytics.vthd["phase_c"].avg,
    ]
    clean = [float(v) for v in vals if v is not None]
    vthd_avg = float(np.mean(clean)) if clean else float("nan")
    if not np.isnan(vthd_avg) and vthd_avg > 5:
        notes.append("Average voltage THD exceeds 5% — schedule harmonic mitigation review.")

    if not notes:
        notes.append("Waveforms appear within coarse heuristic thresholds — continue trending over time.")
    return notes
