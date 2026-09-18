"""PostMan export — a workbook the KISEM report generator can read directly.

PostMan (the energy-assessment report builder) imports one PQ recording per
workbook and uses it for the "Plant main input" / "PCC panel" sections and the
measurement-chart annexure of the report.  The contract is deliberately small
so it survives changes on either side:

    Sheet "PostMan"   two columns, Field | Value.  Names the panel, the role
                      (main / pcc / mcc), the recording id, instrument, site
                      and engineer.  PostMan reads every row into a
                      case-insensitive map, so the order does not matter.
    Sheet "Summary"   min / average / max per parameter — for people, PostMan
                      recomputes its own from the data.
    Sheet "Harmonics" mean magnitude of each harmonic order (V and I) — for
                      people, PostMan recomputes its own from the data.
    Sheet "Data"      the normalized frame, one row per sample, in the
                      standard column names (timestamp, voltage_phase_a …,
                      current_phase_a …, kw, kva, kvar, pf, frequency,
                      vthd_a …, ithd_a …, and the U12_%FH03 / A1_%FH03 …
                      per-order harmonic columns when the analyser gave them).

See docs/POSTMAN_EXPORT.md for the full field list and PostMan's side of it.
"""
from __future__ import annotations

import io
import re
from datetime import datetime

import pandas as pd

from models.schema import AuditMetadata

POSTMAN_FORMAT = "PostMan-PQ v1"

ROLES = ("main", "pcc", "mcc")

# The PostMan sheet is read by field name (case- and space-insensitive), so
# these labels are the contract.  Do not rename them without changing PostMan.
_SUMMARY_PARAMS = [
    ("Voltage L1 (V)", "voltage_phase_a"),
    ("Voltage L2 (V)", "voltage_phase_b"),
    ("Voltage L3 (V)", "voltage_phase_c"),
    ("Current L1 (A)", "current_phase_a"),
    ("Current L2 (A)", "current_phase_b"),
    ("Current L3 (A)", "current_phase_c"),
    ("Active power (kW)", "kw"),
    ("Apparent power (kVA)", "kva"),
    ("Reactive power (kVAr)", "kvar"),
    ("Power factor", "pf"),
    ("Frequency (Hz)", "frequency"),
    ("Voltage THD L1 (%)", "vthd_a"),
    ("Voltage THD L2 (%)", "vthd_b"),
    ("Voltage THD L3 (%)", "vthd_c"),
    ("Current THD L1 (%)", "ithd_a"),
    ("Current THD L2 (%)", "ithd_b"),
    ("Current THD L3 (%)", "ithd_c"),
]

_HARMONIC_COL = re.compile(r"^(U\d\d|A\d)_%?FH(\d+)$", re.IGNORECASE)


def _numeric(df: pd.DataFrame, col: str) -> pd.Series | None:
    if col not in df.columns:
        return None
    s = pd.to_numeric(df[col], errors="coerce").dropna()
    return s if not s.empty else None


def _timestamps(df: pd.DataFrame) -> tuple[str, str, float | None]:
    """First and last sample time as text, and the sampling interval in
    seconds (median gap), or blanks when there is no usable timestamp."""
    if "timestamp" not in df.columns:
        return "", "", None
    ts = pd.to_datetime(df["timestamp"], errors="coerce").dropna()
    if ts.empty:
        return "", "", None
    ts = ts.sort_values()
    interval = None
    if len(ts) > 1:
        gaps = ts.diff().dropna().dt.total_seconds()
        gaps = gaps[gaps > 0]
        if not gaps.empty:
            interval = float(gaps.median())
    fmt = "%Y-%m-%d %H:%M:%S"
    return ts.iloc[0].strftime(fmt), ts.iloc[-1].strftime(fmt), interval


