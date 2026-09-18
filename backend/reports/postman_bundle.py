"""PostMan bundle — everything the report generator needs for one recording,
in one JSON document, computed here on the server.

The Excel export (postman_export.py) carries raw samples and leaves PostMan
to redo the arithmetic in the browser. That is fine for a short recording
and wrong for a week at one-second resolution: the browser stalls, and
PostMan can only print what it can recompute — never this analyser's own
IEEE 519 / EN 50160 verdicts, equipment-health scores or detected events.
The bundle moves all of that here:

    stats        min / avg / max / rms per parameter, three-phase imbalance
    series       every parameter thinned to ~240 bucket means for the charts
    harmonics    mean magnitude per order, voltage and current
    compliance   the standards rules with measured / limit / verdict / remark
    health       the five equipment-health components and the overall score
    events       counts by type and severity, the worst events, dips/swells
    data_quality the cleaning report from processing
    observations the analyser's AI observations

PostMan reads it with importPqBundle (src/p19_pq.js) and prints, per panel:
the measured table, the compliance table, the health strip, the events
summary, and the charts in the annexure. Format tag: PostMan-PQ-JSON v1.

The compliance and health rules are a port of frontend/src/utils/
compliance.ts and equipmentHealth.ts. Keep the three in step — see
docs/POSTMAN_EXPORT.md.
"""
from __future__ import annotations

import math
from datetime import datetime
from typing import Any

import numpy as np
import pandas as pd

from analytics.engine import build_ai_observations, compute_analytics
from analytics.events import build_dip_swell_monitoring, detect_all_events
from models.schema import AnalyticsPayload, AuditMetadata

BUNDLE_FORMAT = "PostMan-PQ-JSON v1"
SERIES_POINTS = 240

_HARMONIC_RE = __import__("re").compile(r"^(U\d\d|A\d)_%?FH(\d+)$", __import__("re").IGNORECASE)


# ── helpers ──────────────────────────────────────────────────────────────────

def _num(df: pd.DataFrame, col: str) -> np.ndarray | None:
    if col not in df.columns:
        return None
    s = pd.to_numeric(df[col], errors="coerce").to_numpy(dtype=float)
    return s if np.isfinite(s).any() else None


def _stat(arr: np.ndarray | None) -> dict[str, float] | None:
    if arr is None:
        return None
    v = arr[np.isfinite(arr)]
    if v.size == 0:
        return None
    return {"min": float(v.min()), "avg": float(v.mean()), "max": float(v.max()),
            "rms": float(np.sqrt(np.mean(np.square(v)))), "n": int(v.size)}


def _avg3(*arrs: np.ndarray | None) -> np.ndarray | None:
    live = [a for a in arrs if a is not None]
    if not live:
        return None
    stack = np.vstack(live)
    with np.errstate(all="ignore"):
        out = np.nanmean(np.where(np.isfinite(stack), stack, np.nan), axis=0)
    return out


def _thin(arr: np.ndarray | None, n: int = SERIES_POINTS) -> list[float | None] | None:
    """Bucket means, so a spike stays visible in the mean and a week of
    one-second samples becomes a few hundred points."""
    if arr is None:
        return None
    m = arr.size
    if m <= n:
        return [float(x) if np.isfinite(x) else None for x in arr]
    edges = np.linspace(0, m, n + 1).astype(int)
    out: list[float | None] = []
    for a, b in zip(edges[:-1], edges[1:]):
        seg = arr[a:b]
        seg = seg[np.isfinite(seg)]
        out.append(float(seg.mean()) if seg.size else None)
    return out


