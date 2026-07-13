import type { EChartsOption } from 'echarts'

const palette = ['#10375c', '#f3c623', '#eb8317', '#5c8eb8', '#c9d6ec']
import { sampleMultiSeries, getOptimalSampling } from '@/utils/dataSampling'

// Phase colours used across all charts
export const PHASE_COLORS = {
  R: '#e74c3c',  // R phase (L1 / A)
  Y: '#f3c623',  // Y phase (L2 / B)
  B: '#2980b9',  // B phase (L3 / C)
}

export function baseChartOption(): Partial<EChartsOption> {
  return {
    color: palette,
    backgroundColor: 'transparent',
    textStyle: {
      color: '#10375c',
      fontFamily:
        'Inter, ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica, Arial',
    },
    // Leave generous top room so title, toolbox, and legend never sit over the data
    grid: { left: 56, right: 24, top: 96, bottom: 56 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.98)',
      borderColor: 'rgba(16,55,92,0.18)',
      borderWidth: 1,
      padding: [6, 10],
      textStyle: { color: '#10375c', fontSize: 11 },
      confine: true,
      extraCssText: 'box-shadow: 0 4px 16px rgba(16,55,92,0.12); border-radius: 8px; z-index: 50;',
    },
    toolbox: {
      right: 8,
      top: 4,
      itemSize: 14,
      itemGap: 6,
      feature: {
        dataZoom: { yAxisIndex: false, title: { zoom: 'Zoom', back: 'Reset zoom' } },
        restore: { title: 'Restore' },
        saveAsImage: { name: 'pq-chart', pixelRatio: 2, title: 'Save' },
      },
    },
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
      {
        type: 'slider',
        xAxisIndex: 0,
        height: 16,
        bottom: 8,
        borderColor: 'transparent',
        fillerColor: 'rgba(16,55,92,0.12)',
        handleStyle: { color: '#10375c' },
      },
    ],
  }
}

/** Compute a padded [min, max] y-range from all series data, ignoring nulls. */
function yRange(
  series: { data: (number | null | undefined)[] }[],
  padFraction = 0.08,
): [number | undefined, number | undefined] {
  const vals: number[] = []
  for (const s of series)
    for (const v of s.data)
      if (v !== null && v !== undefined && !Number.isNaN(v)) vals.push(v)
  if (vals.length === 0) return [undefined, undefined]
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const span = hi - lo || Math.abs(hi) * 0.1 || 1
  const paddedLo = lo - span * padFraction
  return [
    // All-positive data stays anchored at 0; when the series contains negative
    // values (e.g. kVAR/nkVAR/dkVAR with reverse power flow) the axis extends
    // below zero so those points stay visible.
    parseFloat((lo >= 0 ? Math.max(0, paddedLo) : paddedLo).toFixed(4)),
    parseFloat((hi + span * padFraction).toFixed(4)),
  ]
}

// ── Time-series line chart ────────────────────────────────────────────────────

