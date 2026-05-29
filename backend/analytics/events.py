"""Event detection and anomaly identification for PQ analysis."""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

import numpy as np
import pandas as pd

from models.schema import DipSwellEvent


class EventSeverity(str, Enum):
    """Event severity levels."""
    critical = "critical"
    warning = "warning"
    info = "info"


class EventType(str, Enum):
    """Types of PQ events."""
    voltage_dip = "voltage_dip"
    voltage_swell = "voltage_swell"
    voltage_transient = "voltage_transient"
    thd_exceed = "thd_exceed"
    pf_violation = "pf_violation"
    frequency_abnormality = "frequency_abnormality"
    current_spike = "current_spike"
    imbalance_exceed = "imbalance_exceed"


@dataclass
class PQEvent:
    """Represents a detected PQ event."""
    timestamp: str | None
    event_type: EventType
    severity: EventSeverity
    phase: str | None
    value: float | None
    threshold: float | None
    message: str


def detect_voltage_dips(
    df: pd.DataFrame,
    nominal_voltage: float = 230.0,
    dip_threshold: float = 0.90,
) -> list[PQEvent]:
    """Detect voltage dips (RMS drops below threshold)."""
    events: list[PQEvent] = []
    
    timestamps = None
    if "timestamp" in df.columns:
        timestamps = df["timestamp"].astype(str).to_numpy()

    for phase, col in [
        ("A", "voltage_phase_a"),
        ("B", "voltage_phase_b"),
        ("C", "voltage_phase_c"),
    ]:
        if col not in df.columns:
            continue
        
        series = pd.to_numeric(df[col], errors="coerce").to_numpy()
        dip_limit = nominal_voltage * dip_threshold
        indices = np.where(series < dip_limit)[0]
        if len(indices) > 1000:
            indices = indices[:1000]
        
        for idx in indices:
            timestamp = timestamps[idx] if timestamps is not None else None
            val = float(series[idx])
            events.append(
                PQEvent(
                    timestamp=timestamp,
                    event_type=EventType.voltage_dip,
                    severity=EventSeverity.warning,
                    phase=phase,
                    value=val,
                    threshold=dip_limit,
                    message=f"Voltage dip on phase {phase}: {val:.2f}V (threshold: {dip_limit:.2f}V)",
                )
            )
    
    return events


def detect_voltage_swells(
    df: pd.DataFrame,
    nominal_voltage: float = 230.0,
    swell_threshold: float = 1.10,
) -> list[PQEvent]:
    """Detect voltage swells (RMS rises above threshold)."""
    events: list[PQEvent] = []
    
    timestamps = None
    if "timestamp" in df.columns:
        timestamps = df["timestamp"].astype(str).to_numpy()

    for phase, col in [
        ("A", "voltage_phase_a"),
        ("B", "voltage_phase_b"),
        ("C", "voltage_phase_c"),
    ]:
        if col not in df.columns:
            continue
        
        series = pd.to_numeric(df[col], errors="coerce").to_numpy()
        swell_limit = nominal_voltage * swell_threshold
        indices = np.where(series > swell_limit)[0]
        if len(indices) > 1000:
            indices = indices[:1000]
        
        for idx in indices:
            timestamp = timestamps[idx] if timestamps is not None else None
            val = float(series[idx])
            events.append(
                PQEvent(
                    timestamp=timestamp,
                    event_type=EventType.voltage_swell,
                    severity=EventSeverity.warning,
                    phase=phase,
                    value=val,
                    threshold=swell_limit,
                    message=f"Voltage swell on phase {phase}: {val:.2f}V (threshold: {swell_limit:.2f}V)",
                )
            )
    
    return events


