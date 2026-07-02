from __future__ import annotations

import gc
import uuid
import re

import numpy as np
import pandas as pd

from analytics.engine import build_ai_observations, compute_analytics
from analytics.events import build_dip_swell_monitoring
from ml.normalizer import PQNormalizer
from models.schema import AuditMetadata, DataQualityReport, HarmonicSpectrumPoint, PQRow, ProcessResponse
from parsers.base import slug_column
from parsers.registry import get_parser
from services import db
from services.config_store import get_custom_columns, get_mappings
from services.session_store import session_store
from utils.io import load_dataframe

MAX_RETURN_ROWS = 250000
_POWER_COLUMN_PATTERN = re.compile(r"(^|_)(nkvar|dkvar|kvar|kva|kw)(_|$)")


def _generate_harmonic_spectrum(df: pd.DataFrame, is_current: bool = False) -> list[HarmonicSpectrumPoint]:
    # 1. Search for actual harmonic columns in the dataframe
    has_any_actual_harmonics = False
    for col in df.columns:
        col_lower = str(col).lower()
        if "%fh" in col_lower:
            has_any_actual_harmonics = True
            break
        # also match h followed by digits
        if col_lower.startswith("h") and col_lower[1:].isdigit():
            has_any_actual_harmonics = True
            break

    if has_any_actual_harmonics:
        points = []
        for o in range(3, 26, 2):
            matched_cols = []
            suffix_pct_fh = f"%fh{o:02d}"
            suffix_pct_fh_short = f"%fh{o}"
            for col in df.columns:
                col_lower = str(col).lower()
                if is_current:
                    # Current columns: start with a, contain %fh03 or %fh3
                    if col_lower.startswith("a") and (suffix_pct_fh in col_lower or suffix_pct_fh_short in col_lower):
                        matched_cols.append(col)
                    elif f"h{o}_i" in col_lower or f"i_h{o}" in col_lower:
                        matched_cols.append(col)
                else:
                    # Voltage columns: start with u or v, contain %fh03 or %fh3
                    if (col_lower.startswith("u") or col_lower.startswith("v")) and (suffix_pct_fh in col_lower or suffix_pct_fh_short in col_lower):
                        matched_cols.append(col)
                    elif f"h{o}_v" in col_lower or f"v_h{o}" in col_lower or f"u_h{o}" in col_lower:
                        matched_cols.append(col)
                # Generic fallback if no match yet
                if not matched_cols and (col_lower == f"h{o}" or col_lower == f"h{o:02d}"):
                    matched_cols.append(col)

            # Deduplicate
            matched_cols = list(set(matched_cols))
            if matched_cols:
                means = []
                for col in matched_cols:
                    try:
                        val = pd.to_numeric(df[col], errors="coerce").mean()
                        if not np.isnan(val):
                            means.append(float(val))
                    except Exception:
                        pass
                avg_val = float(np.mean(means)) if means else 0.0
                points.append(HarmonicSpectrumPoint(order=o, magnitude_pct=avg_val))
            else:
                points.append(HarmonicSpectrumPoint(order=o, magnitude_pct=0.0))
        return points

    # 2. Fallback to THD-based simulation
    if is_current:
        target_cols = {"ithd_a", "ithd_b", "ithd_c", "thd_i_a", "thdi_a", "i_thd_a"}
    else:
        target_cols = {"vthd_a", "vthd_b", "vthd_c", "uthd_a", "thd_v_a", "thdv_a", "v_thd_a"}
        
    cols = [c for c in df.columns if slug_column(c) in target_cols]
    
    if cols:
        numeric = df.loc[:, cols].apply(pd.to_numeric, errors="coerce")
        vals = numeric.to_numpy(dtype=float).ravel()
        vals = vals[~np.isnan(vals)]
        avg_thd = float(vals.mean()) if vals.size else (15.0 if is_current else 3.0)
    else:
        avg_thd = 15.0 if is_current else 3.0
        
    return [
        HarmonicSpectrumPoint(
            order=o,
            magnitude_pct=max(0.1, avg_thd / (o * 0.8)),
        )
        for o in range(3, 26, 2) # Typically odd harmonics matter most in industrial power
    ]


def _sample_evenly(df: pd.DataFrame, max_rows: int) -> pd.DataFrame:
    if len(df) <= max_rows:
        return df
    idx = np.linspace(0, len(df) - 1, max_rows).astype(int)
    return df.iloc[idx].reset_index(drop=True)