def _labels(df: pd.DataFrame, n: int = SERIES_POINTS) -> tuple[list[str], str, str, float | None]:
    if "timestamp" in df.columns:
        ts = pd.to_datetime(df["timestamp"], errors="coerce")
        if ts.notna().any():
            fmt = "%m-%d %H:%M"
            full = ts.dt.strftime(fmt).fillna("").tolist()
            m = len(full)
            idx = range(m) if m <= n else np.linspace(0, m - 1, n).astype(int)
            valid = ts.dropna().sort_values()
            interval = None
            if len(valid) > 1:
                gaps = valid.diff().dropna().dt.total_seconds()
                gaps = gaps[gaps > 0]
                if not gaps.empty:
                    interval = float(gaps.median())
            longf = "%Y-%m-%d %H:%M:%S"
            return [full[i] for i in idx], valid.iloc[0].strftime(longf), valid.iloc[-1].strftime(longf), interval
    m = len(df)
    idx = range(m) if m <= n else np.linspace(0, m - 1, n).astype(int)
    return [str(i + 1) for i in idx], "", "", None


def _harmonics(df: pd.DataFrame) -> dict[str, list[dict[str, float]]]:
    v: dict[int, list[float]] = {}
    i: dict[int, list[float]] = {}
    for col in df.columns:
        m = _HARMONIC_RE.match(str(col).strip())
        if not m:
            continue
        order = int(m.group(2))
        if order == 1:
            continue
        arr = _num(df, col)
        if arr is None:
            continue
        bag = v if m.group(1).upper().startswith("U") else i
        bag.setdefault(order, []).append(float(np.nanmean(arr)))
    pack = lambda bag: [{"order": o, "pct": round(sum(bag[o]) / len(bag[o]), 4)} for o in sorted(bag)]
    return {"voltage": pack(v), "current": pack(i)}


def _mb(block: Any) -> dict[str, float | None]:
    if block is None:
        return {}
    if hasattr(block, "model_dump"):
        block = block.model_dump()
    return {k: block.get(k) for k in ("min", "max", "avg", "rms")}


# ── compliance (port of frontend/src/utils/compliance.ts) ────────────────────

def evaluate_compliance(a: AnalyticsPayload, nominal: float) -> list[dict[str, Any]]:
    rules: list[dict[str, Any]] = []
    phases = (("phase_a", "Phase A"), ("phase_b", "Phase B"), ("phase_c", "Phase C"))

    for ph, label in phases:
        m = _mb(a.vthd.get(ph)).get("avg")
        if m is None:
            continue
        rules.append({"id": f"ieee519-vthd-{ph}", "standard": "IEEE 519", "clause": f"Voltage THD · {label}",
                      "description": "Voltage Total Harmonic Distortion shall not exceed 5% on systems ≤ 1 kV.",
                      "measured": m, "limit": 5, "unit": "%",
                      "verdict": "pass" if m <= 5 else "warn" if m <= 6.5 else "fail",
                      "remark": "Within IEEE 519 limit." if m <= 5 else "Marginally above 5% — investigate harmonic sources." if m <= 6.5
                      else "Exceeds limit by >30% — harmonic filter recommended."})
    for ph, label in phases:
        m = _mb(a.ithd.get(ph)).get("avg")
        if m is None:
            continue
        rules.append({"id": f"ieee519-ithd-{ph}", "standard": "IEEE 519", "clause": f"Current THD · {label}",
                      "description": "Current TDD reference limit (Isc/IL = 20–50, typical LV industrial).",
                      "measured": m, "limit": 15, "unit": "%",
                      "verdict": "pass" if m <= 15 else "warn" if m <= 20 else "fail",
                      "remark": "Within reference limit." if m <= 15 else "Above 15% — check non-linear loads (VFDs, rectifiers)." if m <= 20
                      else "Severe distortion — equipment derating likely."})
    for ph, label in phases:
        b = _mb(a.voltage.get(ph))
        if not b.get("avg"):
            continue
        lo, hi = nominal * 0.90, nominal * 1.10
        in_range = (b.get("min") or b["avg"]) >= lo and (b.get("max") or b["avg"]) <= hi
        moderately = nominal * 0.92 <= b["avg"] <= nominal * 1.08
        rules.append({"id": f"en50160-v-{ph}", "standard": "EN 50160", "clause": f"Supply voltage · {label}",
                      "description": f"LV nominal ± 10% ({lo:.0f} – {hi:.0f} V) for 95% of 10-min averages.",
                      "measured": b["avg"], "limit": nominal, "unit": "V",
                      "verdict": "pass" if in_range else "warn" if moderately else "fail",
                      "remark": "All samples stay within ±10% envelope." if in_range else "Average is fine but min/max exceeded the envelope." if moderately
                      else "Voltage frequently outside ±10% — distribution-level concern."})
    f = a.frequency.avg
    if f is not None:
        dev = abs(f - 50) / 50 * 100
        rules.append({"id": "freq", "standard": "EN 50160", "clause": "Frequency",
                      "description": "Grid frequency must remain within 50 Hz ±1 % during 99.5% of the year.",
                      "measured": f, "limit": 50, "unit": "Hz",
                      "verdict": "pass" if dev <= 1 else "warn" if dev <= 2 else "fail",
                      "remark": f"Deviation {dev:.2f}%." if dev <= 1 else f"Deviation {dev:.2f}% — abnormal."})
    pf = a.pf.avg
    if pf is not None:
        rules.append({"id": "pf", "standard": "Utility (typical)", "clause": "Power Factor",
                      "description": "Most utilities apply a PF penalty below 0.95 lagging.",
                      "measured": pf, "limit": 0.95, "unit": "",
                      "verdict": "pass" if pf >= 0.95 else "warn" if pf >= 0.85 else "fail",
                      "remark": "No penalty exposure." if pf >= 0.95 else "PF correction (capacitor bank) would reduce billing." if pf >= 0.85
                      else "Significant penalty exposure — reactive compensation needed."})
    vimb = a.voltage.get("imbalance_pct")
    if isinstance(vimb, (int, float)) and math.isfinite(vimb):
        rules.append({"id": "v-imb", "standard": "IEC 61000-3-14", "clause": "Voltage Imbalance",
                      "description": "Voltage imbalance limited to 2% for three-phase distribution systems.",
                      "measured": vimb, "limit": 2, "unit": "%",
                      "verdict": "pass" if vimb <= 2 else "warn" if vimb <= 3 else "fail",
                      "remark": "Three-phase symmetry is good." if vimb <= 2 else "Imbalance high — check single-phase loading."})
    return rules