def detect_thd_violations(
    df: pd.DataFrame,
    vthd_limit: float = 5.0,
    ithd_limit: float = 20.0,
) -> list[PQEvent]:
    """Detect THD (Total Harmonic Distortion) violations."""
    events: list[PQEvent] = []
    
    timestamps = None
    if "timestamp" in df.columns:
        timestamps = df["timestamp"].astype(str).to_numpy()

    for phase, col in [
        ("A", "vthd_a"),
        ("B", "vthd_b"),
        ("C", "vthd_c"),
    ]:
        if col in df.columns:
            series = pd.to_numeric(df[col], errors="coerce").to_numpy()
            indices = np.where(series > vthd_limit)[0]
            if len(indices) > 1000:
                indices = indices[:1000]
            
            for idx in indices:
                timestamp = timestamps[idx] if timestamps is not None else None
                val = float(series[idx])
                events.append(
                    PQEvent(
                        timestamp=timestamp,
                        event_type=EventType.thd_exceed,
                        severity=EventSeverity.warning,
                        phase=f"V{phase}",
                        value=val,
                        threshold=vthd_limit,
                        message=f"Voltage THD on phase {phase}: {val:.2f}% (limit: {vthd_limit:.2f}%)",
                    )
                )
    
    for phase, col in [
        ("A", "ithd_a"),
        ("B", "ithd_b"),
        ("C", "ithd_c"),
    ]:
        if col in df.columns:
            series = pd.to_numeric(df[col], errors="coerce").to_numpy()
            indices = np.where(series > ithd_limit)[0]
            if len(indices) > 1000:
                indices = indices[:1000]
            
            for idx in indices:
                timestamp = timestamps[idx] if timestamps is not None else None
                val = float(series[idx])
                events.append(
                    PQEvent(
                        timestamp=timestamp,
                        event_type=EventType.thd_exceed,
                        severity=EventSeverity.info,
                        phase=f"I{phase}",
                        value=val,
                        threshold=ithd_limit,
                        message=f"Current THD on phase {phase}: {val:.2f}% (limit: {ithd_limit:.2f}%)",
                    )
                )
    
    return events


def detect_pf_violations(
    df: pd.DataFrame,
    pf_limit: float = 0.85,
) -> list[PQEvent]:
    """Detect power factor violations."""
    events: list[PQEvent] = []
    
    if "pf" not in df.columns:
        return events
    
    timestamps = None
    if "timestamp" in df.columns:
        timestamps = df["timestamp"].astype(str).to_numpy()

    series = pd.to_numeric(df["pf"], errors="coerce").to_numpy()
    indices = np.where(series < pf_limit)[0]
    if len(indices) > 1000:
        indices = indices[:1000]
    
    for idx in indices:
        timestamp = timestamps[idx] if timestamps is not None else None
        val = float(series[idx])
        events.append(
            PQEvent(
                timestamp=timestamp,
                event_type=EventType.pf_violation,
                severity=EventSeverity.warning,
                phase=None,
                value=val,
                threshold=pf_limit,
                message=f"Low power factor: {val:.3f} (minimum: {pf_limit:.3f})",
            )
        )
    
    return events


def detect_frequency_abnormalities(
    df: pd.DataFrame,
    nominal_freq: float = 50.0,
    freq_tolerance: float = 1.0,
) -> list[PQEvent]:
    """Detect frequency deviations."""
    events: list[PQEvent] = []
    
    if "frequency" not in df.columns:
        return events
    
    timestamps = None
    if "timestamp" in df.columns:
        timestamps = df["timestamp"].astype(str).to_numpy()

    series = pd.to_numeric(df["frequency"], errors="coerce").to_numpy()
    freq_min = nominal_freq - freq_tolerance
    freq_max = nominal_freq + freq_tolerance
    
    indices = np.where((series < freq_min) | (series > freq_max))[0]
    if len(indices) > 1000:
        indices = indices[:1000]
    
    for idx in indices:
        timestamp = timestamps[idx] if timestamps is not None else None
        val = float(series[idx])
        events.append(
            PQEvent(
                timestamp=timestamp,
                event_type=EventType.frequency_abnormality,
                severity=EventSeverity.info,
                phase=None,
                value=val,
                threshold=nominal_freq,
                message=f"Frequency deviation: {val:.3f} Hz (nominal: {nominal_freq:.3f} Hz ±{freq_tolerance:.3f})",
            )
        )
    
    return events


def detect_current_spikes(
    df: pd.DataFrame,
    spike_percentile: float = 95.0,
) -> list[PQEvent]:
    """Detect current spikes (outliers)."""
    events: list[PQEvent] = []
    
    timestamps = None
    if "timestamp" in df.columns:
        timestamps = df["timestamp"].astype(str).to_numpy()

    for phase, col in [
        ("A", "current_phase_a"),
        ("B", "current_phase_b"),
        ("C", "current_phase_c"),
    ]:
        if col not in df.columns:
            continue
        
        series_pd = pd.to_numeric(df[col], errors="coerce")
        if series_pd.empty:
            continue
        
        threshold = series_pd.quantile(spike_percentile / 100.0)
        series = series_pd.to_numpy()
        indices = np.where(series > threshold)[0]
        if len(indices) > 1000:
            indices = indices[:1000]
        
        for idx in indices:
            timestamp = timestamps[idx] if timestamps is not None else None
            val = float(series[idx])
            events.append(
                PQEvent(
                    timestamp=timestamp,
                    event_type=EventType.current_spike,
                    severity=EventSeverity.info,
                    phase=phase,
                    value=val,
                    threshold=threshold,
                    message=f"Current spike on phase {phase}: {val:.2f}A (threshold: {threshold:.2f}A)",
                )
            )
    
    return events