export function timeSeriesOption(params: {
  title: string
  timestamps: string[]
  series: { name: string; color?: string; data: (number | null | undefined)[]; smooth?: boolean }[]
  yName?: string
  refLines?: { value: number; label: string; color?: string }[]
}): EChartsOption {
  const opt = baseChartOption()

  const sampling = getOptimalSampling(params.timestamps.length)
  let finalTimestamps = params.timestamps
  let finalSeries = params.series

  if (sampling.shouldSample) {
    const { timestamps, series } = sampleMultiSeries(
      params.timestamps,
      params.series.map((s) => s.data),
      sampling.maxPoints,
    )
    finalTimestamps = timestamps
    finalSeries = params.series.map((s, idx) => ({ ...s, data: series[idx] }))
  }

  // Always use category axis — it renders regardless of timestamp format.
  // (type:'time' silently drops data points with unparseable dates, e.g. Excel serials)
  const hasLabels = finalTimestamps.length > 0 && finalTimestamps.some(t => t !== '')

  const seriesData = finalSeries.map((s) =>
    s.data.map((v) => {
      if (v === null || Number.isNaN(v as number)) return null
      return Number(v)
    }),
  )

  // For category axis: use actual timestamps as labels, or row-index numbers as fallback
  const xCategories = hasLabels
    ? finalTimestamps
    : finalTimestamps.map((_, i) => String(i))

  const [yMin, yMax] = yRange(finalSeries)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const refLineSeries: any[] = (params.refLines ?? []).map((r) => ({
    name: r.label,
    type: 'line',
    showSymbol: false,
    silent: true,
    data: [],
    markLine: {
      silent: true,
      symbol: 'none',
      data: [{ yAxis: r.value }],
      label: {
        formatter: `${r.label} (${r.value})`,
        color: r.color ?? '#10375c99',
        fontSize: 10,
      },
      lineStyle: { color: r.color ?? '#10375c55', type: 'dashed', width: 1 },
    },
  }))

  return {
    ...opt,
    title: {
      text: params.title,
      left: 12,
      top: 8,
      textStyle: { fontSize: 14, fontWeight: 600, color: '#10375c' },
    },
    legend: {
      top: 36,
      left: 12,
      right: 110,
      textStyle: { color: '#10375c', fontSize: 11 },
      type: 'scroll',
      itemWidth: 12,
      itemHeight: 8,
      itemGap: 10,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xCategories,
      axisLabel: {
        color: '#10375c',
        rotate: 0,
        fontSize: 10,
        // Show only a subset of labels so they don't overlap
        interval: Math.max(0, Math.floor(xCategories.length / 6) - 1),
        overflow: 'truncate',
        // Show only the TIME portion (HH:MM:SS) — strip the date prefix
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (val: any) => {
          const s = String(val)
          // "2025-05-21 10:30:00" → "10:30:00"
          if (s.includes(' ')) return s.split(' ')[1] ?? s
          // "2025-05-21T10:30:00" → "10:30:00"
          if (s.includes('T')) return s.split('T')[1]?.slice(0, 8) ?? s
          return s
        },
      },
      splitLine: { show: false },
    },
    grid: { left: 56, right: 24, top: 96, bottom: 60 },
    yAxis: {
      type: 'value',
      name: params.yName,
      min: yMin,
      max: yMax,
      splitLine: { lineStyle: { color: 'rgba(16,55,92,0.08)' } },
      axisLabel: { color: '#10375c' },
    },
    series: [
      ...finalSeries.map((s, i) => ({
        name: s.name,
        type: 'line' as const,
        showSymbol: false,
        smooth: s.smooth ?? false,
        connectNulls: false,
        sampling: 'lttb' as const,
        large: true,
        largeThreshold: 2000,
        lineStyle: {
          width: 2,
          color: s.color ?? palette[i % palette.length],
          shadowColor: 'rgba(16,55,92,0.2)',
          shadowBlur: 3,
        },
        itemStyle: { color: s.color ?? palette[i % palette.length] },
        areaStyle: {
          opacity: 0.08,
          color: s.color ?? palette[i % palette.length],
        },
        data: seriesData[i],
      })),
      ...refLineSeries,
    ],
  }
}

// ── Grouped harmonic bar chart (3 bars per order: R / Y / B) ──────────────────