def compliance_summary(rules: list[dict[str, Any]]) -> dict[str, int]:
    total = len(rules)
    p = sum(1 for r in rules if r["verdict"] == "pass")
    w = sum(1 for r in rules if r["verdict"] == "warn")
    f = sum(1 for r in rules if r["verdict"] == "fail")
    return {"total": total, "pass": p, "warn": w, "fail": f, "score": round((p + w * 0.5) / total * 100) if total else 0}


# ── equipment health (port of frontend/src/utils/equipmentHealth.ts) ─────────

def _clamp(n: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, n))


def _status(score: float) -> str:
    return "good" if score >= 80 else "fair" if score >= 55 else "poor"


def compute_health(a: AnalyticsPayload, nominal: float) -> dict[str, Any]:
    out: list[dict[str, Any]] = []
    vthd_avg = sum(float(_mb(a.vthd.get(p)).get("avg") or 0) for p in ("phase_a", "phase_b", "phase_c")) / 3
    s = _clamp(100 - vthd_avg * 12, 0, 100)
    out.append({"key": "harmonic", "label": "Harmonic Health", "raw": vthd_avg, "score": round(s), "weight": 0.25, "status": _status(s),
                "detail": f"Average voltage THD {vthd_avg:.2f} % across R/Y/B.",
                "recommendation": "Consider passive/active harmonic filtering near major VFD/rectifier loads." if vthd_avg > 5 else "Within IEEE 519 limits."})
    phases = [float(_mb(a.voltage.get(p)).get("avg") or 0) for p in ("phase_a", "phase_b", "phase_c")]
    phases = [v for v in phases if v > 0]
    avg_v = sum(phases) / len(phases) if phases else nominal
    dev = abs(avg_v - nominal) / nominal * 100 if nominal > 0 else 0
    vimb = float(a.voltage.get("imbalance_pct") or 0)
    s = _clamp(100 - dev * 5 - vimb * 8, 0, 100)
    out.append({"key": "voltage", "label": "Voltage Stability", "raw": dev, "score": round(s), "weight": 0.20, "status": _status(s),
                "detail": f"Mean {avg_v:.1f} V (nominal {nominal:g} V, {dev:.1f} % off) · imbalance {vimb:.2f} %.",
                "recommendation": "Voltage drifts from nominal — check transformer tap settings or supply contract." if dev > 5 else "Voltage stable within acceptable bounds."})
    pf = float(a.pf.avg if a.pf.avg is not None else 1)
    s = _clamp((pf - 0.7) / 0.3 * 100, 0, 100)
    out.append({"key": "pf", "label": "Power Factor", "raw": pf, "score": round(s), "weight": 0.25, "status": _status(s),
                "detail": f"Average PF {pf:.3f}.",
                "recommendation": "Add APFC capacitor bank to lift PF to ≥ 0.95 and remove utility penalty." if pf < 0.95 else "PF healthy — no penalty risk."})
    iimb = float(a.current.get("imbalance_pct") or 0)
    s = _clamp(100 - iimb * 3, 0, 100)
    out.append({"key": "balance", "label": "Three-phase Balance", "raw": iimb, "score": round(s), "weight": 0.15, "status": _status(s),
                "detail": f"Current imbalance {iimb:.2f} %.",
                "recommendation": "Redistribute single-phase loads — high imbalance accelerates equipment failure." if iimb > 10 else "Three-phase loading is acceptable."})
    f = float(a.frequency.avg if a.frequency.avg is not None else 50)
    fdev = abs(f - 50) / 50 * 100
    s = _clamp(100 - fdev * 20, 0, 100)
    out.append({"key": "frequency", "label": "Frequency Stability", "raw": f, "score": round(s), "weight": 0.15, "status": _status(s),
                "detail": f"Average {f:.3f} Hz ({fdev:.2f} % deviation).",
                "recommendation": "Frequency drift unusual — investigate generator / grid stability." if fdev > 1 else "Frequency within acceptable grid tolerance."})
    overall = round(sum(c["score"] * c["weight"] for c in out))
    return {"components": out, "overall": overall, "status": _status(overall)}


