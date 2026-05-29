import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Activity, FileWarning, HeartPulse, ShieldCheck, Waves, Zap } from 'lucide-react'

import { loadSession } from '@/utils/sessionDb'
import { Loading3D } from '@/components/Loading3D'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ProcessResponse } from '@/types/pq'

interface HealthComponent {
  key: string
  label: string
  icon: React.ReactNode
  raw: number
  score: number                // 0–100
  weight: number               // contribution to overall
  status: 'good' | 'fair' | 'poor'
  detail: string
  recommendation: string
}

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)) }

function statusOf(score: number): HealthComponent['status'] {
  if (score >= 80) return 'good'
  if (score >= 55) return 'fair'
  return 'poor'
}

function computeHealth(data: ProcessResponse): HealthComponent[] {
  const a = data.analytics
  const nominal = data.nominal_voltage ?? 230
  const out: HealthComponent[] = []

  // ── 1. Harmonic Health — driven by V-THD ─────────────────────────────
  const vthd_avg = (
    Number(a.vthd?.phase_a?.avg ?? 0) +
    Number(a.vthd?.phase_b?.avg ?? 0) +
    Number(a.vthd?.phase_c?.avg ?? 0)
  ) / 3
  const harmScore = clamp(100 - vthd_avg * 12, 0, 100)   // 0% THD → 100, 8.33% → 0
  out.push({
    key: 'harmonic',
    label: 'Harmonic Health',
    icon: <Waves className="size-4 text-white" />,
    raw: vthd_avg,
    score: Math.round(harmScore),
    weight: 0.25,
    status: statusOf(harmScore),
    detail: `Average voltage THD ${vthd_avg.toFixed(2)} % across R/Y/B.`,
    recommendation: vthd_avg > 5
      ? 'Consider passive/active harmonic filtering near major VFD/rectifier loads.'
      : 'Within IEEE 519 limits.',
  })

  // ── 2. Voltage Stability — deviation from nominal + imbalance ────────
  const phases = [a.voltage?.phase_a, a.voltage?.phase_b, a.voltage?.phase_c]
    .map(p => Number(p?.avg ?? 0))
    .filter(v => v > 0)
  const avgV = phases.length ? phases.reduce((s, v) => s + v, 0) / phases.length : nominal
  const devPct = nominal > 0 ? Math.abs(avgV - nominal) / nominal * 100 : 0
  const vimb = Number((a.voltage as { imbalance_pct?: number | null })?.imbalance_pct ?? 0)
  const vStability = clamp(100 - devPct * 5 - vimb * 8, 0, 100)
  out.push({
    key: 'voltage',
    label: 'Voltage Stability',
    icon: <Activity className="size-4 text-white" />,
    raw: devPct,
    score: Math.round(vStability),
    weight: 0.20,
    status: statusOf(vStability),
    detail: `Mean ${avgV.toFixed(1)} V (nominal ${nominal} V, ${devPct.toFixed(1)} % off) · imbalance ${vimb.toFixed(2)} %.`,
    recommendation: devPct > 5
      ? 'Voltage drifts from nominal — check transformer tap settings or supply contract.'
      : 'Voltage stable within acceptable bounds.',
  })

  // ── 3. Power Factor — utility-facing metric ──────────────────────────
  const pf = Number(a.pf?.avg ?? 1)
  const pfScore = clamp((pf - 0.7) / (1 - 0.7) * 100, 0, 100)
  out.push({
    key: 'pf',
    label: 'Power Factor',
    icon: <Zap className="size-4 text-white" />,
    raw: pf,
    score: Math.round(pfScore),
    weight: 0.25,
    status: statusOf(pfScore),
    detail: `Average PF ${pf.toFixed(3)}.`,
    recommendation: pf < 0.95
      ? `Add APFC capacitor bank to lift PF to ≥ 0.95 and remove utility penalty.`
      : 'PF healthy — no penalty risk.',
  })

  // ── 4. Current Balance — three-phase symmetry ────────────────────────
  const iimb = Number((a.current as { imbalance_pct?: number | null })?.imbalance_pct ?? 0)
  const balScore = clamp(100 - iimb * 3, 0, 100)
  out.push({
    key: 'balance',
    label: 'Three-phase Balance',
    icon: <ShieldCheck className="size-4 text-white" />,
    raw: iimb,
    score: Math.round(balScore),
    weight: 0.15,
    status: statusOf(balScore),
    detail: `Current imbalance ${iimb.toFixed(2)} %.`,
    recommendation: iimb > 10
      ? 'Redistribute single-phase loads — high imbalance accelerates equipment failure.'
      : 'Three-phase loading is acceptable.',
  })

  // ── 5. Frequency Stability ────────────────────────────────────────────
  const f = Number(a.frequency?.avg ?? 50)
  const fdev = Math.abs(f - 50) / 50 * 100
  const fScore = clamp(100 - fdev * 20, 0, 100)
  out.push({
    key: 'frequency',
    label: 'Frequency Stability',
    icon: <HeartPulse className="size-4 text-white" />,
    raw: f,
    score: Math.round(fScore),
    weight: 0.15,
    status: statusOf(fScore),
    detail: `Average ${f.toFixed(3)} Hz (${fdev.toFixed(2)} % deviation).`,
    recommendation: fdev > 1
      ? 'Frequency drift unusual — investigate generator / grid stability.'
      : 'Frequency within acceptable grid tolerance.',
  })

  return out
}

const COMPONENT_COLORS: Record<HealthComponent['status'], { ring: string; bg: string; chip: string; text: string; bar: string }> = {
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
  const overallScore = useMemo(() => {
    if (!components.length) return 0
    return Math.round(components.reduce((s, c) => s + c.score * c.weight, 0))
  }, [components])

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
                    {c.icon}
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
