import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Activity,
  BarChart3,
  CalendarCheck,
  ChevronDown,
  CircleCheck,
  Clock,
  FileWarning,
  Filter,
  Gauge,
  LayoutDashboard,
  Download,
  Play,
  Plus,
  Printer,
  Square,
  Timer,
  Waves,
  Zap,
} from 'lucide-react'

import { loadSession } from '@/utils/sessionDb'
import { Loading3D } from '@/components/Loading3D'
import { DateTimePicker } from '@/components/DateTimePicker'
import { buildDownloadName } from '@/utils/downloadName'
import type { AnalyticsPayload, MetricBlock, ProcessResponse } from '@/types/pq'
import { downloadNormalizedSessionExcel } from '@/services/api'
import { exportPqReportPdf } from '@/utils/pqReportPdf'
import { AnalyticsSummaryTable } from '@/tables/AnalyticsSummaryTable'
import { KpiCard } from '@/cards/KpiCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  PHASE_COLORS,
  harmonicGroupedBarOption,
  minMaxBandOption,
  timeSeriesOption,
} from '@/graphs/chartOptions'
import { ChartCard } from '@/graphs/ChartCard'
import { DataGrid } from '@/tables/DataGrid'

// Full harmonic spectrum H1–H25 — every order (odd + even) so analyzers that
// export all 25 orders (e.g. A_%FH01..A_%FH25) render completely. Y axis is
// linear-with-floor (see chartOptions) so small even-order bars stay visible
// next to the dominant H1.
const HARMONIC_DISPLAY = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
]

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function parseTimestamp(s: string): Date | null {
  if (!s) return null
  const clean = s.trim()
  if (!clean) return null

  // Try direct parse: "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS" or ISO formats
  const iso = clean.replace(' ', 'T')
  const d = new Date(iso)
  if (!isNaN(d.getTime())) return d

  // Try DD-MM-YYYY HH:MM:SS or DD/MM/YYYY HH:MM:SS (European formats)
  const euroMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/)
  if (euroMatch) {
    const [, day, month, year, hh, mm, ss] = euroMatch
    const fullYear = year.length === 2 ? 2000 + Number(year) : Number(year)
    const d3 = new Date(
      fullYear,
      Number(month) - 1,
      Number(day),
      Number(hh ?? 0),
      Number(mm ?? 0),
      Number(ss ?? 0),
    )
    if (!isNaN(d3.getTime())) return d3
  }

  // Fallback: date-only
  const d2 = new Date(clean.split('T')[0].split(' ')[0])
  return isNaN(d2.getTime()) ? null : d2
}

interface PeriodInfo {
  day: number
  month: string
  year: number
  dayName: string
  time: string
  raw: Date
}

function buildPeriodInfo(raw: Date): PeriodInfo {
  return {
    day:     raw.getDate(),
    month:   MONTHS[raw.getMonth()],
    year:    raw.getFullYear(),
    dayName: DAYS[raw.getDay()],
    time:    raw.toTimeString().slice(0, 8),
    raw,
  }
}

