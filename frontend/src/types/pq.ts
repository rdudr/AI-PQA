export type PQVendor = string

export interface AuditMetadata {
  pq_analyzer_type: PQVendor
  custom_analyzer_name?: string
  company_name: string
  plant_name: string
  address: string
  machine_name: string
  engineer_name: string
  audit_date: string
  custom_fields?: Record<string, any>
}

// Allow any standardized column the user mapped to flow through
export interface PQRow {
  timestamp?: string | null
  voltage_phase_a?: number | null
  voltage_phase_b?: number | null
  voltage_phase_c?: number | null
  current_phase_a?: number | null
  current_phase_b?: number | null
  current_phase_c?: number | null
  kw?: number | null
  kva?: number | null
  pf?: number | null
  frequency?: number | null
  vthd_a?: number | null
  vthd_b?: number | null
  vthd_c?: number | null
  ithd_a?: number | null
  ithd_b?: number | null
  ithd_c?: number | null
  kvar?: number | null
  nkvar?: number | null
  dkvar?: number | null
  dpf?: number | null
  [key: string]: string | number | null | undefined
}

export interface MetricBlock {
  min: number | null
  max: number | null
  avg: number | null
  rms: number | null
}

export interface AnalyticsPayload {
  voltage: {
    phase_a: MetricBlock
    phase_b: MetricBlock
    phase_c: MetricBlock
    imbalance_pct: number | null
  }
  current: {
    phase_a: MetricBlock
    phase_b: MetricBlock
    phase_c: MetricBlock
    imbalance_pct: number | null
  }
  kw: MetricBlock
  kva: MetricBlock
  pf: MetricBlock
  frequency: MetricBlock
  vthd: { phase_a: MetricBlock; phase_b: MetricBlock; phase_c: MetricBlock }
  ithd: { phase_a: MetricBlock; phase_b: MetricBlock; phase_c: MetricBlock }
  kvar: MetricBlock
  nkvar: MetricBlock
  dkvar: MetricBlock
  dpf: MetricBlock
}

export interface HarmonicSpectrumPoint {
  order: number
  magnitude_pct: number
}

export interface DataQualityReport {
  quality_score: number
  column_completeness: Record<string, number>
  scale_fixes: Record<string, string>
  outliers_removed: Record<string, number>
  gaps_filled: Record<string, number>
  clamped: Record<string, number>
  three_phase_warn: string[]
}

export interface DipSwellEvent {
  timestamp: string | null
  event_type: 'dip' | 'swell'
  phase: string
  value_v: number
  nominal_v: number
  depth_pct: number
  severity: 'minor' | 'major' | 'severe'
}

export interface ProcessResponse {
  session_id: string
  metadata: AuditMetadata
  filename: string
  total_rows: number
  returned_rows: number
  rows: PQRow[]
  columns?: string[]
  analytics: AnalyticsPayload
  voltage_harmonic_spectrum: HarmonicSpectrumPoint[]
  current_harmonic_spectrum: HarmonicSpectrumPoint[]
  ai_observations: string[]
  nominal_voltage: number
  dip_swell_events: DipSwellEvent[]
  data_quality: DataQualityReport
}

export interface PQEventItem {
  timestamp: string | null
  event_type: string
  severity: string
  phase: string | null
  value: number | null
  threshold: number | null
  message: string
}

export interface EventsResponse {
  session_id: string
  total_events: number
  events: PQEventItem[]
}

export interface SummaryRow {
  parameter?: string | null
  min?: number | null
  max?: number | null
  avg?: number | null
  rms?: number | null
  order?: number | null
  magnitude_pct?: number | null
  unit?: string | null
}

export interface SummaryTableData {
  title: string
  rows: SummaryRow[]
}

export interface AllSummariesResponse {
  session_id: string
  voltage: SummaryTableData
  current: SummaryTableData
  power: SummaryTableData
  thd: SummaryTableData
  frequency: SummaryTableData
  harmonics: SummaryTableData
}

export interface TablePageResponse {
  session_id: string
  total: number
  page: number
  page_size: number
  total_pages: number
  rows: PQRow[]
  columns?: string[]
}
