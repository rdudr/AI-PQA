import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Coins, FileWarning, Lightbulb, TrendingDown, TrendingUp, Zap } from 'lucide-react'

import { loadSession } from '@/utils/sessionDb'
import { Loading3D } from '@/components/Loading3D'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ProcessResponse } from '@/types/pq'
import { COST_DEFAULTS, computeCost, fmtMoney as fmt, loadCostInputs, saveCostInputs, type CostInputs } from '@/utils/costOfPoorQuality'

export function CostPage() {
  const [data, setData] = useState<ProcessResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [inputs, setInputs] = useState<CostInputs>(COST_DEFAULTS)

  useEffect(() => {
    loadSession()
      .then((d) => { setData(d); if (d) setInputs(loadCostInputs(d.session_id)) })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  // What is typed here is what "Send to PostMan" carries into the report.
  useEffect(() => { if (data) saveCostInputs(data.session_id, inputs) }, [data, inputs])

  const calc = useMemo(() => (data ? computeCost(data, inputs) : null), [data, inputs])

  if (loading) return <Loading3D fullScreen message="Loading cost analysis…" />
  if (!data) {
    return (
      <Card className="mx-auto max-w-xl border border-dashed border-[#eb8317]/45 bg-white/70">
        <CardHeader>
          <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-[#eb8317]/12 text-[#eb8317]">
            <FileWarning />
          </div>
          <CardTitle>No active session</CardTitle>
          <CardDescription>Open an audit first to estimate cost of poor quality.</CardDescription>
        </CardHeader>
        <CardContent><Button asChild><Link to="/history">Audit history</Link></Button></CardContent>
      </Card>
    )
  }

  const c = calc!

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs uppercase tracking-[0.28em] text-[#10375c]/55">Financial impact</p>
        <h1 className="mt-1 flex items-center gap-3 text-3xl font-semibold text-[#10375c]">
          <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-orange-500/30">
            <Coins className="size-5" strokeWidth={2.5} />
          </span>
          Cost of Poor Quality
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#10375c]/70">
          Translates the PQ measurements into annual ₹ — tariff penalty, harmonic
          losses, and savings opportunity from PF correction.
        </p>
      </motion.div>

      {/* Inputs panel */}
      <Card className="border border-white/70">
        <CardHeader>
          <CardTitle className="text-base">Tariff &amp; operating assumptions</CardTitle>
          <CardDescription>Defaults reflect typical Indian LV industrial tariffs — edit to match your contract.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { key: 'tariff', label: 'Energy (₹/kWh)', step: 0.1 },
              { key: 'demandCharge', label: 'Demand (₹/kVA/mo)', step: 10 },
              { key: 'pfThreshold', label: 'PF threshold', step: 0.01 },
              { key: 'pfPenaltyPct', label: 'PF penalty (%/0.01)', step: 0.1 },
              { key: 'hoursPerDay', label: 'Hours per day', step: 1 },
              { key: 'daysPerYear', label: 'Days per year', step: 1 },
            ].map(field => (
              <label key={field.key} className="flex flex-col gap-1 rounded-xl border border-[#10375c]/10 bg-white/85 p-2.5 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#10375c]/60">{field.label}</span>
                <input
                  type="number"
                  step={field.step}
                  value={(inputs as unknown as Record<string, number>)[field.key]}
                  onChange={(e) => setInputs(prev => ({ ...prev, [field.key]: Number(e.target.value) }))}
                  className="bg-transparent font-mono text-base font-semibold text-[#10375c] outline-none"
                />
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Headline impact cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Annual Energy',
            value: fmt(inputs.currency, c.energyCost),
            sub: `${c.annualKwh.toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh`,
            tint: 'from-blue-50 to-white border-blue-200/60',
            chip: 'from-sky-400 to-blue-600',
            icon: <Zap className="size-4 text-white" />,
          },
          {
            label: 'PF Penalty Risk',
            value: fmt(inputs.currency, c.pfPenalty),
            sub: c.pfDeficit > 0 ? `PF ${c.avgPf.toFixed(3)} below ${inputs.pfThreshold}` : 'PF compliant — no penalty',
            tint: 'from-rose-50 to-white border-rose-200/60',
            chip: 'from-rose-400 to-red-500',
            icon: <TrendingDown className="size-4 text-white" />,
          },
          {
            label: 'Harmonic Loss',
            value: fmt(inputs.currency, c.harmonicLoss),
            sub: `${c.harmonicLossPct.toFixed(2)}% bill drag · V-THD ${c.vthd.toFixed(2)}%`,
            tint: 'from-amber-50 to-white border-amber-200/60',
            chip: 'from-amber-400 to-orange-500',
            icon: <TrendingDown className="size-4 text-white" />,
          },
          {
            label: 'PF Correction Savings',
            value: fmt(inputs.currency, c.kvaSavings),
            sub: `If PF → ${c.targetPf.toFixed(2)}: kVA ${c.avgKva.toFixed(0)} → ${c.newKva.toFixed(0)}`,
            tint: 'from-emerald-50 to-white border-emerald-200/60',
            chip: 'from-emerald-400 to-emerald-600',
            icon: <TrendingUp className="size-4 text-white" />,
          },
        ].map(card => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-b p-4 shadow-sm ring-1 ring-white/40 transition-shadow hover:shadow-lg ${card.tint}`}
          >
            <div className="flex items-center gap-2">
              <span className={`inline-flex size-7 items-center justify-center rounded-lg bg-gradient-to-br shadow-md ${card.chip}`}>
                {card.icon}
              </span>
              <p className="text-xs font-bold uppercase tracking-wider text-[#10375c]/70">{card.label}</p>
            </div>
            <p className="mt-3 text-2xl font-extrabold leading-tight text-[#10375c]">{card.value}</p>
            <p className="mt-1 text-[11px] text-[#10375c]/60">{card.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Totals + recommendations */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="border-2 border-red-200/60 bg-gradient-to-br from-rose-50/60 to-white">
          <CardHeader>
            <CardTitle className="text-base text-red-700">Current annual leak</CardTitle>
            <CardDescription>Money lost today, every year, if nothing changes.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-extrabold text-red-700">{fmt(inputs.currency, c.totalLeak)}</p>
            <p className="mt-1 text-xs text-red-700/70">
              PF penalty {fmt(inputs.currency, c.pfPenalty)} + harmonic losses {fmt(inputs.currency, c.harmonicLoss)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-emerald-200/60 bg-gradient-to-br from-emerald-50/60 to-white">
          <CardHeader>
            <CardTitle className="text-base text-emerald-700">Potential annual recovery</CardTitle>
            <CardDescription>Eliminating PF penalty + adding capacitor bank.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-extrabold text-emerald-700">{fmt(inputs.currency, c.totalPotential)}</p>
            <p className="mt-1 text-xs text-emerald-700/70">
              Includes {fmt(inputs.currency, c.kvaSavings)} from reduced billed kVA.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action items */}
      <Card className="border border-white/70">
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <Lightbulb className="size-4 text-amber-500" />
          <CardTitle className="text-base">Recommendations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-[#10375c]/85">
          {c.pfDeficit > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2">
              📍 Install APFC (Automatic Power Factor Correction) capacitor bank rated{' '}
              <span className="font-bold">≈ {(c.avgKva * Math.sin(Math.acos(c.avgPf))).toFixed(0)} kVAR</span>
              {' '}to lift PF from {c.avgPf.toFixed(2)} to {c.targetPf.toFixed(2)}.
            </div>
          )}
          {c.vthd > 5 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/60 px-3 py-2">
              📍 V-THD averages <span className="font-bold">{c.vthd.toFixed(2)}%</span> — exceeds IEEE 519 (5%).
              Consider passive/active harmonic filters at major VFD loads.
            </div>
          )}
          {c.vthd <= 5 && c.pfDeficit <= 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2">
              ✅ No major PQ-driven cost leakage detected. Continue periodic audits.
            </div>
          )}
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-2">
            📍 Payback estimate for a {fmt(inputs.currency, c.totalPotential)} annual saving on a typical{' '}
            ₹3 L–5 L APFC capex is <span className="font-bold">~6–12 months</span>.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