# ── events ───────────────────────────────────────────────────────────────────

def summarise_events(df: pd.DataFrame, nominal: float | None, keep: int = 40) -> dict[str, Any]:
    events = detect_all_events(df)
    by_type: dict[str, int] = {}
    by_sev: dict[str, int] = {}
    for e in events:
        t = getattr(e.event_type, "value", str(e.event_type))
        s = getattr(e.severity, "value", str(e.severity))
        by_type[t] = by_type.get(t, 0) + 1
        by_sev[s] = by_sev.get(s, 0) + 1
    rank = {"critical": 0, "high": 1, "medium": 2, "warning": 2, "low": 3, "info": 4}
    worst = sorted(events, key=lambda e: rank.get(getattr(e.severity, "value", str(e.severity)).lower(), 5))[:keep]
    listed = [{"timestamp": e.timestamp, "type": getattr(e.event_type, "value", str(e.event_type)),
               "severity": getattr(e.severity, "value", str(e.severity)), "phase": e.phase,
               "value": e.value, "threshold": e.threshold, "message": e.message} for e in worst]
    dips, nominal_used = build_dip_swell_monitoring(df, nominal)
    ds = {"nominal_v": nominal_used, "dips": sum(1 for d in dips if d.event_type == "dip"),
          "swells": sum(1 for d in dips if d.event_type == "swell"),
          "severe": sum(1 for d in dips if d.severity == "severe"),
          "worst_dip_pct": max((d.depth_pct for d in dips if d.event_type == "dip"), default=None),
          "worst_swell_pct": min((d.depth_pct for d in dips if d.event_type == "swell"), default=None)}
    return {"total": len(events), "by_type": by_type, "by_severity": by_sev, "list": listed, "dip_swell": ds}


# ── the bundle ───────────────────────────────────────────────────────────────

