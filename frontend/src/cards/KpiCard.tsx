import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

type Props = {
  title: string
  subtitle?: string
  value: string
  trend?: ReactNode
}

export function KpiCard({ title, subtitle, value, trend }: Props) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="liquid-glass-card rounded-2xl px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-wider text-[#10375c]/75">{title}</p>
        {subtitle && (
          <p className="mt-0.5 text-[11px] font-semibold text-[#10375c]/60">{subtitle}</p>
        )}
        <p className="mt-3 text-3xl font-extrabold tracking-tight text-[#10375c]">
          {value}
        </p>
        {trend && <div className="mt-1">{trend}</div>}
      </div>
    </motion.div>
  )
}
