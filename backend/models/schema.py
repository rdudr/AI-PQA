from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict


class AuditMetadata(BaseModel):
    pq_analyzer_type: str
    custom_analyzer_name: str = ""
    company_name: str
    plant_name: str
    address: str = ""
    machine_name: str = ""
    engineer_name: str = ""
    audit_date: str = ""


class PQRow(BaseModel):
    # Any column produced by the user's mapping flows through (extra fields preserved on serialize)
    model_config = ConfigDict(extra="allow")

    timestamp: str | None = None
    voltage_phase_a: float | None = None
    voltage_phase_b: float | None = None
    voltage_phase_c: float | None = None
    current_phase_a: float | None = None
    current_phase_b: float | None = None
    current_phase_c: float | None = None
    kw: float | None = None
    kva: float | None = None
    pf: float | None = None
    frequency: float | None = None
    vthd_a: float | None = None
    vthd_b: float | None = None
    vthd_c: float | None = None
    ithd_a: float | None = None
    ithd_b: float | None = None
    ithd_c: float | None = None
    kvar: float | None = None
    nkvar: float | None = None
    dkvar: float | None = None
    dpf: float | None = None


class MetricBlock(BaseModel):
    min: float | None = None
    max: float | None = None
    avg: float | None = None
    rms: float | None = None


class AnalyticsPayload(BaseModel):
    voltage: dict[str, Any]
    current: dict[str, Any]
    kw: MetricBlock
    kva: MetricBlock
    pf: MetricBlock
    frequency: MetricBlock
    vthd: dict[str, MetricBlock]
    ithd: dict[str, MetricBlock]
    kvar: MetricBlock
    nkvar: MetricBlock
    dkvar: MetricBlock
    dpf: MetricBlock


class HarmonicSpectrumPoint(BaseModel):
    order: int
    magnitude_pct: float


class DataQualityReport(BaseModel):
    quality_score: float = 0.0                         # 0–100 overall score
    column_completeness: dict[str, float] = {}          # col → % valid rows
    scale_fixes: dict[str, str] = {}                    # col → "×0.001" etc.
    outliers_removed: dict[str, int] = {}               # col → count
    gaps_filled: dict[str, int] = {}                    # col → count
    clamped: dict[str, int] = {}                        # col → count
    three_phase_warn: list[str] = []


class DipSwellEvent(BaseModel):
    timestamp: str | None = None
    event_type: str           # "dip" | "swell"
    phase: str                # "A" | "B" | "C"
    value_v: float            # actual measured voltage (V)
    nominal_v: float          # nominal voltage used for comparison (V)
    depth_pct: float          # % deviation from nominal (positive = dip below, negative = swell above)
    severity: str             # "minor" | "major" | "severe"


class ProcessResponse(BaseModel):
    session_id: str
    metadata: AuditMetadata
    filename: str
    total_rows: int
    returned_rows: int
    rows: list[PQRow]
    columns: list[str] = []  # actual column order in the normalized data
    analytics: AnalyticsPayload
    voltage_harmonic_spectrum: list[HarmonicSpectrumPoint]
    current_harmonic_spectrum: list[HarmonicSpectrumPoint]
    ai_observations: list[str]
    nominal_voltage: float = 230.0
    dip_swell_events: list[DipSwellEvent] = []
    data_quality: DataQualityReport = DataQualityReport()


class TablePageResponse(BaseModel):
    session_id: str
    total: int
    page: int
    page_size: int
    total_pages: int
    rows: list[PQRow]
    columns: list[str] = []  # actual column order in the normalized data


class PQEvent(BaseModel):
    timestamp: str | None = None
    event_type: str
    severity: str
    phase: str | None = None
    value: float | None = None
    threshold: float | None = None
    message: str


class EventsResponse(BaseModel):
    session_id: str
    total_events: int
    events: list[PQEvent]


class SummaryRow(BaseModel):
    parameter: str | None = None
    min: float | None = None
    max: float | None = None
    avg: float | None = None
    rms: float | None = None
    order: int | None = None
    magnitude_pct: float | None = None
    unit: str | None = None


class SummaryTableResponse(BaseModel):
    title: str
    rows: list[SummaryRow]


class AllSummariesResponse(BaseModel):
    session_id: str
    voltage: SummaryTableResponse
    current: SummaryTableResponse
    power: SummaryTableResponse
    thd: SummaryTableResponse
    frequency: SummaryTableResponse
    harmonics: SummaryTableResponse



