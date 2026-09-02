/** Equipment health scoring.
 *
 *  Lives outside the page component so the Health screen and the exported PDF
 *  report compute the same score from the same curves. Deliberately free of
 *  JSX — the page maps `key` to an icon, the PDF ignores icons entirely.
 */
import type { ProcessResponse } from '@/types/pq'

export type HealthStatus = 'good' | 'fair' | 'poor'

export interface HealthComponent {
  key: string
  label: string
  raw: number
  score: number                // 0–100
  weight: number               // contribution to overall
  status: HealthStatus
  detail: string
  recommendation: string
}

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)) }

export function statusOf(score: number): HealthStatus {
  if (score >= 80) return 'good'
  if (score >= 55) return 'fair'
  return 'poor'
}

export function computeHealth(data: ProcessResponse): HealthComponent[] {
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

/** Weighted composite of every component score. */
export function overallHealthScore(components: HealthComponent[]): number {
  if (!components.length) return 0
  return Math.round(components.reduce((s, c) => s + c.score * c.weight, 0))
}

export const HEALTH_STATUS_LABEL: Record<HealthStatus, string> = {
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
}