export function harmonicGroupedBarOption(params: {
  title: string
  orders: number[]
  phaseR: { name: string; data: number[] }
  phaseY: { name: string; data: number[] }
  phaseB: { name: string; data: number[] }
}): EChartsOption {
  const opt = baseChartOption()
  // Filter out phases that have no data — when the analyzer exports only a
  // single aggregated harmonic column, Y/B come through empty and rendering
  // a phantom legend entry looks like a bug.
  const phases = [
    { ...params.phaseR, color: PHASE_COLORS.R },
    { ...params.phaseY, color: PHASE_COLORS.Y },
    { ...params.phaseB, color: PHASE_COLORS.B },
  ].filter(p => p.name && p.data.length > 0)
  return {
    ...opt,
    title: {
      text: params.title,
      left: 12,
      top: 8,
      textStyle: { fontSize: 14, fontWeight: 600, color: '#10375c' },
    },
    legend: {
      top: 36,
      left: 12,
      right: 110,
      textStyle: { color: '#10375c', fontSize: 11 },
      itemWidth: 12,
      itemHeight: 8,
      itemGap: 10,
      data: phases.map(p => p.name),
    },
    grid: { left: 56, right: 24, top: 96, bottom: 60 },
    xAxis: {
      type: 'category',
      data: params.orders.map((o) => `H${o}`),
      name: 'Harmonic Order',
      nameLocation: 'middle',
      nameGap: 34,
      axisLabel: { color: '#10375c', fontSize: 11 },
    },
    yAxis: {
      // Log scale: H1 ≈ 100 % and H21 ≈ 0.05 % both stay readable on the
      // same chart.  Linear scale collapsed everything below ~5 % onto the
      // axis, hiding the small odd-order harmonics the user cares about.
      type: 'log',
      logBase: 10,
      name: '%',
      min: 0.01,   // 0.01 % floor — anything below is clamped (still visible as a 1-pixel sliver)
      max: 200,    // 200 % ceiling — leaves headroom above the H1=100 % bar
      splitLine: { lineStyle: { color: 'rgba(16,55,92,0.08)' } },
      axisLabel: {
        color: '#10375c',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (v: any) => {
          const n = Number(v)
          if (n >= 100) return `${n.toFixed(0)}%`
          if (n >= 10)  return `${n.toFixed(0)}%`
          if (n >= 1)   return `${n.toFixed(1)}%`
          if (n >= 0.1) return `${n.toFixed(2)}%`
          return `${n.toFixed(3)}%`
        },
      },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: 'rgba(16,55,92,0.12)',
      textStyle: { color: '#10375c' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (params: any) => {
        if (!Array.isArray(params) || !params.length) return ''
        const order = params[0].axisValue
        // Match decimal precision to the value's magnitude so 100% and 0.045%
        // both read cleanly in the same tooltip.
        const fmt = (n: number) => {
          if (n >= 100) return n.toFixed(1)
          if (n >= 10)  return n.toFixed(2)
          if (n >= 1)   return n.toFixed(2)
          if (n >= 0.1) return n.toFixed(3)
          return n.toFixed(4)
        }
        const lines = params.map((p: any) =>
          `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:4px;"></span>${p.seriesName}: <b>${fmt(Number(p.value))}%</b>`
        ).join('<br/>')
        return `<b>${order}</b><br/>${lines}`
      },
    },
    series: phases.map((p, idx) => ({
      name: p.name,
      type: 'bar' as const,
      // Floor at 0.01 % so zero / missing values land exactly on the log-scale
      // baseline instead of trying to render at -infinity.
      data: p.data.map((v) => Math.max(0.01, parseFloat(v.toFixed(4)))),
      itemStyle: { color: p.color, borderRadius: [2, 2, 0, 0] as [number, number, number, number] },
      barMaxWidth: 18,
      // Group-bar tweaks only matter when there is more than one series
      ...(idx === 0 ? { barGap: '8%', barCategoryGap: '30%' } : {}),
    })),
  }
}

// ── Min/Max band time series (for Urms / Arms monitoring) ─────────────────────

export function minMaxBandOption(params: {
  title: string
  timestamps: string[]
  yName: string
  bands: {
    label: string       // e.g. "L1 (R)"
    colorMin: string
    colorMax: string
    dataMin: (number | null | undefined)[]
    dataMax: (number | null | undefined)[]
  }[]
}): EChartsOption {
  const opt = baseChartOption()
  const sampling = getOptimalSampling(params.timestamps.length)
  let finalTs = params.timestamps

  if (sampling.shouldSample) {
    const step = Math.ceil(params.timestamps.length / sampling.maxPoints)
    finalTs = params.timestamps.filter((_, i) => i % step === 0)
    params.bands.forEach((b) => {
      b.dataMin = b.dataMin.filter((_, i) => i % step === 0)
      b.dataMax = b.dataMax.filter((_, i) => i % step === 0)
    })
  }

  const hasLabels = finalTs.length > 0 && finalTs.some(t => t !== '')
  const xCats = hasLabels ? finalTs : finalTs.map((_, i) => String(i))

  const allVals: number[] = []
  for (const b of params.bands) {
    for (const v of [...b.dataMin, ...b.dataMax])
      if (v != null && !isNaN(v) && v >= 0) allVals.push(v as number)
  }
  const lo = allVals.length ? Math.min(...allVals) : undefined
  const hi = allVals.length ? Math.max(...allVals) : undefined
  const span = (lo !== undefined && hi !== undefined) ? (hi - lo || 1) : 1
  const yMin = lo !== undefined ? Math.max(0, parseFloat((lo - span * 0.06).toFixed(2))) : undefined
  const yMax = hi !== undefined ? parseFloat((hi + span * 0.06).toFixed(2)) : undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const series: any[] = []
  params.bands.forEach((b) => {
    series.push({
      name: `${b.label} Min`,
      type: 'line',
      showSymbol: false,
      smooth: false,
      sampling: 'lttb',
      large: true,
      largeThreshold: 2000,
      lineStyle: { width: 1.5, color: b.colorMin, type: 'dashed' },
      itemStyle: { color: b.colorMin },
      data: b.dataMin.map(v => (v != null && v >= 0 ? v : null)),
    })
    series.push({
      name: `${b.label} Max`,
      type: 'line',
      showSymbol: false,
      smooth: false,
      sampling: 'lttb',
      large: true,
      largeThreshold: 2000,
      lineStyle: { width: 2, color: b.colorMax },
      itemStyle: { color: b.colorMax },
      data: b.dataMax.map(v => (v != null && v >= 0 ? v : null)),
    })
  })

  return {
    ...opt,
    title: {
      text: params.title,
      left: 12,
      top: 8,
      textStyle: { fontSize: 14, fontWeight: 600, color: '#10375c' },
    },
    legend: {
      top: 36,
      left: 12,
      right: 110,
      textStyle: { color: '#10375c', fontSize: 11 },
      type: 'scroll',
      itemWidth: 12,
      itemHeight: 8,
      itemGap: 10,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xCats,
      axisLabel: {
        color: '#10375c',
        rotate: 0,
        fontSize: 10,
        interval: Math.max(0, Math.floor(xCats.length / 6) - 1),
        overflow: 'truncate',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (val: any) => {
          const s = String(val)
          if (s.includes(' ')) return s.split(' ')[1] ?? s
          if (s.includes('T')) return s.split('T')[1]?.slice(0, 8) ?? s
          return s
        },
      },
      splitLine: { show: false },
    },
    grid: { left: 56, right: 24, top: 96, bottom: 60 },
    yAxis: {
      type: 'value',
      name: params.yName,
      min: yMin,
      max: yMax,
      splitLine: { lineStyle: { color: 'rgba(16,55,92,0.08)' } },
      axisLabel: { color: '#10375c' },
    },
    series,
  }
}

// ── Legacy functions kept for compatibility ───────────────────────────────────

export function barMinMaxOption(params: {
  title: string
  categories: string[]
  mins: (number | null | undefined)[]
  maxs: (number | null | undefined)[]
  unit?: string
}): EChartsOption {
  const opt = baseChartOption()
  return {
    ...opt,
    title: { text: params.title, left: 12, top: 8, textStyle: { fontSize: 14, fontWeight: 600, color: '#10375c' } },
    legend: { top: 32 },
    xAxis: { type: 'category', data: params.categories, axisLabel: { color: '#10375c' } },
    yAxis: { type: 'value', name: params.unit, splitLine: { lineStyle: { color: 'rgba(16,55,92,0.08)' } }, axisLabel: { color: '#10375c' } },
    series: [
      { name: 'Min', type: 'bar', data: params.mins.map((v) => v ?? null), itemStyle: { color: '#5c8eb8' } },
      { name: 'Max', type: 'bar', data: params.maxs.map((v) => v ?? null), itemStyle: { color: '#f3c623' } },
    ],
  }
}

export function barSpectrum(params: {
  title: string
  orders: number[]
  magnitudes: number[]
}): EChartsOption {
  const opt = baseChartOption()
  return {
    ...opt,
    title: { text: params.title, left: 12, top: 8, textStyle: { fontSize: 14, fontWeight: 600, color: '#10375c' } },
    xAxis: { type: 'category', data: params.orders.map((o) => `H${o}`), axisLabel: { color: '#10375c' } },
    yAxis: { type: 'value', name: '%', splitLine: { lineStyle: { color: 'rgba(16,55,92,0.08)' } }, axisLabel: { color: '#10375c' } },
    series: [{ type: 'bar', data: params.magnitudes, itemStyle: { color: '#10375c' } }],
  }
}

export function dipSwellScatterOption(_params: {
  title: string
  nominalV: number
  events: { timestamp: string | null; event_type: 'dip' | 'swell'; phase: string; value_v: number; depth_pct: number; severity: string }[]
}): EChartsOption {
  return baseChartOption() as EChartsOption
}

export function dipSwellTimelineOption(_params: {
  title: string
  nominalV: number
  timestamps: string[]
  va: (number | null | undefined)[]
  vb: (number | null | undefined)[]
  vc: (number | null | undefined)[]
  dipLimit: number
  swellLimit: number
}): EChartsOption {
  return baseChartOption() as EChartsOption
}
