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

MAX_RETURN_ROWS = 8000
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