def detect_all_events(df: pd.DataFrame) -> list[PQEvent]:
    """Detect all PQ events in dataset."""
    events: list[PQEvent] = []

    events.extend(detect_voltage_dips(df))
    events.extend(detect_voltage_swells(df))
    events.extend(detect_thd_violations(df))
    events.extend(detect_pf_violations(df))
    events.extend(detect_frequency_abnormalities(df))
    events.extend(detect_current_spikes(df))

    if events and events[0].timestamp:
        try:
            events.sort(key=lambda e: e.timestamp or "", reverse=True)
        except (ValueError, TypeError):
            pass

    return events


# ---------------------------------------------------------------------------
# Dip & Swell monitoring
# ---------------------------------------------------------------------------

_STANDARD_NOMINALS = (110.0, 120.0, 220.0, 230.0, 240.0, 277.0, 347.0, 400.0)


def _detect_nominal_voltage(df: pd.DataFrame) -> float:
    """Estimate nominal voltage from the median of all three phase columns."""
    all_vals: list[float] = []
    for col in ("voltage_phase_a", "voltage_phase_b", "voltage_phase_c"):
        if col in df.columns:
            s = pd.to_numeric(df[col], errors="coerce").dropna()
            all_vals.extend(s.tolist())
    if not all_vals:
        return 230.0
    median = float(np.median(all_vals))
    # Snap to the nearest standard LV nominal within 15 %
    best = min(_STANDARD_NOMINALS, key=lambda n: abs(median - n))
    if abs(median - best) / best < 0.15:
        return best
    return round(median, 1)


def build_dip_swell_monitoring(
    df: pd.DataFrame,
    nominal_voltage: float | None = None,
    dip_threshold: float = 0.90,
    swell_threshold: float = 1.10,
) -> tuple[list[DipSwellEvent], float]:
    """Return (dip_swell_events, nominal_voltage_used).

    Events are sampled: at most one per consecutive run of dip/swell samples
    per phase, so the list stays manageable for the frontend scatter chart.
    """
    if nominal_voltage is None:
        nominal_voltage = _detect_nominal_voltage(df)

    dip_limit = nominal_voltage * dip_threshold
    swell_limit = nominal_voltage * swell_threshold

    events: list[DipSwellEvent] = []

    # Pre-convert timestamps to numpy array for super fast retrieval
    timestamps = None
    if "timestamp" in df.columns:
        timestamps = df["timestamp"].astype(str).to_numpy()

    for phase, col in (("A", "voltage_phase_a"), ("B", "voltage_phase_b"), ("C", "voltage_phase_c")):
        if col not in df.columns:
            continue
        
        # Convert series to numpy array for super-fast iteration
        vals = pd.to_numeric(df[col], errors="coerce").to_numpy()
        n_vals = len(vals)

        in_event = False
        event_vals: list[float] = []
        event_ts: str | None = None
        event_type = ""

        def _flush(vals: list[float], ts: str | None, etype: str) -> None:
            if not vals:
                return
            worst = min(vals) if etype == "dip" else max(vals)
            deviation = abs(nominal_voltage - worst) / nominal_voltage * 100.0
            if etype == "dip":
                sev = "severe" if deviation > 30 else "major" if deviation > 10 else "minor"
            else:
                sev = "severe" if deviation > 20 else "minor"
            events.append(
                DipSwellEvent(
                    timestamp=ts,
                    event_type=etype,
                    phase=phase,
                    value_v=round(worst, 3),
                    nominal_v=nominal_voltage,
                    depth_pct=round(deviation, 3),
                    severity=sev,
                )
            )

        for idx in range(n_vals):
            val = vals[idx]
            if np.isnan(val):
                if in_event:
                    _flush(event_vals, event_ts, event_type)
                    in_event, event_vals = False, []
                continue

            is_dip = val < dip_limit
            is_swell = val > swell_limit
            cur_type = "dip" if is_dip else ("swell" if is_swell else "")

            if cur_type and cur_type == event_type:
                event_vals.append(float(val))
            else:
                if in_event:
                    _flush(event_vals, event_ts, event_type)
                if cur_type:
                    in_event = True
                    event_type = cur_type
                    event_vals = [float(val)]
                    event_ts = str(timestamps[idx]) if timestamps is not None else None
                else:
                    in_event, event_vals, event_type = False, [], ""

        if in_event:
            _flush(event_vals, event_ts, event_type)

    events.sort(key=lambda e: e.timestamp or "")
    return events, nominal_voltage
