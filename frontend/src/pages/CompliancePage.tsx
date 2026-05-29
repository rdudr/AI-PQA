import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ShieldCheck, CheckCircle2, XCircle, AlertCircle,
  FileWarning, Award, Activity, Waves, Gauge,
} from 'lucide-react'

import { loadSession } from '@/utils/sessionDb'
import { Loading3D } from '@/components/Loading3D'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ProcessResponse } from '@/types/pq'

type Verdict = 'pass' | 'fail' | 'warn'

interface ComplianceRule {
  id: string
  standard: string
  clause: string
  description: string
  measured: number
  limit: number
  unit: string
  verdict: Verdict
  remark: string
}

function evaluateCompliance(data: ProcessResponse): ComplianceRule[] {
  const rules: ComplianceRule[] = []
  const a = data.analytics
  const nominal = data.nominal_voltage ?? 230

  // ── IEEE 519 — Voltage THD limit (5% on LV systems ≤ 1 kV) ─────────────
  for (const [phase, label] of [['phase_a', 'Phase A'], ['phase_b', 'Phase B'], ['phase_c', 'Phase C']] as const) {
    const measured = a.vthd?.[phase]?.avg
    if (measured == null) continue
    rules.push({
      id: `ieee519-vthd-${phase}`,
      standard: 'IEEE 519',
      clause: `Voltage THD · ${label}`,
      description: 'Voltage Total Harmonic Distortion shall not exceed 5% on systems ≤ 1 kV.',
      measured,
      limit: 5,
      unit: '%',
      verdict: measured <= 5 ? 'pass' : measured <= 6.5 ? 'warn' : 'fail',
      remark: measured <= 5
        ? 'Within IEEE 519 limit.'
        : measured <= 6.5
          ? 'Marginally above 5% — investigate harmonic sources.'
          : 'Exceeds limit by >30% — harmonic filter recommended.',
    })
  }

  // ── IEEE 519 — Current TDD bracketed by a generic 15% reference for LV
  //    industrial loads.  (True IEEE 519 limit depends on Isc/IL ratio
  //    which we don't have; 15% is a sensible default for typical Isc/IL=20–50.)
  for (const [phase, label] of [['phase_a', 'Phase A'], ['phase_b', 'Phase B'], ['phase_c', 'Phase C']] as const) {
    const measured = a.ithd?.[phase]?.avg
    if (measured == null) continue
    rules.push({
      id: `ieee519-ithd-${phase}`,
      standard: 'IEEE 519',
      clause: `Current THD · ${label}`,
      description: 'Current TDD reference limit (Isc/IL = 20–50, typical LV industrial).',
      measured,
      limit: 15,
      unit: '%',
      verdict: measured <= 15 ? 'pass' : measured <= 20 ? 'warn' : 'fail',
      remark: measured <= 15
        ? 'Within reference limit.'
        : measured <= 20
          ? 'Above 15% — check non-linear loads (VFDs, rectifiers).'
          : 'Severe distortion — equipment derating likely.',
    })
  }

  // ── EN 50160 — Supply voltage ±10% of nominal ────────────────────────
  for (const [phase, label] of [['phase_a', 'Phase A'], ['phase_b', 'Phase B'], ['phase_c', 'Phase C']] as const) {
    const block = a.voltage?.[phase] as { avg?: number; min?: number; max?: number } | undefined
    if (!block?.avg) continue
    const lo = nominal * 0.90
    const hi = nominal * 1.10
    const inRange = (block.min ?? block.avg) >= lo && (block.max ?? block.avg) <= hi
    const moderately = block.avg >= nominal * 0.92 && block.avg <= nominal * 1.08
    rules.push({
      id: `en50160-v-${phase}`,
      standard: 'EN 50160',
      clause: `Supply voltage · ${label}`,
      description: `LV nominal ± 10% (${lo.toFixed(0)} – ${hi.toFixed(0)} V) for 95% of 10-min averages.`,
      measured: block.avg,
      limit: nominal,
      unit: 'V',
      verdict: inRange ? 'pass' : moderately ? 'warn' : 'fail',
      remark: inRange
        ? 'All samples stay within ±10% envelope.'
        : moderately
          ? 'Average is fine but min/max exceeded the envelope.'
          : 'Voltage frequently outside ±10% — distribution-level concern.',
    })
  }

  // ── Frequency (50 Hz ± 1%) ─────────────────────────────────────────────
  if (a.frequency?.avg != null) {
    const f = a.frequency.avg
    const dev = Math.abs(f - 50) / 50 * 100
    rules.push({
      id: 'freq',
      standard: 'EN 50160',
      clause: 'Frequency',
      description: 'Grid frequency must remain within 50 Hz ±1 % during 99.5% of the year.',
      measured: f,
      limit: 50,
      unit: 'Hz',
      verdict: dev <= 1 ? 'pass' : dev <= 2 ? 'warn' : 'fail',
      remark: dev <= 1 ? `Deviation ${dev.toFixed(2)}%.` : `Deviation ${dev.toFixed(2)}% — abnormal.`,
    })
  }

  // ── Power Factor ≥ 0.95 (utility-pleasing target) ─────────────────────
  if (a.pf?.avg != null) {
    const pf = a.pf.avg
    rules.push({
      id: 'pf',
      standard: 'Utility (typical)',
      clause: 'Power Factor',
      description: 'Most utilities apply a PF penalty below 0.95 lagging.',
      measured: pf,
      limit: 0.95,
      unit: '',
      verdict: pf >= 0.95 ? 'pass' : pf >= 0.85 ? 'warn' : 'fail',
      remark: pf >= 0.95
        ? 'No penalty exposure.'
        : pf >= 0.85
          ? 'PF correction (capacitor bank) would reduce billing.'
          : 'Significant penalty exposure — reactive compensation needed.',
    })
  }

  // ── Voltage Imbalance (IEC 61000-3-14) ≤ 2% ──────────────────────────
  const vimb = (a.voltage as { imbalance_pct?: number | null })?.imbalance_pct
  if (typeof vimb === 'number') {
    rules.push({
      id: 'v-imb',
      standard: 'IEC 61000-3-14',
      clause: 'Voltage Imbalance',
      description: 'Voltage imbalance limited to 2% for three-phase distribution systems.',
      measured: vimb,
      limit: 2,
      unit: '%',
      verdict: vimb <= 2 ? 'pass' : vimb <= 3 ? 'warn' : 'fail',
      remark: vimb <= 2
        ? 'Three-phase symmetry is good.'
        : 'Imbalance high — check single-phase loading.',
    })
  }

  return rules
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const map = {
    pass: { Icon: CheckCircle2, c: 'bg-emerald-50 text-emerald-700 border-emerald-200', t: 'Pass' },
    warn: { Icon: AlertCircle,  c: 'bg-amber-50 text-amber-700 border-amber-200',       t: 'Marginal' },
    fail: { Icon: XCircle,      c: 'bg-red-50 text-red-700 border-red-200',             t: 'Fail' },
  } as const
  const { Icon, c, t } = map[verdict]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${c}`}>
      <Icon className="size-3" />
      {t}
    </span>
  )
}

const STANDARD_ICONS: Record<string, JSX.Element> = {
  'IEEE 519':       <Waves className="size-4 text-blue-700" strokeWidth={2.5} />,
  'EN 50160':       <Activity className="size-4 text-indigo-700" strokeWidth={2.5} />,
  'IEC 61000-3-14': <Gauge className="size-4 text-purple-700" strokeWidth={2.5} />,
  'Utility (typical)': <Award className="size-4 text-emerald-700" strokeWidth={2.5} />,
}

export function CompliancePage() {
  const [data, setData] = useState<ProcessResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSession()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const rules = useMemo(() => (data ? evaluateCompliance(data) : []), [data])
  const summary = useMemo(() => {
    const total = rules.length
    const pass = rules.filter(r => r.verdict === 'pass').length
    const warn = rules.filter(r => r.verdict === 'warn').length
    const fail = rules.filter(r => r.verdict === 'fail').length
    const score = total ? Math.round((pass + warn * 0.5) / total * 100) : 0
    return { total, pass, warn, fail, score }
  }, [rules])

  // Group rules by standard for cleaner display
  const grouped = useMemo(() => {
    const out: Record<string, ComplianceRule[]> = {}
    for (const r of rules) {
      (out[r.standard] ??= []).push(r)
    }
    return out
  }, [rules])

  if (loading) return <Loading3D fullScreen message="Loading compliance check…" />

  if (!data) {
    return (
      <Card className="mx-auto max-w-xl border border-dashed border-[#eb8317]/45 bg-white/70">
        <CardHeader>
          <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-[#eb8317]/12 text-[#eb8317]">
            <FileWarning />
          </div>
          <CardTitle>No active session</CardTitle>
          <CardDescription>
            Load an audit from the dashboard or history first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild><Link to="/history">Open audit history</Link></Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs uppercase tracking-[0.28em] text-[#10375c]/55">Standards & regulatory</p>
        <h1 className="mt-1 flex items-center gap-3 text-3xl font-semibold text-[#10375c]">
          <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md shadow-emerald-500/30">
            <ShieldCheck className="size-5" strokeWidth={2.5} />
          </span>
          Compliance Check
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#10375c]/70">
          {data.metadata.plant_name} · {data.metadata.company_name} · evaluated against{' '}
          IEEE 519, EN 50160, IEC 61000-3-14, and utility PF norms.
        </p>
      </motion.div>

      {/* Headline score */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-2xl border border-white/70 bg-gradient-to-br from-white/90 via-[#eef4ff]/80 to-[#dde9fb]/80 p-5 backdrop-blur-[18px]"
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#10375c]/55">Overall</p>
            <p className="mt-1 text-3xl font-extrabold text-[#10375c]">{summary.score}%</p>
            <p className="text-xs text-[#10375c]/55">{summary.total} checks</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Pass</p>
            <p className="mt-1 text-3xl font-extrabold text-emerald-600">{summary.pass}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Marginal</p>
            <p className="mt-1 text-3xl font-extrabold text-amber-600">{summary.warn}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">Fail</p>
            <p className="mt-1 text-3xl font-extrabold text-red-600">{summary.fail}</p>
          </div>
        </div>
      </motion.div>

      {/* Per-standard sections */}
      {Object.entries(grouped).map(([standard, items]) => (
        <Card key={standard} className="border border-white/70">
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            {STANDARD_ICONS[standard] ?? <ShieldCheck className="size-4" />}
            <CardTitle className="text-base">{standard}</CardTitle>
            <CardDescription className="ml-auto text-xs">
              {items.filter(i => i.verdict === 'pass').length} / {items.length} pass
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#10375c]/08 text-[10px] uppercase tracking-wider text-[#10375c]/50">
                    <th className="pb-2 text-left font-medium">Clause</th>
                    <th className="pb-2 text-right font-medium">Measured</th>
                    <th className="pb-2 text-right font-medium">Limit</th>
                    <th className="pb-2 text-center font-medium">Verdict</th>
                    <th className="pb-2 text-left font-medium">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(rule => (
                    <tr key={rule.id} className="border-b border-[#10375c]/05 last:border-0">
                      <td className="py-2 pr-3">
                        <p className="font-medium text-[#10375c]">{rule.clause}</p>
                        <p className="text-[10px] text-[#10375c]/55">{rule.description}</p>
                      </td>
                      <td className="py-2 pr-3 text-right font-mono font-semibold text-[#10375c]">
                        {rule.measured.toFixed(rule.unit === '' ? 3 : 2)}{rule.unit}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-[#10375c]/65">
                        {rule.limit.toFixed(rule.unit === '' ? 2 : 0)}{rule.unit}
                      </td>
                      <td className="py-2 pr-3 text-center">
                        <VerdictBadge verdict={rule.verdict} />
                      </td>
                      <td className="py-2 text-xs text-[#10375c]/70">{rule.remark}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
