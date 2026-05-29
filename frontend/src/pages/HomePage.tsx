import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Cpu, Layers, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const pillars = [
  {
    title: 'Modular parsers',
    desc: 'Vendor-specific adapters normalize exports into one universal schema.',
    icon: Layers,
  },
  {
    title: 'Industrial UX',
    desc: 'Glass panels, SCADA-inspired hierarchy, responsive KPI surfaces.',
    icon: Cpu,
  },
  {
    title: 'Audit-ready reports',
    desc: 'Analytics, harmonics, charts, and PDF exports aligned to site metadata.',
    icon: ShieldCheck,
  },
]

export function HomePage() {
  return (
    <div className="w-full space-y-10">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="liquid-glass-card relative overflow-hidden rounded-3xl p-8 sm:p-12"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(243,198,35,0.18),_transparent_55%)]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-[#10375c]/55">
            Enterprise PQ Intelligence
          </p>
          <h1 className="mt-4 text-balance text-3xl font-semibold leading-tight text-[#10375c] sm:text-4xl">
            Upload analyzer exports. Obtain harmonized analytics instantly.
          </h1>
          <p className="mt-4 text-pretty text-base text-[#10375c]/70">
            FastAPI + modular parsers standardize Hioki, Fluke, Schneider, Dranetz,
            and custom CSV flows into a single dashboard—never bind UI to raw vendor
            columns.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/upload">
                Start measurement intake
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link to="/dashboard">Open analytics cockpit</Link>
            </Button>
          </div>
        </div>
      </motion.section>

      <section className="grid gap-4 md:grid-cols-3">
        {pillars.map((p, idx) => (
          <motion.div
            key={p.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
          >
            <Card className="h-full border border-white/70">
              <CardHeader>
                <div className="mb-2 inline-flex size-10 items-center justify-center rounded-xl bg-[#10375c]/10 text-[#10375c]">
                  <p.icon className="size-5" />
                </div>
                <CardTitle className="text-lg">{p.title}</CardTitle>
                <CardDescription>{p.desc}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          </motion.div>
        ))}
      </section>
    </div>
  )
}
