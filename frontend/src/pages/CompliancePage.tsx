import React, { useEffect, useMemo, useState } from 'react'
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
import {
  complianceSummary,
  evaluateCompliance,
  groupByStandard,
  type Verdict,
} from '@/utils/compliance'
import type { ProcessResponse } from '@/types/pq'

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

const STANDARD_ICONS: Record<string, React.ReactNode> = {
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
  const summary = useMemo(() => complianceSummary(rules), [rules])
  // Group rules by standard for cleaner display
  const grouped = useMemo(() => groupByStandard(rules), [rules])

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