function formatDuration(ms: number): string {
  if (ms < 0) ms = 0
  const totalSec = Math.round(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const parts: string[] = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  if (m > 0) parts.push(`${m}m`)
  if (s > 0 && d === 0) parts.push(`${s}s`)
  return parts.length ? parts.join(' ') : '0s'
}

function formatInterval(ms: number): string {
  if (ms <= 0) return '—'
  const sec = ms / 1000
  if (sec < 1) return `${Math.round(ms)} ms`
  if (sec < 60) return sec < 10 ? `${sec.toFixed(1)}s` : `${Math.round(sec)}s`
  const min = sec / 60
  if (min < 60) return min < 10 ? `${min.toFixed(1)} min` : `${Math.round(min)} min`
  const hr = min / 60
  return `${hr.toFixed(1)} h`
}



function formatMetric(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return value.toFixed(digits)
}

// Short, instantly-readable label for a normalized column key
function shortColLabel(c: string): string {
  const map: Record<string, string> = {
    voltage_phase_a: 'V·a',
    voltage_phase_b: 'V·b',
    voltage_phase_c: 'V·c',
    current_phase_a: 'I·a',
    current_phase_b: 'I·b',
    current_phase_c: 'I·c',
    kw: 'kW',
    kva: 'kVA',
    kvar: 'kVAR',
    nkvar: 'nkVAR',
    dkvar: 'dkVAR',
    pf: 'PF',
    dpf: 'dPF',
    frequency: 'Hz',
    vthd_a: 'VTHD·a',
    vthd_b: 'VTHD·b',
    vthd_c: 'VTHD·c',
    ithd_a: 'ITHD·a',
    ithd_b: 'ITHD·b',
    ithd_c: 'ITHD·c',
    timestamp: 'Time',
    date: 'Date',
    time: 'Time',
  }
  return map[c] ?? c.replace(/_/g, ' ')
}

// Phase color dot for a column (R=red, Y=yellow, B=blue)
function colDotColor(c: string): string {
  if (/_a$|phase_a/.test(c)) return '#e74c3c'
  if (/_b$|phase_b/.test(c)) return '#f3c623'
  if (/_c$|phase_c/.test(c)) return '#2980b9'
  return '#10375c'
}

// Build a row's timestamp string — prefers `timestamp`, falls back to `date`+`time`.
function buildRowTs(r: Record<string, unknown>): string {
  if (r.timestamp) return String(r.timestamp).trim()
  if (r.date && r.time) return `${String(r.date).trim()} ${String(r.time).trim()}`
  if (r.date) return String(r.date).trim()
  return ''
}

// Format a Date as `YYYY-MM-DDTHH:MM` for an <input type="datetime-local">
function toDateTimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type Row = Record<string, unknown>

// min / max / avg / rms over a column's non-null numeric values.
// Mirrors backend _metric_block (analytics/engine.py) so range-filtered numbers
// match the full-dataset numbers the backend returns when the range is "Full".
function metricBlock(values: Array<unknown>): MetricBlock {
  let min = Infinity, max = -Infinity, sum = 0, sumSq = 0, n = 0
  for (const raw of values) {
    if (raw == null) continue
    const v = Number(raw)
    if (!Number.isFinite(v)) continue
    if (v < min) min = v
    if (v > max) max = v
    sum += v
    sumSq += v * v
    n += 1
  }
  if (n === 0) return { min: null, max: null, avg: null, rms: null }
  return { min, max, avg: sum / n, rms: Math.sqrt(sumSq / n) }
}

// Mean per-row three-phase imbalance %. Mirrors backend _three_phase_imbalance_pct:
// only rows where all three phases are present count; deviation = max |phase − rowAvg|.
function imbalancePct(rows: Row[], a: string, b: string, c: string): number | null {
  let total = 0, n = 0
  for (const r of rows) {
    const va = Number(r[a]), vb = Number(r[b]), vc = Number(r[c])
    if (!Number.isFinite(va) || !Number.isFinite(vb) || !Number.isFinite(vc)) continue
    const avg = (va + vb + vc) / 3
    if (avg === 0) continue
    const dev = Math.max(Math.abs(va - avg), Math.abs(vb - avg), Math.abs(vc - avg))
    total += (dev / avg) * 100
    n += 1
  }
  return n ? total / n : null
}

// Recompute the full analytics payload from a (range-filtered) row set so the KPI
// strip, Site Summary and Analytics Summary tables track the selected time range.
function computeRangeAnalytics(rows: Row[]): AnalyticsPayload {
  const c = (name: string) => rows.map((r) => r[name])
  return {
    voltage: {
      phase_a: metricBlock(c('voltage_phase_a')),
      phase_b: metricBlock(c('voltage_phase_b')),
      phase_c: metricBlock(c('voltage_phase_c')),
      imbalance_pct: imbalancePct(rows, 'voltage_phase_a', 'voltage_phase_b', 'voltage_phase_c'),
    },
    current: {
      phase_a: metricBlock(c('current_phase_a')),
      phase_b: metricBlock(c('current_phase_b')),
      phase_c: metricBlock(c('current_phase_c')),
      imbalance_pct: imbalancePct(rows, 'current_phase_a', 'current_phase_b', 'current_phase_c'),
    },
    kw: metricBlock(c('kw')),
    kva: metricBlock(c('kva')),
    pf: metricBlock(c('pf')),
    frequency: metricBlock(c('frequency')),
    vthd: {
      phase_a: metricBlock(c('vthd_a')),
      phase_b: metricBlock(c('vthd_b')),
      phase_c: metricBlock(c('vthd_c')),
    },
    ithd: {
      phase_a: metricBlock(c('ithd_a')),
      phase_b: metricBlock(c('ithd_b')),
      phase_c: metricBlock(c('ithd_c')),
    },
    kvar: metricBlock(c('kvar')),
    nkvar: metricBlock(c('nkvar')),
    dkvar: metricBlock(c('dkvar')),
    dpf: metricBlock(c('dpf')),
  }
}

export function DashboardPage() {
  const reportRef = useRef<HTMLDivElement>(null)
  const qualityMenuRef = useRef<HTMLDivElement>(null)
  const rangePickerRef = useRef<HTMLDivElement>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [normalizedExcelBusy, setNormalizedExcelBusy] = useState(false)
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false)
  const [data, setData] = useState<ProcessResponse | null>(null)
  const [dbLoading, setDbLoading] = useState(true)
  // Starts collapsed on landing — only opens when the user clicks "Filter Range".
  const [isRangePickerCollapsed, setIsRangePickerCollapsed] = useState(true)
  // Which inline date picker (if any) is expanded — mutually exclusive so the
  // panel never shows two open calendars at once.
  const [openPicker, setOpenPicker] = useState<'start' | 'end' | null>(null)

  useEffect(() => {
    loadSession()
      .then((s) => {
        setData(s)
      })
      .catch((err) => {
        console.error('Failed to load session from IndexedDB:', err)
      })
      .finally(() => {
        setDbLoading(false)
      })
  }, [])

  // ── All memos must be before any conditional return ──────────────────────
  // `allRows` is the full dataset returned by the backend. `rows` below is a
  // RANGE-FILTERED view used by every chart. Summary panels keep using
  // `allRows`/`allTs` so they continue to show the file's full overview.
  const allRows = data?.rows ?? []

  const allTs = useMemo(
    () => allRows.map(r => buildRowTs(r as Record<string, unknown>)),
    [allRows],
  )

  // ── Time-range filter state (user-picked via the floating card below) ───
  const [rangeStart, setRangeStart] = useState<string>('')   // datetime-local string, '' = no lower bound
  const [rangeEnd, setRangeEnd] = useState<string>('')       // datetime-local string, '' = no upper bound

  // Filtered rows — only the time-series CHARTS look at these.
  // Empty range strings = unfiltered (returns allRows as-is, no cost).
  const rows = useMemo(() => {
    if (!rangeStart && !rangeEnd) return allRows
    const startMs = rangeStart ? new Date(rangeStart).getTime() : -Infinity
    const endMs = rangeEnd ? new Date(rangeEnd).getTime() : Infinity
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return allRows
    return allRows.filter(r => {
      const t = parseTimestamp(buildRowTs(r as Record<string, unknown>))
      if (!t) return true   // rows we can't parse stay (don't accidentally drop them)
      const m = t.getTime()
      return m >= startMs && m <= endMs
    })
  }, [allRows, rangeStart, rangeEnd])

  // Filtered timestamps — used by chart memos
  const ts = useMemo(
    () => rows.map(r => buildRowTs(r as Record<string, unknown>)),
    [rows],
  )

  // Range-aware analytics. When no range is picked, use the backend's authoritative
  // full-dataset analytics; once a range is active, recompute from the filtered rows
  // so the KPI strip, Site Summary and Analytics Summary tables update with it too.
  const isFiltered = Boolean(rangeStart || rangeEnd)
  const viewAnalytics = useMemo<AnalyticsPayload | null>(() => {
    if (!data) return null
    if (!isFiltered) return data.analytics
    return computeRangeAnalytics(rows as Row[])
  }, [data, isFiltered, rows])

  // ── Measurement period (always uses the FULL dataset — represents the
  //     recording itself, not the user's view filter). ──────────────────────
  const measurementPeriod = useMemo(() => {
    const parsedDates: Date[] = []
    for (const t of allTs) {
      if (!t) continue
      const d = parseTimestamp(t)
      if (d && !isNaN(d.getTime())) parsedDates.push(d)
    }
    if (parsedDates.length === 0) return null

    let startDate = parsedDates[0]
    let endDate = parsedDates[0]
    for (const d of parsedDates) {
      if (d.getTime() < startDate.getTime()) startDate = d
      if (d.getTime() > endDate.getTime()) endDate = d
    }

    const durationMs = endDate.getTime() - startDate.getTime()
    const samplingMs = parsedDates.length > 1 ? durationMs / (parsedDates.length - 1) : 0
    const sameDay =
      startDate.getFullYear() === endDate.getFullYear() &&
      startDate.getMonth() === endDate.getMonth() &&
      startDate.getDate() === endDate.getDate()

    return {
      start:    buildPeriodInfo(startDate),
      end:      buildPeriodInfo(endDate),
      duration: formatDuration(durationMs),
      durationMs,
      sampling: formatInterval(samplingMs),
      totalRows: parsedDates.length,
      sameDay,
    }
  }, [allTs])

  // Apply a quick preset relative to the END of the recording
  const applyRangePreset = (preset: 'all' | '1h' | '6h' | '24h') => {
    if (!measurementPeriod || preset === 'all') {
      setRangeStart('')
      setRangeEnd('')
      return
    }
    const end = new Date(measurementPeriod.end.raw)
    const start = new Date(end)
    if (preset === '1h')  start.setHours(start.getHours() - 1)
    if (preset === '6h')  start.setHours(start.getHours() - 6)
    if (preset === '24h') start.setDate(start.getDate() - 1)
    const fileStart = measurementPeriod.start.raw
    const clampedStart = start.getTime() < fileStart.getTime() ? fileStart : start
    setRangeStart(toDateTimeLocal(clampedStart))
    setRangeEnd(toDateTimeLocal(end))
  }

  // Which columns the user actually mapped
  const mappedCols = useMemo(() => new Set<string>(data?.columns ?? []), [data])
  const col = (name: string) => rows.map(r => r[name] as number | null | undefined)
  const hasAny = (...names: string[]) => names.some(n => mappedCols.has(n))

  // Average of a numeric column across all rows
  const avgCol = (name: string): number => {
    const vals = rows
      .map(r => r[name] as number | null | undefined)
      .filter((v): v is number => v != null && !isNaN(Number(v)))
      .map(Number)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  }

  // Look up a harmonic column by phase + order, trying every common naming
  // convention.  Some analyzers export `A1_%FH01`, others `A1_%FH1`, others
  // a single aggregated `A_%FH01`.  Return the average for whichever exists.
  const harmonicAvg = (phase: string, order: number): number => {
    const padded = String(order).padStart(2, '0')
    const candidates = [
      `${phase}_%FH${padded}`,    // A1_%FH01
      `${phase}_%FH${order}`,     // A1_%FH1
      `${phase}_%fh${padded}`,    // A1_%fh01 (lowercase fh)
      `${phase}_%fh${order}`,
    ]
    for (const c of candidates) {
      if (mappedCols.has(c)) return avgCol(c)
    }
    return 0
  }

  // Harmonic averages per order. Voltage: try per-phase (U12/U23/U31) first,
  // then a single-U aggregate. Current: same with A1/A2/A3 and a single A.
  const voltHarmonics = useMemo(() => {
    const u12 = HARMONIC_DISPLAY.map(n => harmonicAvg('U12', n))
    const u23 = HARMONIC_DISPLAY.map(n => harmonicAvg('U23', n))
    const u31 = HARMONIC_DISPLAY.map(n => harmonicAvg('U31', n))
    const anyPhase = [...u12, ...u23, ...u31].some(v => v > 0)
    if (anyPhase) return { u12, u23, u31, single: [] as number[], usingSingle: false }
    // Fall back: aggregated single U column
    const single = HARMONIC_DISPLAY.map(n => harmonicAvg('U', n))
    return { u12, u23, u31, single, usingSingle: single.some(v => v > 0) }
  }, [rows, mappedCols]) // eslint-disable-line react-hooks/exhaustive-deps

  const currHarmonics = useMemo(() => {
    const a1 = HARMONIC_DISPLAY.map(n => harmonicAvg('A1', n))
    const a2 = HARMONIC_DISPLAY.map(n => harmonicAvg('A2', n))
    const a3 = HARMONIC_DISPLAY.map(n => harmonicAvg('A3', n))
    const anyPhase = [...a1, ...a2, ...a3].some(v => v > 0)
    if (anyPhase) return { a1, a2, a3, single: [] as number[], usingSingle: false }
    // Fall back: aggregated single A column (A_%FH01, A_%FH1, ...)
    const single = HARMONIC_DISPLAY.map(n => harmonicAvg('A', n))
    return { a1, a2, a3, single, usingSingle: single.some(v => v > 0) }
  }, [rows, mappedCols]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 1. Variation of Voltages ─────────────────────────────────────────────
  const vOpts = useMemo(() => timeSeriesOption({
    title: 'Variation of Voltages',
    timestamps: ts,
    yName: 'V',
    series: [
      { name: 'Va (R)', color: PHASE_COLORS.R, data: col('voltage_phase_a') },
      { name: 'Vb (Y)', color: PHASE_COLORS.Y, data: col('voltage_phase_b') },
      { name: 'Vc (B)', color: PHASE_COLORS.B, data: col('voltage_phase_c') },
    ],
  }), [rows, ts]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 2. Variation of Current ──────────────────────────────────────────────
  const iOpts = useMemo(() => timeSeriesOption({
    title: 'Variation of Current',
    timestamps: ts,
    yName: 'A',
    series: [
      { name: 'Ia (R)', color: PHASE_COLORS.R, data: col('current_phase_a') },
      { name: 'Ib (Y)', color: PHASE_COLORS.Y, data: col('current_phase_b') },
      { name: 'Ic (B)', color: PHASE_COLORS.B, data: col('current_phase_c') },
    ],
  }), [rows, ts]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 3. Variation of kW ───────────────────────────────────────────────────
  const kwOpts = useMemo(() => timeSeriesOption({
    title: 'Variation of Active Power (kW)',
    timestamps: ts,
    yName: 'kW',
    series: [{ name: 'kW', color: '#10375c', data: col('kw') }],
  }), [rows, ts]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 4. Variation of kVAR ─────────────────────────────────────────────────
  const kvarOpts = useMemo(() => timeSeriesOption({
    title: 'Variation of Reactive Power (kVAR)',
    timestamps: ts,
    yName: 'kVAR',
    series: [
      { name: 'kVAR',  color: '#e74c3c', data: col('kvar')  },
      { name: 'nkVAR', color: '#9b59b6', data: col('nkvar') },
      { name: 'dkVAR', color: '#eb8317', data: col('dkvar') },
    ],
  }), [rows, ts]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 5. Variation of kVA ──────────────────────────────────────────────────
  const kvaOpts = useMemo(() => timeSeriesOption({
    title: 'Variation of Apparent Power (kVA)',
    timestamps: ts,
    yName: 'kVA',
    series: [{ name: 'kVA', color: '#2980b9', data: col('kva') }],
  }), [rows, ts]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 6. Variation of PF ───────────────────────────────────────────────────
  const pfOpts = useMemo(() => timeSeriesOption({
    title: 'Variation of Power Factor (PF)',
    timestamps: ts,
    yName: 'PF',
    series: [{ name: 'PF', color: '#27ae60', data: col('pf') }],
  }), [rows, ts]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 7. Variation of Voltage THD ──────────────────────────────────────────
  const vthdOpts = useMemo(() => timeSeriesOption({
    title: 'Variation of Voltage THD (VTHD)',
    timestamps: ts,
    yName: '%',
    series: [
      { name: 'VTHD R', color: PHASE_COLORS.R, data: col('vthd_a') },
      { name: 'VTHD Y', color: PHASE_COLORS.Y, data: col('vthd_b') },
      { name: 'VTHD B', color: PHASE_COLORS.B, data: col('vthd_c') },
    ],
  }), [rows, ts]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 8. Variation of Current THD ──────────────────────────────────────────
  const ithdOpts = useMemo(() => timeSeriesOption({
    title: 'Variation of Current THD (ITHD)',
    timestamps: ts,
    yName: '%',
    series: [
      { name: 'ITHD R', color: PHASE_COLORS.R, data: col('ithd_a') },
      { name: 'ITHD Y', color: PHASE_COLORS.Y, data: col('ithd_b') },
      { name: 'ITHD B', color: PHASE_COLORS.B, data: col('ithd_c') },
    ],
  }), [rows, ts]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 9. Dip & Swell Monitoring — Voltage (Urms min/max) ───────────────────
  const dipSwellVOpts = useMemo(() => minMaxBandOption({
    title: 'Dip & Swell Monitoring — Voltage (Urms min / max)',
    timestamps: ts,
    yName: 'V',
    bands: [
      { label: 'L12 (RY)', colorMin: '#e74c3c99', colorMax: '#e74c3c', dataMin: col('Urms12_min'), dataMax: col('Urms12_max') },
      { label: 'L23 (YB)', colorMin: '#f3c62399', colorMax: '#f3c623', dataMin: col('Urms23_min'), dataMax: col('Urms23_max') },
      { label: 'L31 (BR)', colorMin: '#2980b999', colorMax: '#2980b9', dataMin: col('Urms31_min'), dataMax: col('Urms31_max') },
    ],
  }), [rows, ts]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 10. Dip & Swell Monitoring — Current (Arms min/max) ──────────────────
  const dipSwellIOpts = useMemo(() => minMaxBandOption({
    title: 'Dip & Swell Monitoring — Current (Arms min / max)',
    timestamps: ts,
    yName: 'A',
    bands: [
      { label: 'L1 (R)', colorMin: '#e74c3c99', colorMax: '#e74c3c', dataMin: col('Arms1_min'), dataMax: col('Arms1_max') },
      { label: 'L2 (Y)', colorMin: '#f3c62399', colorMax: '#f3c623', dataMin: col('Arms2_min'), dataMax: col('Arms2_max') },
      { label: 'L3 (B)', colorMin: '#2980b999', colorMax: '#2980b9', dataMin: col('Arms3_min'), dataMax: col('Arms3_max') },
    ],
  }), [rows, ts]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 11. Harmonic Order — Voltage (grouped bars R/Y/B) ────────────────────
  // If per-phase data is missing, fall back to the single aggregated U column.
  const vHarmonicOpts = useMemo(() => {
    if (voltHarmonics.usingSingle) {
      return harmonicGroupedBarOption({
        title: 'Harmonic Order — Voltage (H1–H25, avg %)',
        orders: HARMONIC_DISPLAY,
        phaseR: { name: 'U', data: voltHarmonics.single },
        phaseY: { name: '', data: [] },
        phaseB: { name: '', data: [] },
      })
    }
    return harmonicGroupedBarOption({
      title: 'Harmonic Order — Voltage (H1–H25, avg %)',
      orders: HARMONIC_DISPLAY,
      phaseR: { name: 'U12 (R)', data: voltHarmonics.u12 },
      phaseY: { name: 'U23 (Y)', data: voltHarmonics.u23 },
      phaseB: { name: 'U31 (B)', data: voltHarmonics.u31 },
    })
  }, [voltHarmonics])

  // ── 12. Harmonic Order — Current (grouped bars R/Y/B) ────────────────────
  // If per-phase data is missing, fall back to the single aggregated A column.
  const iHarmonicOpts = useMemo(() => {
    if (currHarmonics.usingSingle) {
      return harmonicGroupedBarOption({
        title: 'Harmonic Order — Current (H1–H25, avg %)',
        orders: HARMONIC_DISPLAY,
        phaseR: { name: 'A', data: currHarmonics.single },
        phaseY: { name: '', data: [] },
        phaseB: { name: '', data: [] },
      })
    }
    return harmonicGroupedBarOption({
      title: 'Harmonic Order — Current (H1–H25, avg %)',
      orders: HARMONIC_DISPLAY,
      phaseR: { name: 'A1 (R)', data: currHarmonics.a1 },
      phaseY: { name: 'A2 (Y)', data: currHarmonics.a2 },
      phaseB: { name: 'A3 (B)', data: currHarmonics.a3 },
    })
  }, [currHarmonics])

  const qualityScore = data?.data_quality?.quality_score ? Math.round(data.data_quality.quality_score) : 0
  const qualityTone = qualityScore >= 80 ? 'emerald' : qualityScore >= 60 ? 'yellow' : 'red'

  useEffect(() => {
    if (!qualityMenuOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && qualityMenuRef.current && !qualityMenuRef.current.contains(target)) {
        setQualityMenuOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setQualityMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [qualityMenuOpen])

  // Escape closes the range picker. We deliberately do NOT collapse on
  // outside-click: clicks inside the inline calendar would otherwise count as
  // "outside" and collapse the whole panel mid-selection. The user closes it
  // explicitly via the minimize chevron (or each picker's own OK button).
  useEffect(() => {
    if (isRangePickerCollapsed) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // First Escape closes an open calendar; a second collapses the panel.
      if (openPicker) {
        setOpenPicker(null)
      } else {
        setIsRangePickerCollapsed(true)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isRangePickerCollapsed, openPicker])

  if (dbLoading) {
    return <Loading3D fullScreen message="Loading dashboard session..." />
  }

  // ── Early return if no session ───────────────────────────────────────────
  if (!data) {
    return (
      <Card className="mx-auto max-w-xl border border-dashed border-[#eb8317]/45 bg-white/70">
        <CardHeader>
          <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-[#eb8317]/12 text-[#eb8317]">
            <FileWarning />
          </div>
          <CardTitle>No active session</CardTitle>
          <CardDescription>
            Upload a PQ export first — the dashboard never reads raw vendor frames directly from disk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild><Link to="/upload">Go to upload</Link></Button>
        </CardContent>
      </Card>
    )
  }

  // Range-aware analytics resolved to a concrete value (data is non-null here).
  const analytics = viewAnalytics ?? data.analytics

  const exportPdf = async () => {
    if (!reportRef.current) return
    setPdfBusy(true)
    try {
      const chartElements = Array.from(reportRef.current.querySelectorAll<HTMLElement>('[data-report-chart]'))
      await exportPqReportPdf({
        metadata: data.metadata,
        filename: data.filename,
        totalRows: data.total_rows,
        analytics,
        voltageHarmonicSpectrum: data.voltage_harmonic_spectrum,
        currentHarmonicSpectrum: data.current_harmonic_spectrum,
        aiObservations: data.ai_observations,
        chartElements,
        saveAs: buildDownloadName(data.metadata.company_name, 'pdf', data.metadata.audit_date),
      })
    } finally {
      setPdfBusy(false)
    }
  }

  const downloadNormalizedExcel = async () => {
    setNormalizedExcelBusy(true)
    try {
      const { blob } = await downloadNormalizedSessionExcel(data.session_id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = buildDownloadName(data.metadata.company_name, 'xlsx', data.metadata.audit_date)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } finally {
      setNormalizedExcelBusy(false)
    }
  }

  return (
    <div ref={reportRef} className="space-y-8 bg-transparent">

      {/* ── KPI strip — top of page ──────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Voltage imbalance"
          subtitle="Phase envelope"
          value={`${formatMetric(analytics.voltage.imbalance_pct, 2)}%`}
        />
        <KpiCard
          title="Current imbalance"
          subtitle="Phase envelope"
          value={`${formatMetric(analytics.current.imbalance_pct, 2)}%`}
        />
        <KpiCard
          title="Avg PF"
          subtitle="Site power factor"
          value={formatMetric(analytics.pf.avg, 3)}
        />
        <KpiCard
          title="Avg frequency"
          subtitle="Network stability"
          value={`${formatMetric(analytics.frequency.avg, 2)} Hz`}
        />
      </div>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="liquid-glass-card rounded-3xl p-6 sm:p-8"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#10375c]/10 bg-white/70 px-3 py-1 shadow-sm">
                <LayoutDashboard className="size-3.5 text-[#10375c]" strokeWidth={2.5} />
                <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#10375c]/75">
                  Analytics cockpit
                </p>
              </div>
              <div ref={qualityMenuRef} className="relative" onMouseLeave={() => setQualityMenuOpen(false)}>
                <button
                  type="button"
                  onClick={() => setQualityMenuOpen((open) => !open)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] shadow-sm transition duration-200 hover:-translate-y-[1px] hover:shadow-md ${
                    qualityMenuOpen
                      ? 'border-emerald-400/80 bg-emerald-500/20 text-emerald-800'
                      : qualityTone === 'emerald'
                        ? 'border-emerald-200/70 bg-emerald-500/10 text-emerald-700'
                        : qualityTone === 'yellow'
                          ? 'border-yellow-200/70 bg-yellow-500/12 text-yellow-700'
                          : 'border-red-200/70 bg-red-500/10 text-red-700'
                  }`}
                >
                  Quality {qualityScore}/100
                  <ChevronDown
                    className={`size-3 transition-transform duration-200 ${qualityMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {qualityMenuOpen && (() => {
                  // Compact aggregate counters so the panel never needs scroll
                  const outliers = data.data_quality.outliers_removed
                  const gaps = data.data_quality.gaps_filled
                  const scaleFixes = data.data_quality.scale_fixes
                  const warns = data.data_quality.three_phase_warn
                  const completeness = data.data_quality.column_completeness
                  const totalOutliers = Object.values(outliers).reduce((a, b) => a + b, 0)
                  const totalGaps = Object.values(gaps).reduce((a, b) => a + b, 0)
                  const completenessRows = Object.entries(completeness)
                  // 3-col layout fits ~24 rows; if there are more we tighten typography
                  return (
                  <div className="absolute left-0 z-20 mt-2 w-[min(30rem,calc(100vw-1rem))] overflow-hidden rounded-[1.75rem] border border-white/50 bg-white/30 p-3 shadow-[0_24px_70px_rgba(16,55,92,0.16)] backdrop-blur-[32px] sm:w-[30rem]">
                    {/* Liquid-glass sheen — neutral white→blue, no yellow */}
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.85),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.25),rgba(255,255,255,0.06)_45%,rgba(16,185,129,0.10))]" />

                    {/* Header row */}
                    <div className="relative mb-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <CircleCheck className="size-4 text-emerald-600" />
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-700">
                          Data quality
                        </p>
                      </div>
                      <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 shadow-sm">
                        {qualityScore >= 80 ? 'Excellent' : qualityScore >= 60 ? 'Good' : 'Needs review'}
                      </span>
                    </div>

                    {/* 3 quick-stat tiles — score / outliers / gaps */}
                    <div className="relative mb-3 grid grid-cols-3 gap-2">
                      <div className="rounded-[1rem] border border-emerald-300/40 bg-emerald-500/10 px-2.5 py-2 text-center shadow-sm">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-700/80">Score</p>
                        <p className="mt-0.5 text-lg font-extrabold leading-none text-emerald-800">{qualityScore}</p>
                        <p className="mt-0.5 text-[9px] text-emerald-700/70">/ 100</p>
                      </div>
                      <div className="rounded-[1rem] border border-white/50 bg-white/40 px-2.5 py-2 text-center shadow-sm">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-[#10375c]/65">Outliers</p>
                        <p className="mt-0.5 text-lg font-extrabold leading-none text-[#10375c]">{totalOutliers}</p>
                        <p className="mt-0.5 text-[9px] text-[#10375c]/55">removed</p>
                      </div>
                      <div className="rounded-[1rem] border border-white/50 bg-white/40 px-2.5 py-2 text-center shadow-sm">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-[#10375c]/65">Gaps</p>
                        <p className="mt-0.5 text-lg font-extrabold leading-none text-[#10375c]">{totalGaps}</p>
                        <p className="mt-0.5 text-[9px] text-[#10375c]/55">filled</p>
                      </div>
                    </div>

                    {/* Column completeness — 3-column compact grid, no scroll */}
                    <div className="relative mb-2.5 rounded-[1.1rem] border border-white/45 bg-white/40 px-3 py-2 shadow-sm backdrop-blur-sm">
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-700">
                        Column completeness
                      </p>
                      <div className="grid grid-cols-3 gap-x-2.5 gap-y-1">
                        {completenessRows.map(([c, pct]) => (
                          <div key={c} className="flex items-center gap-1.5 text-[10px]">
                            <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: colDotColor(c) }} />
                            <span className="flex-1 truncate font-mono font-semibold text-[#10375c]/75">{shortColLabel(c)}</span>
                            <span className={`font-mono text-[9px] font-bold ${pct >= 95 ? 'text-emerald-700' : pct >= 75 ? 'text-amber-700' : 'text-red-700'}`}>
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Per-column "Outliers removed" and "Gaps interpolated"
                        lists are intentionally omitted — the headline counts
                        in the 3 stat tiles above already convey the totals
                        and the per-column breakdown bloated the panel. */}

                    {/* Unit fixes — inline chips */}
                    {Object.keys(scaleFixes).length > 0 && (
                      <div className="relative mb-2 rounded-[1.1rem] border border-white/45 bg-white/40 px-3 py-2 shadow-sm backdrop-blur-sm">
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-700">
                          Unit fixes
                        </p>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px]">
                          {Object.entries(scaleFixes).map(([c, fix]) => (
                            <span key={c} className="font-mono text-[#10375c]/80">
                              {shortColLabel(c)} <span className="font-bold text-blue-700">{fix}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Warnings — only if any */}
                    {warns.length > 0 && (
                      <div className="relative rounded-[1.1rem] border border-white/45 bg-white/40 px-3 py-2 shadow-sm backdrop-blur-sm">
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-700">
                          Warnings
                        </p>
                        <div className="space-y-0.5 text-[10px] text-[#10375c]/85">
                          {warns.map((warning) => (
                            <p key={warning}>· {warning}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  )
                })()}
              </div>
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-[#10375c]">{data.metadata.plant_name}</h1>
            <p className="mt-2 max-w-3xl text-sm text-[#10375c]/70">
              {data.metadata.company_name} · {data.metadata.machine_name} · {data.metadata.engineer_name}
              <br />
              Audit {data.metadata.audit_date} · Analyzer{' '}
              <span className="font-semibold">{data.metadata.pq_analyzer_type}</span>
              {' '}· File {data.filename} · {data.returned_rows} / {data.total_rows} rows
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={normalizedExcelBusy} onClick={downloadNormalizedExcel}>
              <Download className="size-4" />
              {normalizedExcelBusy ? 'Preparing Excel…' : 'Download normalized file'}
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/upload"><Plus className="size-4" /> Add file</Link>
            </Button>
            <Button type="button" variant="accent" disabled={pdfBusy} onClick={exportPdf}>
              <Printer className="size-4" /> Download audit PDF
            </Button>
          </div>
        </div>

        {/* ── Site Summary + Recording Summary — stacked full-width
              Both use the project's `glass-panel` look with a light-blue tint
              so they sit consistently next to every other dashboard card.
              Typography matches the CardTitle/CardDescription pair used
              throughout the app (text-lg semibold header + text-sm/65 body). */}
        {measurementPeriod && (
          <div className="mt-6 flex flex-col gap-4">
            {/* ── TOP: Site Summary Panel (full width, light-blue glass) ── */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="liquid-glass-card rounded-2xl p-5"
            >
              {/* Header — matches CardTitle/CardDescription typography */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-blue-500/15 p-2">
                    <Gauge className="size-5 text-blue-700" strokeWidth={2.5} />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight text-[#10375c]">
                    Site Summary
                  </h3>
                </div>
              </div>

              {/* Stat grid — 4 cols on wide, 2 on narrow */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {
                    key: 'kw', label: 'Active Power', unit: 'kW',
                    value: formatMetric(analytics.kw.avg),
                    icon: <Zap className="size-4 fill-blue-600 text-blue-600" strokeWidth={2.5} />,
                    accent: 'border-blue-200/70 bg-blue-50/55 hover:bg-blue-100/70 hover:border-blue-300/80',
                    labelClass: 'text-blue-700',
                    sub: 'average',
                  },
                  {
                    key: 'kva', label: 'Apparent', unit: 'kVA',
                    value: formatMetric(analytics.kva.avg),
                    icon: <Activity className="size-4 text-indigo-600" strokeWidth={2.5} />,
                    accent: 'border-indigo-200/70 bg-indigo-50/55 hover:bg-indigo-100/70 hover:border-indigo-300/80',
                    labelClass: 'text-indigo-700',
                    sub: 'average',
                  },
                ].map(s => (
                  <motion.div
                    key={s.key}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className={`group relative cursor-default overflow-hidden rounded-xl border p-3.5 shadow-sm transition-colors duration-200 ${s.accent}`}
                  >
                    <div className="flex items-center gap-2">
                      {s.icon}
                      <p className={`text-xs font-bold uppercase tracking-wider ${s.labelClass}`}>{s.label}</p>
                    </div>
                    <p className="mt-2 text-2xl font-extrabold leading-tight text-[#10375c]">
                      {s.value}
                      <span className="ml-1.5 text-sm font-medium text-[#10375c]/55">{s.unit}</span>
                    </p>
                    <p className="text-xs text-[#10375c]/55">{s.sub}</p>
                  </motion.div>
                ))}

                {/* Voltage & Current THD — refined 3-column layout
                    Each phase gets a coloured pill (R/Y/B), a big mono value,
                    and a tiny normalised bar that visualises its magnitude
                    relative to the worst phase in the trio. No more cluttered
                    "% · R / Y / B" caption. */}
                {[
                  {
                    key: 'vthd',
                    label: 'Voltage THD',
                    accent: 'border-blue-200/70 bg-blue-50/45 hover:border-blue-300/80 hover:bg-blue-100/60',
                    iconColor: 'text-blue-700',
                    phases: [
                      { letter: 'R', color: '#e74c3c', value: analytics.vthd.phase_a.avg },
                      { letter: 'Y', color: '#f3c623', value: analytics.vthd.phase_b.avg },
                      { letter: 'B', color: '#2980b9', value: analytics.vthd.phase_c.avg },
                    ],
                  },
                  {
                    key: 'ithd',
                    label: 'Current THD',
                    accent: 'border-sky-200/70 bg-sky-50/45 hover:border-sky-300/80 hover:bg-sky-100/60',
                    iconColor: 'text-sky-700',
                    phases: [
                      { letter: 'R', color: '#e74c3c', value: analytics.ithd.phase_a.avg },
                      { letter: 'Y', color: '#f3c623', value: analytics.ithd.phase_b.avg },
                      { letter: 'B', color: '#2980b9', value: analytics.ithd.phase_c.avg },
                    ],
                  },
                ].map(card => {
                  const numericPhases = card.phases.map(p => ({ ...p, n: Number(p.value) || 0 }))
                  const maxVal = Math.max(...numericPhases.map(p => p.n), 0.0001)
                  return (
                    <motion.div
                      key={card.key}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      className={`group relative cursor-default overflow-hidden rounded-xl border p-3.5 shadow-sm transition-colors duration-200 ${card.accent}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Waves className={`size-4 ${card.iconColor}`} strokeWidth={2.5} />
                          <p className={`text-xs font-bold uppercase tracking-wider ${card.iconColor}`}>{card.label}</p>
                        </div>
                        <span className="text-[10px] font-medium text-[#10375c]/45">avg %</span>
                      </div>
                      <div className="mt-2.5 grid grid-cols-3 gap-2">
                        {numericPhases.map(p => (
                          <div key={p.letter} className="flex flex-col items-start gap-1">
                            <div className="flex items-baseline gap-1.5">
                              <span
                                className="inline-flex size-4 items-center justify-center rounded-md text-[9px] font-extrabold leading-none text-white shadow-sm"
                                style={{ backgroundColor: p.color }}
                              >
                                {p.letter}
                              </span>
                              <span className="font-mono text-sm font-bold tracking-tight text-[#10375c]">
                                {formatMetric(p.n)}
                              </span>
                            </div>
                            <div className="h-1 w-full overflow-hidden rounded-full bg-[#10375c]/08">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.min(100, (p.n / maxVal) * 100)}%`,
                                  backgroundColor: p.color,
                                  opacity: 0.85,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )
                })}
              </div>

            </motion.div>

            {/* ── BOTTOM: Recording Summary Panel (full width) ──────── */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.55, ease: 'easeOut', delay: 0.08 }}
              className="liquid-glass-card rounded-2xl p-5"
            >
              {/* Header — matches CardTitle/CardDescription typography */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-[#10375c]/12 p-2">
                    <Activity className="size-5 text-[#10375c]" strokeWidth={2.5} />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight text-[#10375c]">
                    Recording Summary
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-3 py-1">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    Complete
                  </span>
                </div>
              </div>

              {/* Stat grid — premium tile look:
                  · rich top-to-bottom gradient (color-tinted on top, near-white at bottom)
                  · a thin accent stripe pinned to the very top edge in the tile color
                  · iconography sits inside a small color-filled chip for instant identity
                  · hover lifts + reveals a stronger gradient
                  · subtle inner glow via ring-1 for the liquid-glass look */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {
                    key: 'dur', label: 'Duration', value: measurementPeriod.duration, sub: 'total time',
                    icon: <Clock className="size-4 text-white" strokeWidth={2.5} />,
                    chip: 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/30',
                    bg:   'from-emerald-50 via-emerald-50/40 to-white',
                    hover: 'group-hover:from-emerald-100 group-hover:via-emerald-50/70',
                    ring: 'ring-emerald-200/60',
                    stripe: 'from-emerald-400 via-emerald-500 to-emerald-400',
                    labelClass: 'text-emerald-700',
                    mono: false,
                  },
                  {
                    key: 'samples', label: 'Samples', value: measurementPeriod.totalRows.toLocaleString(), sub: 'data points',
                    icon: <BarChart3 className="size-4 text-white" strokeWidth={2.5} />,
                    chip: 'bg-gradient-to-br from-violet-400 to-purple-600 shadow-purple-500/30',
                    bg:   'from-violet-50 via-purple-50/40 to-white',
                    hover: 'group-hover:from-violet-100 group-hover:via-purple-50/70',
                    ring: 'ring-purple-200/60',
                    stripe: 'from-violet-400 via-purple-500 to-fuchsia-400',
                    labelClass: 'text-purple-700',
                    mono: false,
                  },
                  {
                    key: 'start', label: 'Started', value: measurementPeriod.start.time,
                    sub: `${measurementPeriod.start.dayName.slice(0, 3)} · ${measurementPeriod.start.month} ${measurementPeriod.start.day}`,
                    icon: <Play className="size-4 fill-white text-white" strokeWidth={2.5} />,
                    chip: 'bg-gradient-to-br from-sky-400 to-blue-600 shadow-blue-500/30',
                    bg:   'from-sky-50 via-blue-50/40 to-white',
                    hover: 'group-hover:from-sky-100 group-hover:via-blue-50/70',
                    ring: 'ring-blue-200/60',
                    stripe: 'from-sky-400 via-blue-500 to-cyan-400',
                    labelClass: 'text-blue-700',
                    mono: true,
                  },
                  {
                    key: 'stop', label: 'Stopped', value: measurementPeriod.end.time,
                    sub: `${measurementPeriod.end.dayName.slice(0, 3)} · ${measurementPeriod.end.month} ${measurementPeriod.end.day}`,
                    icon: <Square className="size-4 fill-white text-white" strokeWidth={2.5} />,
                    chip: 'bg-gradient-to-br from-orange-400 to-rose-500 shadow-orange-500/30',
                    bg:   'from-orange-50 via-rose-50/40 to-white',
                    hover: 'group-hover:from-orange-100 group-hover:via-rose-50/70',
                    ring: 'ring-orange-200/60',
                    stripe: 'from-orange-400 via-rose-500 to-pink-400',
                    labelClass: 'text-rose-700',
                    mono: true,
                  },
                ].map(s => (
                  <motion.div
                    key={s.key}
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.98 }}
                    className={`group relative cursor-default overflow-hidden rounded-2xl ring-1 ${s.ring} bg-gradient-to-b ${s.bg} ${s.hover} p-3.5 shadow-[0_6px_18px_rgba(16,55,92,0.06)] transition-all duration-300 hover:shadow-[0_12px_28px_rgba(16,55,92,0.10)]`}
                  >
                    {/* Top accent stripe */}
                    <div className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${s.stripe}`} />
                    {/* Soft top-left highlight (glass sheen) */}
                    <div className="pointer-events-none absolute -top-6 -left-6 size-16 rounded-full bg-white/60 blur-xl opacity-70" />

                    <div className="relative flex items-center gap-2">
                      <span className={`inline-flex size-7 items-center justify-center rounded-lg shadow-md ${s.chip}`}>
                        {s.icon}
                      </span>
                      <p className={`text-xs font-bold uppercase tracking-wider ${s.labelClass}`}>{s.label}</p>
                    </div>
                    <p className={`relative mt-2.5 text-2xl font-extrabold leading-tight text-[#10375c] ${s.mono ? 'font-mono text-xl' : ''}`}>
                      {s.value}
                    </p>
                    <p className="relative text-xs text-[#10375c]/55">{s.sub}</p>
                  </motion.div>
                ))}
              </div>

              {/* Footer: Sampling rate + date range */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/55 px-4 py-2.5 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <Timer className="size-4 text-[#10375c]/70" strokeWidth={2.5} />
                  <span className="text-sm text-[#10375c]/75">
                    Sampling{' '}
                    <span className="font-bold text-[#10375c]">{measurementPeriod.sampling}</span>{' '}
                    per reading
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarCheck className="size-4 text-[#10375c]/70" strokeWidth={2.5} />
                  <span className="text-sm text-[#10375c]/75">
                    {measurementPeriod.sameDay ? (
                      <>
                        <span className="font-bold text-[#10375c]">Single-day</span> recording
                      </>
                    ) : (
                      <>
                        <span className="font-bold text-[#10375c]">Multi-day</span> recording
                      </>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Gauge className="size-4 text-[#10375c]/70" strokeWidth={2.5} />
                  <span className="text-sm text-[#10375c]/75">
                    Analyzer{' '}
                    <span className="font-bold text-[#10375c]">{data.metadata.pq_analyzer_type}</span>
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        <div className="mt-8 mb-8">
          <AnalyticsSummaryTable analytics={analytics} />
        </div>

      </motion.section>

      {/* ── AI observations ────────────────────────────────────────── */}
      <section>
        <Card className="border border-white/70">
          <CardHeader>
            <CardTitle>AI observations</CardTitle>
            <CardDescription>Deterministic heuristics — swap with LLM scoring later without touching parsers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-[#10375c]/80">
            {data.ai_observations.map((o) => (
              <div key={o} className="rounded-2xl border border-[#10375c]/10 bg-white/70 px-4 py-3">{o}</div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* ── 12 PQ Charts ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        {/* ── Time Range Filter — sticky so it's always one mouse-flick away
              while scrolling charts.  Liquid-glass card matching the rest of
              the dashboard.  Empty range strings = no filter; presets compute
              relative to the end of the recording. */}
        {measurementPeriod && (() => {
          const fullStart = toDateTimeLocal(measurementPeriod.start.raw)
          const fullEnd   = toDateTimeLocal(measurementPeriod.end.raw)
          const isFiltered = Boolean(rangeStart || rangeEnd)
          const pct = allRows.length
            ? Math.round((rows.length / allRows.length) * 100)
            : 100
          // Compute the highlighted segment of the timeline (left%, width%)
          const startMs = rangeStart
            ? new Date(rangeStart).getTime()
            : measurementPeriod.start.raw.getTime()
          const endMs = rangeEnd
            ? new Date(rangeEnd).getTime()
            : measurementPeriod.end.raw.getTime()
          const fullSpan = Math.max(1, measurementPeriod.durationMs)
          const leftPct = Math.max(0, Math.min(100,
            ((startMs - measurementPeriod.start.raw.getTime()) / fullSpan) * 100,
          ))
          const widthPct = Math.max(0, Math.min(100 - leftPct,
            ((endMs - startMs) / fullSpan) * 100,
          ))
          if (isRangePickerCollapsed) {
            return (
              <motion.button
                key="collapsed-picker"
                layoutId="floating-range-picker"
                onClick={() => {
                  setOpenPicker(null)
                  setIsRangePickerCollapsed(false)
                }}
                className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-full border border-blue-500/50 bg-[#10375c]/85 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-[0_8px_30px_rgb(59_130_246_/_0.3)] backdrop-blur-md transition-all hover:bg-[#10375c] hover:scale-105 cursor-pointer"
              >
                <Filter className="size-4 text-cyan-400" strokeWidth={2.5} />
                <span>Filter Range</span>
                {isFiltered && (
                  <span className="size-2 rounded-full bg-cyan-400 animate-pulse" />
                )}
              </motion.button>
            )
          }

          return (
            <motion.div
              ref={rangePickerRef}
              key="expanded-picker"
              layoutId="floating-range-picker"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="fixed bottom-6 left-6 z-50 w-[320px] rounded-2xl border border-blue-500/45 bg-[#10375c]/35 p-4 shadow-[0_16px_40px_rgba(16,55,92,0.25)] backdrop-blur-2xl text-white"
            >
              {/* Header row */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 p-1.5 shadow-md shadow-blue-500/20">
                    <Filter className="size-4 text-white" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold tracking-tight text-white">Time Range</h3>
                    <p className="text-[10px] text-blue-200/80">
                      Showing <span className="font-bold text-white">{rows.length.toLocaleString()}</span> of {allRows.length.toLocaleString()} ({pct}%)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {isFiltered && (
                    <button
                      type="button"
                      onClick={() => applyRangePreset('all')}
                      className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold text-white transition hover:bg-white/20 cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setOpenPicker(null)
                      setIsRangePickerCollapsed(true)
                    }}
                    className="rounded-full p-1 text-blue-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
                    title="Minimize"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                </div>
              </div>

              {/* Date pickers — stacked. Each has its own OK button inside the
                  inline calendar; picking a Start and pressing OK closes that
                  calendar and returns here so the End time can be chosen next. */}
              <div className="space-y-2">
                <DateTimePicker
                  label="Start Time"
                  accent="cyan"
                  value={rangeStart}
                  min={fullStart}
                  max={rangeEnd || fullEnd}
                  onChange={setRangeStart}
                  open={openPicker === 'start'}
                  onOpenChange={(o) => setOpenPicker(o ? 'start' : null)}
                  placeholder="Pick start date & time"
                />
                <DateTimePicker
                  label="End Time"
                  accent="orange"
                  value={rangeEnd}
                  min={rangeStart || fullStart}
                  max={fullEnd}
                  onChange={setRangeEnd}
                  open={openPicker === 'end'}
                  onOpenChange={(o) => setOpenPicker(o ? 'end' : null)}
                  placeholder="Pick end date & time"
                />
              </div>

              {/* Quick presets */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-blue-200">Quick:</span>
                {[
                  { key: 'all', label: 'Full' },
                  { key: '24h', label: '24h' },
                  { key: '6h',  label: '6h'  },
                  { key: '1h',  label: '1h'  },
                ].map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyRangePreset(p.key as 'all' | '1h' | '6h' | '24h')}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-blue-100 transition hover:bg-white/15 hover:text-white cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Visual timeline indicator */}
              <div className="mt-3">
                <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="absolute inset-y-0 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 shadow-sm"
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[9px] font-mono text-blue-200/60">
                  <span>{measurementPeriod.start.time} · {measurementPeriod.start.dayName.slice(0, 3)}</span>
                  <span>{measurementPeriod.end.time} · {measurementPeriod.end.dayName.slice(0, 3)}</span>
                </div>
              </div>
            </motion.div>
          )
        })()}

        <h2 className="text-xl font-semibold text-[#10375c] px-1">Power Quality Charts</h2>
        <div className="grid gap-4 xl:grid-cols-2 [&_.echarts]:rounded-2xl">

          {/* 1 — Variation of Voltages */}
          {hasAny('voltage_phase_a', 'voltage_phase_b', 'voltage_phase_c') && (
            <ChartCard option={vOpts} reportTitle="Variation of Voltages" />
          )}

          {/* 2 — Variation of Current */}
          {hasAny('current_phase_a', 'current_phase_b', 'current_phase_c') && (
            <ChartCard option={iOpts} reportTitle="Variation of Current" />
          )}

          {/* 3 — Variation of kW */}
          {mappedCols.has('kw') && (
            <ChartCard option={kwOpts} reportTitle="Variation of Active Power (kW)" />
          )}

          {/* 4 — Variation of kVAR */}
          {hasAny('kvar', 'nkvar', 'dkvar') && (
            <ChartCard option={kvarOpts} reportTitle="Variation of Reactive Power (kVAR)" />
          )}

          {/* 5 — Variation of kVA */}
          {mappedCols.has('kva') && (
            <ChartCard option={kvaOpts} reportTitle="Variation of Apparent Power (kVA)" />
          )}

          {/* 6 — Variation of PF */}
          {mappedCols.has('pf') && (
            <ChartCard option={pfOpts} reportTitle="Variation of Power Factor" />
          )}

          {/* 7 — Variation of VTHD */}
          {hasAny('vthd_a', 'vthd_b', 'vthd_c') && (
            <ChartCard option={vthdOpts} reportTitle="Variation of Voltage THD" />
          )}

          {/* 8 — Variation of ITHD */}
          {hasAny('ithd_a', 'ithd_b', 'ithd_c') && (
            <ChartCard option={ithdOpts} reportTitle="Variation of Current THD" />
          )}

          {/* 9 — Dip & Swell Monitoring — Voltage */}
          {hasAny('Urms12_min', 'Urms12_max', 'Urms23_min', 'Urms23_max', 'Urms31_min', 'Urms31_max') && (
            <ChartCard option={dipSwellVOpts} reportTitle="Dip & Swell Monitoring — Voltage" />
          )}

          {/* 10 — Dip & Swell Monitoring — Current */}
          {hasAny('Arms1_min', 'Arms1_max', 'Arms2_min', 'Arms2_max', 'Arms3_min', 'Arms3_max') && (
            <ChartCard option={dipSwellIOpts} reportTitle="Dip & Swell Monitoring — Current" />
          )}

          {/* 11 — Harmonic Order — Voltage (per-phase U12/U23/U31 or single U) */}
          {hasAny(
            // per-phase padded
            'U12_%FH01', 'U23_%FH01', 'U31_%FH01',
            // per-phase unpadded
            'U12_%FH1',  'U23_%FH1',  'U31_%FH1',
            // single aggregated (padded + unpadded)
            'U_%FH01', 'U_%FH1',
          ) && (
            <ChartCard option={vHarmonicOpts} reportTitle="Harmonic Order — Voltage" height={320} />
          )}

          {/* 12 — Harmonic Order — Current (per-phase A1/A2/A3 or single A) */}
          {hasAny(
            // per-phase padded
            'A1_%FH01', 'A2_%FH01', 'A3_%FH01',
            // per-phase unpadded
            'A1_%FH1',  'A2_%FH1',  'A3_%FH1',
            // single aggregated (padded + unpadded — covers user's A_%FH1..A_%FH25)
            'A_%FH01', 'A_%FH1',
          ) && (
            <ChartCard option={iHarmonicOpts} reportTitle="Harmonic Order — Current" height={320} />
          )}

        </div>
      </section>


      <DataGrid
        sessionId={data.session_id}
        companyName={data.metadata.company_name}
        auditDate={data.metadata.audit_date}
      />
    </div>
  )
}
