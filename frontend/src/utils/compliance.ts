/** Standards compliance evaluation.
 *
 *  Lives outside the page component so the Compliance screen and the exported
 *  PDF report run the exact same rules — a verdict can never differ between
 *  what the engineer sees and what the client receives.
 */
import type { ProcessResponse } from '@/types/pq'

export type Verdict = 'pass' | 'fail' | 'warn'

export interface ComplianceRule {
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

export interface ComplianceSummary {
  total: number
  pass: number
  warn: number
  fail: number
  score: number
}

export function evaluateCompliance(data: ProcessResponse): ComplianceRule[] {
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

/** Headline counts + an overall percentage (a marginal counts as a half pass). */
export function complianceSummary(rules: ComplianceRule[]): ComplianceSummary {
  const total = rules.length
  const pass = rules.filter(r => r.verdict === 'pass').length
  const warn = rules.filter(r => r.verdict === 'warn').length
  const fail = rules.filter(r => r.verdict === 'fail').length
  const score = total ? Math.round((pass + warn * 0.5) / total * 100) : 0
  return { total, pass, warn, fail, score }
}

/** Group rules by the standard they belong to, preserving insertion order. */
export function groupByStandard(rules: ComplianceRule[]): Record<string, ComplianceRule[]> {
  const out: Record<string, ComplianceRule[]> = {}
  for (const r of rules) (out[r.standard] ??= []).push(r)
  return out
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  pass: 'Pass',
  warn: 'Marginal',
  fail: 'Fail',
}
