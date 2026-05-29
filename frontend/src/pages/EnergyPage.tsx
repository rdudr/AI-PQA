import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Battery, FileWarning, Sun, TrendingUp, Zap } from 'lucide-react'
import type { EChartsOption } from 'echarts'

import { loadSession } from '@/utils/sessionDb'
import { Loading3D } from '@/components/Loading3D'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartCard } from '@/graphs/ChartCard'
import type { ProcessResponse } from '@/types/pq'

function parseTs(s: string | null | undefined): Date | null {
  if (!s) return null
  const iso = s.toString().trim().replace(' ', 'T')
  const d = new Date(iso)
  if (!Number.isNaN(d.getTime())) return d
  const euro = String(s).match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/)
  if (!euro) return null
  const [, dd, mm, yy, hh, mi, ss] = euro
  const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy)
  const d2 = new Date(year, Number(mm) - 1, Number(dd), Number(hh ?? 0), Number(mi ?? 0), Number(ss ?? 0))
  return Number.isNaN(d2.getTime()) ? null : d2
}

export function EnergyPage() {
  const [data, setData] = useState<ProcessResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSession()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  // ── Build energy time-series from rows ─────────────────────────────────
  const energyAnalysis = useMemo(() => {
    if (!data) return null
    const rows = data.rows ?? []
    interface Sample { t: Date; kw: number }
    const samples: Sample[] = []
    for (const r of rows) {
      const t = parseTs((r.timestamp ?? `${r.date ?? ''} ${r.time ?? ''}`) as string)
      if (!t) continue
      const kw = Number(r.kw)
      if (!Number.isFinite(kw)) continue
      samples.push({ t, kw })
    }
    if (samples.length === 0) return null
    samples.sort((a, b) => a.t.getTime() - b.t.getTime())

    // Sampling interval (assume uniform across samples)
    const totalMs = samples[samples.length - 1].t.getTime() - samples[0].t.getTime()
    const intervalSec = samples.length > 1 ? totalMs / 1000 / (samples.length - 1) : 60
    const intervalH = intervalSec / 3600

    // Total energy = sum(kw) * intervalH
    let totalKwh = 0
    let peakKw = 0
    let peakAt: Date | null = null
    const hourlyKwh: number[] = Array(24).fill(0)
    const hourlyCounts: number[] = Array(24).fill(0)
    const perDay: Record<string, number> = {}    // 'YYYY-MM-DD' → kWh
    const loadCurve: number[] = []

    for (const s of samples) {
      totalKwh += s.kw * intervalH
      if (s.kw > peakKw) {
        peakKw = s.kw
        peakAt = s.t
      }
      hourlyKwh[s.t.getHours()] += s.kw * intervalH
      hourlyCounts[s.t.getHours()] += 1
      const dayKey = s.t.toISOString().slice(0, 10)
      perDay[dayKey] = (perDay[dayKey] ?? 0) + s.kw * intervalH
      loadCurve.push(s.kw)
    }
    const avgKw = totalKwh / Math.max(1, samples.length * intervalH)

    // Load duration curve = kW values sorted desc
    const ldcSorted = [...loadCurve].sort((a, b) => b - a)

    // Pareto principle: how many hours does it take to cover 50% of energy?
    const sumSorted = ldcSorted.reduce((acc, v) => acc + v, 0)
    let cumulative = 0
    let hoursToHalfEnergy = 0
    for (let i = 0; i < ldcSorted.length; i++) {
      cumulative += ldcSorted[i]
      if (cumulative >= sumSorted * 0.5) {
        hoursToHalfEnergy = (i + 1) * intervalH
        break
      }
    }

    const dayKeys = Object.keys(perDay).sort()
    const perDayValues = dayKeys.map(k => perDay[k])

    return {
      totalKwh,
      peakKw,
      peakAt,
      avgKw,
      intervalH,
      sampleCount: samples.length,
      hourlyKwh,
      hourlyCounts,
      hoursToHalfEnergy,
      dayKeys,
      perDayValues,
      ldcSorted,
    }
  }, [data])

  // ── Charts ──────────────────────────────────────────────────────────────
  const hourlyChart: EChartsOption | null = useMemo(() => {
    if (!energyAnalysis) return null
    return {
      title: { text: 'Energy by hour-of-day (avg)', left: 12, top: 8, textStyle: { fontSize: 14, fontWeight: 600, color: '#10375c' } },
      grid: { top: 60, left: 50, right: 24, bottom: 50 },
      xAxis: {
        type: 'category',
        data: Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}h`),
        name: 'Hour',
        nameLocation: 'middle',
        nameGap: 30,
        axisLabel: { color: '#10375c', fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        name: 'kWh',
        axisLabel: { color: '#10375c' },
        splitLine: { lineStyle: { color: 'rgba(16,55,92,0.08)' } },
      },
      tooltip: { trigger: 'axis' },
      series: [{
        type: 'bar',
        name: 'kWh',
        data: energyAnalysis.hourlyKwh.map(v => Number(v.toFixed(2))),
        itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 22,
      }],
    }
  }, [energyAnalysis])

  const dailyChart: EChartsOption | null = useMemo(() => {
    if (!energyAnalysis) return null
    return {
      title: { text: 'Daily energy consumption', left: 12, top: 8, textStyle: { fontSize: 14, fontWeight: 600, color: '#10375c' } },
      grid: { top: 60, left: 50, right: 24, bottom: 60 },
      xAxis: {
        type: 'category',
        data: energyAnalysis.dayKeys,
        name: 'Date',
        nameLocation: 'middle',
        nameGap: 35,
        axisLabel: { color: '#10375c', fontSize: 10, rotate: 30 },
      },
      yAxis: {
        type: 'value', name: 'kWh', axisLabel: { color: '#10375c' },
        splitLine: { lineStyle: { color: 'rgba(16,55,92,0.08)' } },
      },
      tooltip: { trigger: 'axis' },
      series: [{
        type: 'line',
        name: 'kWh',
        data: energyAnalysis.perDayValues.map(v => Number(v.toFixed(2))),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: { color: '#8b5cf6' },
        lineStyle: { color: '#8b5cf6', width: 2 },
        areaStyle: { color: 'rgba(139,92,246,0.18)' },
      }],
    }
  }, [energyAnalysis])

  const ldcChart: EChartsOption | null = useMemo(() => {
    if (!energyAnalysis) return null
    const n = energyAnalysis.ldcSorted.length
    return {
      title: { text: 'Load Duration Curve', left: 12, top: 8, textStyle: { fontSize: 14, fontWeight: 600, color: '#10375c' } },
      grid: { top: 60, left: 50, right: 24, bottom: 50 },
      xAxis: {
        type: 'value',
        min: 0, max: 100,
        name: '% of time',
        nameLocation: 'middle',
        nameGap: 30,
        axisLabel: { color: '#10375c', formatter: '{value}%' },
      },
      yAxis: {
        type: 'value', name: 'kW', axisLabel: { color: '#10375c' },
        splitLine: { lineStyle: { color: 'rgba(16,55,92,0.08)' } },
      },
      tooltip: { trigger: 'axis' },
      series: [{
        type: 'line',
        name: 'kW',
        data: energyAnalysis.ldcSorted.map((v, i) => [(i / Math.max(1, n - 1)) * 100, Number(v.toFixed(2))]),
        smooth: true,
        showSymbol: false,
        lineStyle: { color: '#f59e0b', width: 2 },
        areaStyle: { color: 'rgba(245,158,11,0.18)' },
      }],
    }
  }, [energyAnalysis])

  if (loading) return <Loading3D fullScreen message="Building energy profile…" />
  if (!data) {
    return (
      <Card className="mx-auto max-w-xl border border-dashed border-[#eb8317]/45 bg-white/70">
        <CardHeader>
          <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-[#eb8317]/12 text-[#eb8317]">
            <FileWarning />
          </div>
          <CardTitle>No active session</CardTitle>
          <CardDescription>Open an audit first to view its energy profile.</CardDescription>
        </CardHeader>
        <CardContent><Button asChild><Link to="/history">Audit history</Link></Button></CardContent>
      </Card>
    )
  }
  if (!energyAnalysis) {
    return (
      <Card className="mx-auto max-w-xl border border-dashed border-[#eb8317]/45 bg-white/70">
        <CardHeader>
          <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-[#eb8317]/12 text-[#eb8317]">
            <FileWarning />
          </div>
          <CardTitle>Insufficient data</CardTitle>
          <CardDescription>
            This session doesn't include kW or timestamp columns — energy analysis needs both.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const peakHour = energyAnalysis.hourlyKwh.indexOf(Math.max(...energyAnalysis.hourlyKwh))

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs uppercase tracking-[0.28em] text-[#10375c]/55">Energy analytics</p>
        <h1 className="mt-1 flex items-center gap-3 text-3xl font-semibold text-[#10375c]">
          <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-purple-400 to-purple-600 text-white shadow-md shadow-purple-500/30">
            <Battery className="size-5" strokeWidth={2.5} />
          </span>
          Energy Profile
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#10375c]/70">
          {data.metadata.plant_name} · daily / hourly consumption patterns +
          load duration curve from the recorded kW samples.
        </p>
      </motion.div>

      {/* KPI tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Total energy', value: `${energyAnalysis.totalKwh.toFixed(1)} kWh`,
            sub: `${energyAnalysis.sampleCount.toLocaleString()} samples`,
            chip: 'from-emerald-400 to-emerald-600', icon: <Zap className="size-4 text-white" />,
            ring: 'ring-emerald-200/60', bg: 'from-emerald-50 to-white',
          },
          {
            label: 'Peak demand', value: `${energyAnalysis.peakKw.toFixed(2)} kW`,
            sub: energyAnalysis.peakAt ? energyAnalysis.peakAt.toLocaleString() : '—',
            chip: 'from-rose-400 to-red-500', icon: <TrendingUp className="size-4 text-white" />,
            ring: 'ring-red-200/60', bg: 'from-rose-50 to-white',
          },
          {
            label: 'Average demand', value: `${energyAnalysis.avgKw.toFixed(2)} kW`,
            sub: 'across recording',
            chip: 'from-sky-400 to-blue-600', icon: <Battery className="size-4 text-white" />,
            ring: 'ring-blue-200/60', bg: 'from-blue-50 to-white',
          },
          {
            label: 'Peak hour', value: `${peakHour.toString().padStart(2, '0')}:00`,
            sub: `${energyAnalysis.hourlyKwh[peakHour].toFixed(1)} kWh in this hour`,
            chip: 'from-amber-400 to-orange-500', icon: <Sun className="size-4 text-white" />,
            ring: 'ring-amber-200/60', bg: 'from-amber-50 to-white',
          },
        ].map(c => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            className={`relative overflow-hidden rounded-2xl ring-1 bg-gradient-to-b p-4 shadow-sm transition-shadow hover:shadow-lg ${c.ring} ${c.bg}`}
          >
            <div className="flex items-center gap-2">
              <span className={`inline-flex size-7 items-center justify-center rounded-lg bg-gradient-to-br shadow-md ${c.chip}`}>
                {c.icon}
              </span>
              <p className="text-xs font-bold uppercase tracking-wider text-[#10375c]/70">{c.label}</p>
            </div>
            <p className="mt-3 text-2xl font-extrabold leading-tight text-[#10375c]">{c.value}</p>
            <p className="mt-1 text-[11px] text-[#10375c]/60">{c.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 xl:grid-cols-2">
        {hourlyChart && <ChartCard option={hourlyChart} height={320} />}
        {dailyChart && <ChartCard option={dailyChart} height={320} />}
        {ldcChart && <ChartCard option={ldcChart} height={320} className="xl:col-span-2" />}
      </div>

      {/* Insight */}
      {energyAnalysis.hoursToHalfEnergy > 0 && (
        <Card className="border border-white/70">
          <CardHeader>
            <CardTitle className="text-base">Load Concentration</CardTitle>
            <CardDescription>How peaked your demand profile is.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-[#10375c]/85">
            ⚡ Half of total energy is delivered in the top{' '}
            <span className="font-bold">{energyAnalysis.hoursToHalfEnergy.toFixed(1)} hours</span>{' '}
            of the recording. The flatter this is (≈ half the total time), the better
            your facility is for time-of-use tariffs and demand-charge optimization.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