def build_postman_bundle(
    df: pd.DataFrame,
    metadata: AuditMetadata | None,
    *,
    role: str = "pcc",
    panel_name: str = "",
    recording_id: str = "",
    session_id: str = "",
    source_file: str = "",
    summary: dict[str, Any] | None = None,
) -> dict[str, Any]:
    role = (role or "pcc").strip().lower()
    if role not in ("main", "pcc", "mcc"):
        raise ValueError("role must be one of main, pcc, mcc")
    meta = metadata or AuditMetadata(pq_analyzer_type="", company_name="", plant_name="")
    panel = (panel_name or meta.machine_name or "").strip()
    if not panel:
        raise ValueError("A panel / machine name is needed so PostMan can place the recording.")

    analytics = compute_analytics(df)
    nominal = float((summary or {}).get("nominal_voltage") or 0) or _detect_nominal(df)
    labels, start, end, interval = _labels(df)

    va, vb, vc = _num(df, "voltage_phase_a"), _num(df, "voltage_phase_b"), _num(df, "voltage_phase_c")
    ia, ib, ic = _num(df, "current_phase_a"), _num(df, "current_phase_b"), _num(df, "current_phase_c")
    kw, kva, kvar, pf, freq = _num(df, "kw"), _num(df, "kva"), _num(df, "kvar"), _num(df, "pf"), _num(df, "frequency")
    vthd = _avg3(_num(df, "vthd_a"), _num(df, "vthd_b"), _num(df, "vthd_c"))
    ithd = _avg3(_num(df, "ithd_a"), _num(df, "ithd_b"), _num(df, "ithd_c"))
    v, i = _avg3(va, vb, vc), _avg3(ia, ib, ic)
    if kva is None and kw is not None and pf is not None:
        with np.errstate(all="ignore"):
            kva = np.where(pf != 0, kw / pf, np.nan)

    stats = {k: _stat(x) for k, x in (("v", v), ("va", va), ("vb", vb), ("vc", vc), ("i", i), ("ia", ia), ("ib", ib), ("ic", ic),
                                        ("kw", kw), ("kva", kva), ("kvar", kvar), ("pf", pf), ("freq", freq), ("vthd", vthd), ("ithd", ithd))}
    stats["v_imbalance_pct"] = analytics.voltage.get("imbalance_pct")
    stats["i_imbalance_pct"] = analytics.current.get("imbalance_pct")

    rules = evaluate_compliance(analytics, nominal)
    return {
        "format": BUNDLE_FORMAT,
        "session_id": session_id, "panel": panel, "role": role, "recording_id": (recording_id or "").strip(),
        "instrument": meta.custom_analyzer_name or meta.pq_analyzer_type,
        "company": meta.company_name, "plant": meta.plant_name, "address": meta.address,
        "engineer": meta.engineer_name, "audit_date": meta.audit_date,
        "exported_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "exported_by": "AI-PQA", "source_file": source_file,
        "start": start, "end": end, "samples": int(len(df)), "interval_s": interval, "nominal_v": nominal,
        "stats": stats,
        "series": {"t": labels, "va": _thin(va), "vb": _thin(vb), "vc": _thin(vc), "ia": _thin(ia), "ib": _thin(ib), "ic": _thin(ic),
                   "kw": _thin(kw), "kva": _thin(kva), "kvar": _thin(kvar), "pf": _thin(pf), "freq": _thin(freq),
                   "vthd": _thin(vthd), "ithd": _thin(ithd)},
        "harmonics": _harmonics(df),
        "compliance": {"rules": rules, "summary": compliance_summary(rules)},
        "health": compute_health(analytics, nominal),
        "events": summarise_events(df, nominal),
        "data_quality": (summary or {}).get("data_quality") or {},
        "observations": build_ai_observations(df, analytics),
    }


def _detect_nominal(df: pd.DataFrame) -> float:
    from analytics.events import _detect_nominal_voltage
    try:
        return float(_detect_nominal_voltage(df))
    except Exception:  # noqa: BLE001
        return 230.0
