import { motion } from 'framer-motion'
import { Activity, AlertTriangle, CheckCircle, Zap, ActivitySquare, Gauge, Waves } from 'lucide-react'

import type { AnalyticsPayload, MetricBlock } from '@/types/pq'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  analytics: AnalyticsPayload
}

function fmt(v: number | null | undefined, digits = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return v.toFixed(digits)
}

type Status = 'good' | 'warning' | 'critical' | 'neutral'

function getStatus(param: string, avg: number | null | undefined): Status {
  if (avg === null || avg === undefined) return 'neutral'

  if (param === 'PF') {
    if (avg < 0.7) return 'critical'
    if (avg < 0.85) return 'warning'
    return 'good'
  }
  if (param.includes('VTHD')) {
    if (avg > 8) return 'critical'
    if (avg > 5) return 'warning'
    return 'good'
  }
  if (param.includes('ITHD')) {
    if (avg > 15) return 'critical'
    if (avg > 10) return 'warning'
    return 'good'
  }
  if (param === 'Frequency') {
    if (avg < 49 || avg > 61) return 'critical'
    if (avg < 49.5 || avg > 60.5) return 'warning'
    return 'good'
  }
  return 'neutral'
}

function StatusIndicator({ status }: { status: Status }) {
  if (status === 'good') return <CheckCircle className="size-4 text-emerald-500" />
  if (status === 'warning') return <AlertTriangle className="size-4 text-yellow-500" />
  if (status === 'critical') return <Activity className="size-4 text-red-500" />
  return <div className="size-2 rounded-full bg-gray-300" />
}

interface RowDef {
  label: string
  block: MetricBlock
  unit: string
}

function MiniTable({ rows, title, icon: Icon, delay }: { rows: RowDef[], title: string, icon: any, delay: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ delay }}
    >
      <Card className="h-full overflow-hidden border border-white/70 bg-white/40 shadow-lg backdrop-blur-md transition-all hover:bg-white/50 hover:shadow-xl">
        <CardHeader className="border-b border-[#10375c]/10 bg-gradient-to-r from-white/70 to-white/30 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#10375c]/10 text-[#10375c]">
              <Icon className="size-4" />
            </div>
            <CardTitle className="text-base font-semibold tracking-tight text-[#10375c]">
              {title}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#10375c]">
              <thead className="bg-[#f4f6ff]/60 font-semibold uppercase tracking-wider text-[#10375c]/70">
                <tr>
                  <th className="px-5 py-3">Parameter</th>
                  <th className="px-5 py-3">Min</th>
                  <th className="px-5 py-3">Max</th>
                  <th className="px-5 py-3">Avg</th>
                  <th className="px-5 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#10375c]/5">
                {rows.map((row) => {
                  const status = getStatus(
                    row.label.includes('VTHD') ? 'VTHD' : row.label.includes('ITHD') ? 'ITHD' : row.label.includes('PF') ? 'PF' : row.label,
                    row.block.avg
                  )
                  return (
                    <tr
                      key={row.label}
                      className="group transition-colors hover:bg-white/60"
                    >
                      <td className="px-5 py-2.5 font-medium">
                        {row.label} <span className="text-[10px] text-[#10375c]/50">{row.unit}</span>
                      </td>
                      <td className="px-5 py-2.5 tabular-nums text-[#10375c]/80">{fmt(row.block.min)}</td>
                      <td className="px-5 py-2.5 tabular-nums text-[#10375c]/80">{fmt(row.block.max)}</td>
                      <td className="px-5 py-2.5 font-semibold tabular-nums text-[#10375c]">{fmt(row.block.avg)}</td>
                      <td className="px-5 py-2.5">
                        <div className="flex justify-center opacity-80 transition-opacity group-hover:opacity-100">
                          <StatusIndicator status={status} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function AnalyticsSummaryTable({ analytics }: Props) {
  const nullBlock = { min: null, max: null, avg: null, rms: null }

  const voltageRows: RowDef[] = [
    { label: 'Phase L1', block: analytics.voltage.phase_a, unit: 'V' },
    { label: 'Phase L2', block: analytics.voltage.phase_b, unit: 'V' },
    { label: 'Phase L3', block: analytics.voltage.phase_c, unit: 'V' },
  ]

  const currentRows: RowDef[] = [
    { label: 'Phase L1', block: analytics.current.phase_a, unit: 'A' },
    { label: 'Phase L2', block: analytics.current.phase_b, unit: 'A' },
    { label: 'Phase L3', block: analytics.current.phase_c, unit: 'A' },
  ]

  const powerRows: RowDef[] = [
    { label: 'Active Power', block: analytics.kw, unit: 'kW' },
    { label: 'Apparent Power', block: analytics.kva, unit: 'kVA' },
    { label: 'Reactive Power (Q)', block: analytics.kvar || nullBlock, unit: 'kVAR' },
    { label: 'Distortion (D)', block: analytics.dkvar || nullBlock, unit: 'kVAR' },
    { label: 'Non-Active (N)', block: analytics.nkvar || nullBlock, unit: 'kVAR' },
    { label: 'Power Factor', block: analytics.pf, unit: '' },
    { label: 'Displacement PF', block: analytics.dpf || nullBlock, unit: '' },
    { label: 'Frequency', block: analytics.frequency, unit: 'Hz' },
  ]

  const harmonicsRows: RowDef[] = [
    { label: 'VTHD L1', block: analytics.vthd?.phase_a || nullBlock, unit: '%' },
    { label: 'VTHD L2', block: analytics.vthd?.phase_b || nullBlock, unit: '%' },
    { label: 'VTHD L3', block: analytics.vthd?.phase_c || nullBlock, unit: '%' },
    { label: 'ITHD L1', block: analytics.ithd?.phase_a || nullBlock, unit: '%' },
    { label: 'ITHD L2', block: analytics.ithd?.phase_b || nullBlock, unit: '%' },
    { label: 'ITHD L3', block: analytics.ithd?.phase_c || nullBlock, unit: '%' },
  ]

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:gap-8">
      <MiniTable rows={voltageRows} title="Voltage Analytics" icon={Zap} delay={0} />
      <MiniTable rows={currentRows} title="Current Analytics" icon={Waves} delay={0.05} />
      <MiniTable rows={powerRows} title="Power & Energy Profile" icon={Gauge} delay={0.1} />
      <MiniTable rows={harmonicsRows} title="Harmonic Distortion (THD)" icon={ActivitySquare} delay={0.15} />
    </div>
  )
}