def _harmonic_table(df: pd.DataFrame) -> pd.DataFrame:
    """Mean of each harmonic order across phases and time, V and I side by
    side.  Order 1 is the fundamental and is left out."""
    v: dict[int, list[float]] = {}
    i: dict[int, list[float]] = {}
    for col in df.columns:
        m = _HARMONIC_COL.match(str(col).strip())
        if not m:
            continue
        order = int(m.group(2))
        if order == 1:
            continue
        s = _numeric(df, col)
        if s is None:
            continue
        bag = v if m.group(1).upper().startswith("U") else i
        bag.setdefault(order, []).append(float(s.mean()))
    orders = sorted(set(v) | set(i))
    rows = []
    for o in orders:
        rows.append({
            "Order": o,
            "Voltage (% of fundamental)": round(sum(v[o]) / len(v[o]), 3) if o in v else None,
            "Current (% of fundamental)": round(sum(i[o]) / len(i[o]), 3) if o in i else None,
        })
    return pd.DataFrame(rows, columns=["Order", "Voltage (% of fundamental)", "Current (% of fundamental)"])


def _summary_table(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for label, col in _SUMMARY_PARAMS:
        s = _numeric(df, col)
        if s is None:
            continue
        rows.append({
            "Parameter": label,
            "Min": round(float(s.min()), 3),
            "Average": round(float(s.mean()), 3),
            "Max": round(float(s.max()), 3),
        })
    return pd.DataFrame(rows, columns=["Parameter", "Min", "Average", "Max"])


def build_postman_workbook(
    df: pd.DataFrame,
    metadata: AuditMetadata | None,
    *,
    role: str = "pcc",
    panel_name: str = "",
    recording_id: str = "",
    session_id: str = "",
    source_file: str = "",
) -> tuple[bytes, str]:
    """Return (xlsx bytes, suggested file name)."""
    role = (role or "pcc").strip().lower()
    if role not in ROLES:
        raise ValueError(f"role must be one of {', '.join(ROLES)}")
    meta = metadata or AuditMetadata(pq_analyzer_type="", company_name="", plant_name="")
    panel = (panel_name or meta.machine_name or "").strip()
    if not panel:
        raise ValueError("A panel / machine name is needed so PostMan can place the recording.")
    instrument = meta.custom_analyzer_name or meta.pq_analyzer_type
    start, end, interval = _timestamps(df)
    exported_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    fields = [
        ("Format", POSTMAN_FORMAT),
        ("Panel", panel),
        ("Role", role),
        ("Recording ID", (recording_id or "").strip()),
        ("Instrument", instrument),
        ("Company", meta.company_name),
        ("Plant", meta.plant_name),
        ("Address", meta.address),
        ("Engineer", meta.engineer_name),
        ("Audit date", meta.audit_date),
        ("Exported at", exported_at),
        ("Exported by", "AI-PQA"),
        ("Session ID", session_id),
        ("Source file", source_file),
        ("Start", start),
        ("End", end),
        ("Samples", int(len(df))),
        ("Interval s", interval),
    ]
    postman_sheet = pd.DataFrame(fields, columns=["Field", "Value"])

    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        postman_sheet.to_excel(writer, sheet_name="PostMan", index=False)
        _summary_table(df).to_excel(writer, sheet_name="Summary", index=False)
        harm = _harmonic_table(df)
        if not harm.empty:
            harm.to_excel(writer, sheet_name="Harmonics", index=False)
        df.to_excel(writer, sheet_name="Data", index=False)
        # Readable column widths on the human-facing sheets.
        for name, widths in (("PostMan", (16, 48)), ("Summary", (26, 12, 12, 12)), ("Harmonics", (8, 26, 26))):
            if name in writer.sheets:
                ws = writer.sheets[name]
                for i, w in enumerate(widths):
                    ws.column_dimensions[chr(ord("A") + i)].width = w
    buf.seek(0)

    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", (recording_id or panel)).strip("_") or "recording"
    filename = f"PQ_{safe}_PostMan.xlsx"
    return buf.getvalue(), filename