def _scale_power_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Convert power columns from base units to k-units before normalization.

    Any future PQ power column that uses the standard power tokens in its name
    (for example kw, kva, kvar, nkvar, dkvar) will be scaled automatically.

    Mutates *df* in place to avoid copying large frames — callers should pass a
    dataframe they own (`process_bytes` does, and the Excel-download route just
    built it locally).
    """
    for col in df.columns:
        if _POWER_COLUMN_PATTERN.search(str(col).lower()):
            df[col] = pd.to_numeric(df[col], errors="coerce") / 1000.0
    return df


# Device models that are single-phase loggers and require voltage to be
# multiplied by √3 (1.732) to convert VLN (phase-to-neutral) → VLL (line-to-line).
_SINGLE_PHASE_LOGGER_MODELS = {"km 2400", "km2400"}

_SQRT3 = 1.7320508075688772   # math.sqrt(3)

_V_COLUMNS = ("voltage_phase_a", "voltage_phase_b", "voltage_phase_c")


def _apply_device_voltage_multiplier(df: pd.DataFrame, pq_analyzer_type: str) -> pd.DataFrame:
    """Apply a ×√3 multiplier to voltage columns for single-phase logger devices.

    KM 2400 (and similar single-phase loggers) record the phase-to-neutral
    voltage (VLN).  Industrial PQ analysis and the dashboard voltage graph
    always display line-to-line voltage (VLL = VLN × √3).  This step converts
    the stored values so all downstream code sees VLL, just like a proper
    three-phase analyser would export.
    """
    slug = "".join(ch for ch in str(pq_analyzer_type).strip().lower() if ch.isalnum() or ch == " ").strip()
    if slug not in _SINGLE_PHASE_LOGGER_MODELS:
        return df

    v_cols = [c for c in _V_COLUMNS if c in df.columns]
    for c in v_cols:
        df[c] = pd.to_numeric(df[c], errors="coerce") * _SQRT3

    return df



def _rows_from_df(df: pd.DataFrame) -> list[PQRow]:
    # Normalize Excel serial date/time columns before any other processing
    from routes.upload import _normalize_date_time_cols
    df = _normalize_date_time_cols(df.copy())
    tmp = df

    if "timestamp" in tmp.columns:
        ts = pd.to_datetime(tmp["timestamp"], errors="coerce")
        valid_ts = ts.notna()
        if valid_ts.any():
            tmp = tmp.copy()
            tmp.loc[valid_ts, "timestamp"] = ts[valid_ts].dt.strftime("%Y-%m-%d %H:%M:%S")
    # Convert remaining datetime columns to strings
    for col in tmp.columns:
        if col in ("timestamp", "date", "time"):
            continue
        if pd.api.types.is_datetime64_any_dtype(tmp[col]):
            tmp = tmp.copy()
            tmp[col] = tmp[col].dt.strftime("%Y-%m-%d %H:%M:%S")
    records = tmp.replace({np.nan: None}).to_dict(orient="records")
    out: list[PQRow] = []
    for rec in records:
        out.append(PQRow.model_validate(rec))
    return out


def process_bytes(filename: str, raw: bytes, metadata: AuditMetadata) -> ProcessResponse:
    # If the user has configured mappings for this model, use those instead of the
    # built-in parser. This makes the dashboard data identical to the normalized
    # Excel export — same columns, same names, same source pages.
    normalized = None
    user_mappings = get_mappings(metadata.pq_analyzer_type)
    user_custom_cols = get_custom_columns(metadata.pq_analyzer_type)
    if user_mappings or user_custom_cols:
        try:
            # Local import to avoid circular dependency at module load
            from routes.upload import _apply_mappings_to_dataframe, _read_all_pages_for_mapping
            pages = _read_all_pages_for_mapping(filename, raw)
            if pages:
                normalized = _apply_mappings_to_dataframe(
                    pages,
                    user_mappings,
                    source_pages=None,
                    custom_cols=user_custom_cols,
                )
            # Free the per-sheet dataframes — on a 100MB file these can hold
            # hundreds of MB that we no longer need after `_apply_mappings_to_dataframe`.
            del pages
            gc.collect()
        except Exception:
            normalized = None  # fall back to built-in parser below

    if normalized is None:
        raw_df = load_dataframe(filename, raw)
        parser = get_parser(metadata.pq_analyzer_type)
        normalized = parser.normalize(raw_df)
        del raw_df
        gc.collect()

    # Free the raw bytes — we no longer need them after parsing
    del raw

    normalized = _scale_power_columns(normalized)
    normalized = _apply_device_voltage_multiplier(normalized, metadata.pq_analyzer_type)


    normalized = normalized.dropna(how="all")
    if normalized.empty:
        raise ValueError("No recognizable PQ measurements after normalization.")

    if "kvar" not in normalized.columns or normalized["kvar"].isna().all():
        if "kw" in normalized.columns and "kva" in normalized.columns:
            # Q = sqrt(S^2 - P^2)
            s_sq = normalized["kva"] ** 2
            p_sq = normalized["kw"] ** 2
            # Handle potential floating point issues where P > S due to rounding
            q_sq = np.maximum(0, s_sq - p_sq)
            normalized["kvar"] = np.sqrt(q_sq)

    # ── ML normalization: scale fix → clamp → outlier removal → gap fill ──
    normalizer = PQNormalizer()
    normalized, quality_report = normalizer.fit_transform(normalized)
    data_quality = DataQualityReport(**quality_report)

    analytics = compute_analytics(normalized)
    observations = build_ai_observations(normalized, analytics)
    dip_swell_events, nominal_v = build_dip_swell_monitoring(normalized)

    sampled = _sample_evenly(normalized, MAX_RETURN_ROWS)
    rows = _rows_from_df(sampled)

    # Extract harmonic spectrum from fully normalized dataframe
    v_spectrum = _generate_harmonic_spectrum(normalized, is_current=False)
    i_spectrum = _generate_harmonic_spectrum(normalized, is_current=True)

    session_id = str(uuid.uuid4())
    session_store.put(session_id, normalized)

    response = ProcessResponse(
        session_id=session_id,
        metadata=metadata,
        filename=filename,
        total_rows=int(len(normalized)),
        returned_rows=len(rows),
        rows=rows,
        columns=[str(c) for c in normalized.columns],
        analytics=analytics,
        voltage_harmonic_spectrum=v_spectrum,
        current_harmonic_spectrum=i_spectrum,
        ai_observations=observations,
        nominal_voltage=nominal_v,
        dip_swell_events=dip_swell_events,
        data_quality=data_quality,
    )

    # Persist the full summary for the central history (no-op without DATABASE_URL).
    db.save_summary(response.model_dump())

    return response


def process_multiple_files(files_data: list[dict], metadata: AuditMetadata) -> ProcessResponse:
    import gc
    parsed_dfs = []
    device_transitions = []

    # Parse each file
    for entry in files_data:
        filename = entry["filename"]
        raw = entry["raw_bytes"]
        model_name = entry["model_name"]

        normalized = None
        user_mappings = get_mappings(model_name)
        user_custom_cols = get_custom_columns(model_name)
        if user_mappings or user_custom_cols:
            try:
                from routes.upload import _apply_mappings_to_dataframe, _read_all_pages_for_mapping
                pages = _read_all_pages_for_mapping(filename, raw)
                if pages:
                    normalized = _apply_mappings_to_dataframe(
                        pages,
                        user_mappings,
                        source_pages=None,
                        custom_cols=user_custom_cols,
                    )
                del pages
                gc.collect()
            except Exception:
                normalized = None

        if normalized is None:
            raw_df = load_dataframe(filename, raw)
            parser = get_parser(model_name)
            normalized = parser.normalize(raw_df)
            del raw_df
            gc.collect()

        del raw

        normalized = _scale_power_columns(normalized)
        normalized = _apply_device_voltage_multiplier(normalized, model_name)
        normalized = normalized.dropna(how="all")

        if not normalized.empty:
            # Sort individual file timestamps
            if "timestamp" in normalized.columns:
                from parsers.base import robust_to_datetime
                normalized["_dt"] = robust_to_datetime(normalized["timestamp"])
                normalized = normalized.dropna(subset=["_dt"]).sort_values("_dt")
                if not normalized.empty:
                    start_t = normalized["timestamp"].iloc[0]
                    end_t = normalized["timestamp"].iloc[-1]
                    device_transitions.append({
                        "file": filename,
                        "model": model_name,
                        "start": str(start_t),
                        "end": str(end_t)
                    })
                normalized = normalized.drop(columns=["_dt"], errors="ignore")
            parsed_dfs.append(normalized)

    if not parsed_dfs:
        raise ValueError("No recognizable PQ measurements in any uploaded file.")

    # Merge sequentially
    combined = pd.concat(parsed_dfs, ignore_index=True)
    
    # Sort globally by timestamp
    if "timestamp" in combined.columns:
        from parsers.base import robust_to_datetime
        combined["_dt"] = robust_to_datetime(combined["timestamp"])
        combined = combined.dropna(subset=["_dt"]).sort_values("_dt").reset_index(drop=True)
        # Deduplicate overlapping timestamps
        combined = combined.drop_duplicates(subset=["_dt"], keep="first")
        # Format timestamps consistently to ISO string format
        combined["timestamp"] = combined["_dt"].dt.strftime("%Y-%m-%d %H:%M:%S")

        # Gap detection
        time_diffs = combined["_dt"].diff()
        valid_diffs = time_diffs[time_diffs > pd.Timedelta(0)]
        expected_interval = valid_diffs.min() if not valid_diffs.empty else pd.Timedelta(minutes=1)
        
        # If the gap is larger than 10 mins or 5x the expected logging interval
        gap_threshold = max(pd.Timedelta(minutes=10), 5 * expected_interval)
        gap_indices = time_diffs[time_diffs > gap_threshold].index
        
        gaps = []
        for idx in gap_indices:
            gap_start = combined.loc[idx - 1, "timestamp"]
            gap_end = combined.loc[idx, "timestamp"]
            dur = int((combined.loc[idx, "_dt"] - combined.loc[idx - 1, "_dt"]).total_seconds())
            gaps.append({
                "start": gap_start,
                "end": gap_end,
                "duration_seconds": dur
            })
            
        combined = combined.drop(columns=["_dt"], errors="ignore")
    else:
        gaps = []

    # Calculate kvar if missing
    if "kvar" not in combined.columns or combined["kvar"].isna().all():
        if "kw" in combined.columns and "kva" in combined.columns:
            s_sq = combined["kva"] ** 2
            p_sq = combined["kw"] ** 2
            q_sq = np.maximum(0, s_sq - p_sq)
            combined["kvar"] = np.sqrt(q_sq)

    # ML normalization
    normalizer = PQNormalizer()
    normalized, quality_report = normalizer.fit_transform(combined)
    data_quality = DataQualityReport(**quality_report)

    analytics = compute_analytics(normalized)
    observations = build_ai_observations(normalized, analytics)
    dip_swell_events, nominal_v = build_dip_swell_monitoring(normalized)

    # Enhance AI observations with gap alerts if present
    if gaps:
        for gap in gaps:
            gap_dur_min = round(gap["duration_seconds"] / 60)
            observations.append(
                f"Power Quality tracking interrupted between {gap['start']} and {gap['end']} "
                f"({gap_dur_min} minutes). Potential power outage or device down period."
            )

    sampled = _sample_evenly(normalized, MAX_RETURN_ROWS)
    rows = _rows_from_df(sampled)

    v_spectrum = _generate_harmonic_spectrum(normalized, is_current=False)
    i_spectrum = _generate_harmonic_spectrum(normalized, is_current=True)

    session_id = str(uuid.uuid4())
    session_store.put(session_id, normalized)

    # Construct joint filename representation
    joint_filename = " + ".join(f["filename"] for f in files_data)
    if len(joint_filename) > 100:
        joint_filename = f"{len(files_data)} files merged"

    # Add transition metadata to custom_fields
    if device_transitions or gaps:
        metadata = metadata.model_copy()
        metadata.custom_fields = {
            "device_transitions": device_transitions,
            "power_off_gaps": gaps
        }

    response = ProcessResponse(
        session_id=session_id,
        metadata=metadata,
        filename=joint_filename,
        total_rows=int(len(normalized)),
        returned_rows=len(rows),
        rows=rows,
        columns=[str(c) for c in normalized.columns],
        analytics=analytics,
        voltage_harmonic_spectrum=v_spectrum,
        current_harmonic_spectrum=i_spectrum,
        ai_observations=observations,
        nominal_voltage=nominal_v,
        dip_swell_events=dip_swell_events,
        data_quality=data_quality,
    )

    db.save_summary(response.model_dump())
    return response

