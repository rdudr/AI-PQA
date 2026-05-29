"""Summary statistics and tables for PQ analysis."""
from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd

from models.schema import MetricBlock


@dataclass
class SummaryTable:
    """Represents a summary statistics table."""
    title: str
    rows: list[dict[str, str | float | None]]


def compute_metric_block(series: pd.Series) -> MetricBlock:
    """Compute min, max, avg, rms for a series."""
    s = pd.to_numeric(series, errors="coerce").dropna()
    if s.empty:
        return MetricBlock()
    arr = s.to_numpy(dtype=float)
    return MetricBlock(
        min=float(np.nanmin(arr)) if arr.size > 0 else None,
        max=float(np.nanmax(arr)) if arr.size > 0 else None,
        avg=float(np.nanmean(arr)) if arr.size > 0 else None,
        rms=float(np.sqrt(np.nanmean(np.square(arr)))) if arr.size > 0 else None,
    )


def voltage_summary_table(df: pd.DataFrame) -> SummaryTable:
    """Generate voltage summary table."""
    rows = []
    
    for phase, col in [
        ("Phase A", "voltage_phase_a"),
        ("Phase B", "voltage_phase_b"),
        ("Phase C", "voltage_phase_c"),
    ]:
        if col in df.columns:
            metrics = compute_metric_block(df[col])
            rows.append({
                "parameter": phase,
                "min": metrics.min,
                "max": metrics.max,
                "avg": metrics.avg,
                "rms": metrics.rms,
                "unit": "V",
            })
    
    return SummaryTable(title="Voltage Summary", rows=rows)


def current_summary_table(df: pd.DataFrame) -> SummaryTable:
    """Generate current summary table."""
    rows = []
    
    for phase, col in [
        ("Phase A", "current_phase_a"),
        ("Phase B", "current_phase_b"),
        ("Phase C", "current_phase_c"),
    ]:
        if col in df.columns:
            metrics = compute_metric_block(df[col])
            rows.append({
                "parameter": phase,
                "min": metrics.min,
                "max": metrics.max,
                "avg": metrics.avg,
                "rms": metrics.rms,
                "unit": "A",
            })
    
    return SummaryTable(title="Current Summary", rows=rows)


def power_summary_table(df: pd.DataFrame) -> SummaryTable:
    """Generate power summary table (kW, kVA, PF)."""
    rows = []
    
    for param, col, unit in [
        ("Active Power (kW)", "kw", "kW"),
        ("Apparent Power (kVA)", "kva", "kVA"),
        ("Power Factor", "pf", ""),
    ]:
        if col in df.columns:
            metrics = compute_metric_block(df[col])
            rows.append({
                "parameter": param,
                "min": metrics.min,
                "max": metrics.max,
                "avg": metrics.avg,
                "rms": metrics.rms,
                "unit": unit,
            })
    
    return SummaryTable(title="Power Summary", rows=rows)


def thd_summary_table(df: pd.DataFrame) -> SummaryTable:
    """Generate THD summary table."""
    rows = []
    
    # Voltage THD
    for phase, col in [
        ("V-THD Phase A", "vthd_a"),
        ("V-THD Phase B", "vthd_b"),
        ("V-THD Phase C", "vthd_c"),
    ]:
        if col in df.columns:
            metrics = compute_metric_block(df[col])
            rows.append({
                "parameter": phase,
                "min": metrics.min,
                "max": metrics.max,
                "avg": metrics.avg,
                "rms": metrics.rms,
                "unit": "%",
            })
    
    # Current THD
    for phase, col in [
        ("I-THD Phase A", "ithd_a"),
        ("I-THD Phase B", "ithd_b"),
        ("I-THD Phase C", "ithd_c"),
    ]:
        if col in df.columns:
            metrics = compute_metric_block(df[col])
            rows.append({
                "parameter": phase,
                "min": metrics.min,
                "max": metrics.max,
                "avg": metrics.avg,
                "rms": metrics.rms,
                "unit": "%",
            })
    
    return SummaryTable(title="THD Summary", rows=rows)


def harmonics_table(harmonics_data: list[dict]) -> SummaryTable:
    """Generate harmonics order table from harmonic spectrum."""
    rows = []
    
    for harmonic in harmonics_data:
        rows.append({
            "order": harmonic.get("order"),
            "magnitude_pct": harmonic.get("magnitude_pct"),
        })
    
    return SummaryTable(title="Harmonic Spectrum", rows=rows)


def frequency_summary_table(df: pd.DataFrame) -> SummaryTable:
    """Generate frequency summary table."""
    rows = []
    
    if "frequency" in df.columns:
        metrics = compute_metric_block(df["frequency"])
        rows.append({
            "parameter": "Frequency",
            "min": metrics.min,
            "max": metrics.max,
            "avg": metrics.avg,
            "rms": metrics.rms,
            "unit": "Hz",
        })
    
    return SummaryTable(title="Frequency Summary", rows=rows)


def all_summary_tables(df: pd.DataFrame, harmonics_data: list[dict]) -> dict[str, SummaryTable]:
    """Generate all summary tables."""
    return {
        "voltage": voltage_summary_table(df),
        "current": current_summary_table(df),
        "power": power_summary_table(df),
        "thd": thd_summary_table(df),
        "frequency": frequency_summary_table(df),
        "harmonics": harmonics_table(harmonics_data),
    }


def format_summary_table_for_json(table: SummaryTable) -> dict:
    """Convert summary table to JSON-serializable format."""
    return {
        "title": table.title,
        "rows": table.rows,
    }
