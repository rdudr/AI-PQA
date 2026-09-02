import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Activity, FileWarning, HeartPulse, ShieldCheck, Waves, Zap } from 'lucide-react'

import { loadSession } from '@/utils/sessionDb'
import { Loading3D } from '@/components/Loading3D'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  computeHealth,
  overallHealthScore,
  statusOf,
  type HealthStatus,
} from '@/utils/equipmentHealth'
import type { ProcessResponse } from '@/types/pq'

// Icons live with the view, not the scoring logic, so the PDF exporter can
// reuse computeHealth() without pulling in JSX.
const COMPONENT_ICONS: Record<string, React.ReactNode> = {
  harmonic:  <Waves className="size-4 text-white" />,
  voltage:   <Activity className="size-4 text-white" />,
  pf:        <Zap className="size-4 text-white" />,
  balance:   <ShieldCheck className="size-4 text-white" />,
  frequency: <HeartPulse className="size-4 text-white" />,
}

const COMPONENT_COLORS: Record<HealthStatus, { ring: string; bg: string; chip: string; text: string; bar: string }> = {
  good: { ring: 'ring-emerald-200/60', bg: 'from-emerald-50 to-white', chip: 'from-emerald-400 to-emerald-600', text: 'text-emerald-700', bar: 'bg-emerald-500' },
  fair: { ring: 'ring-amber-200/60',   bg: 'from-amber-50 to-white',   chip: 'from-amber-400 to-orange-500',   text: 'text-amber-700',   bar: 'bg-amber-500' },
  poor: { ring: 'ring-red-200/60',     bg: 'from-rose-50 to-white',    chip: 'from-rose-400 to-red-500',       text: 'text-red-700',     bar: 'bg-red-500' },
}

export function EquipmentHealthPage() {
  const [data, setData] = useState<ProcessResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSession()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const components = useMemo(() => (data ? computeHealth(data) : []), [data])
  const overallScore = useMemo(() => overallHealthScore(components), [components])

  if (loading) return <Loading3D fullScreen message="Computing equipment health…" />
  if (!data) {
    return (
      <Card className="mx-auto max-w-xl border border-dashed border-[#eb8317]/45 bg-white/70">
        <CardHeader>
          <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-[#eb8317]/12 text-[#eb8317]">
            <FileWarning />
          </div>
          <CardTitle>No active session</CardTitle>
          <CardDescription>Open an audit first to view equipment health.</CardDescription>
        </CardHeader>
        <CardContent><Button asChild><Link to="/history">Audit history</Link></Button></CardContent>
      </Card>
    )
  }

  const overallStatus = statusOf(overallScore)
  const oc = COMPONENT_COLORS[overallStatus]

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs uppercase tracking-[0.28em] text-[#10375c]/55">Asset diagnostics</p>
        <h1 className="mt-1 flex items-center gap-3 text-3xl font-semibold text-[#10375c]">
          <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 text-white shadow-md shadow-rose-500/30">
            <HeartPulse className="size-5" strokeWidth={2.5} />
          </span>
          Equipment Health Score
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#10375c]/70">
          {data.metadata.plant_name} · weighted composite score from harmonics, voltage,
          PF, balance, and frequency.
        </p>
      </motion.div>

      {/* Overall score band */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`glass-panel relative overflow-hidden rounded-2xl ring-1 bg-gradient-to-b p-6 ${oc.ring} ${oc.bg}`}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={`text-xs font-bold uppercase tracking-wider ${oc.text}`}>Overall Health</p>
            <p className="mt-1 text-6xl font-extrabold leading-none text-[#10375c]">
              {overallScore}
              <span className="ml-2 text-2xl text-[#10375c]/55">/ 100</span>
            </p>
            <p className={`mt-2 text-sm font-semibold ${oc.text}`}>
              {overallStatus === 'good' ? '✓ Healthy equipment behaviour' :
               overallStatus === 'fair' ? '◐ Some indicators marginal — review' :
                                          '⚠ Multiple issues detected — action required'}
            </p>
          </div>
          <div className="w-full max-w-md">
            <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-wider text-[#10375c]/55">
              <span>0</span><span>Threshold 60</span><span>80</span><span>100</span>
            </div>
            <div className="relative h-3 overflow-hidden rounded-full bg-[#10375c]/10">
              {/* Threshold markers */}
              <div className="absolute inset-y-0 left-[60%] w-px bg-amber-500/40" />
              <div className="absolute inset-y-0 left-[80%] w-px bg-emerald-500/40" />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${overallScore}%` }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
                className={`h-full rounded-full ${oc.bar}`}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Per-component cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {components.map((c, idx) => {
          const col = COMPONENT_COLORS[c.status]
          return (
            <motion.div
              key={c.key}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ y: -3 }}
              className={`relative overflow-hidden rounded-2xl ring-1 bg-gradient-to-b p-4 shadow-sm transition-shadow hover:shadow-lg ${col.ring} ${col.bg}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex size-7 items-center justify-center rounded-lg bg-gradient-to-br shadow-md ${col.chip}`}>
                    {COMPONENT_ICONS[c.key]}
                  </span>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#10375c]/75">{c.label}</p>
                </div>
                <span className={`rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${col.text}`}>
                  weight {Math.round(c.weight * 100)}%
                </span>
              </div>

              <p className={`mt-3 text-3xl font-extrabold leading-tight text-[#10375c]`}>
                {c.score}<span className="ml-1 text-sm text-[#10375c]/55">/ 100</span>
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/65">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${c.score}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full ${col.bar}`}
                />
              </div>

              <p className="mt-3 text-xs text-[#10375c]/75">{c.detail}</p>
              <p className={`mt-1 text-[11px] italic ${col.text}`}>{c.recommendation}</p>
            </motion.div>
          )
        })}
      </div>

      {/* Methodology */}
      <Card className="border border-white/70">
        <CardHeader>
          <CardTitle className="text-base">How this score is calculated</CardTitle>
          <CardDescription>
            Each component is mapped from its raw value to 0–100 using a deterministic
            curve, then weighted into the overall score.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-[#10375c]/55">
                <tr className="border-b border-[#10375c]/08">
                  <th className="pb-2 text-left font-medium">Component</th>
                  <th className="pb-2 text-right font-medium">Weight</th>
                  <th className="pb-2 text-right font-medium">Raw</th>
                  <th className="pb-2 text-right font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {components.map(c => (
                  <tr key={c.key} className="border-b border-[#10375c]/05 last:border-0">
                    <td className="py-2 text-[#10375c]">{c.label}</td>
                    <td className="py-2 text-right font-mono">{(c.weight * 100).toFixed(0)}%</td>
                    <td className="py-2 text-right font-mono text-[#10375c]/75">{c.raw.toFixed(3)}</td>
                    <td className={`py-2 text-right font-mono font-bold ${COMPONENT_COLORS[c.status].text}`}>{c.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
