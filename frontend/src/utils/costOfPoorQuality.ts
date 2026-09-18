/** Cost of poor power quality.
 *
 *  Lives outside the Cost page so the page, the PDF and the PostMan bundle
 *  work the same arithmetic on the same inputs. Inputs are remembered per
 *  session in localStorage, so what the engineer typed on the Cost page is
 *  what "Send to PostMan" carries into the report.
 */
import type { ProcessResponse } from '@/types/pq'

export interface CostInputs {
  tariff: number              // ₹ per kWh
  demandCharge: number        // ₹ per kVA / month
  pfThreshold: number         // utility penalty threshold (typical 0.95)
  pfPenaltyPct: number        // % of bill added per 0.01 below threshold
  hoursPerDay: number         // operating hours
  daysPerYear: number         // operating days
  currency: string            // symbol — defaults to INR ₹
}

export const COST_DEFAULTS: CostInputs = {
  tariff: 9.5,
  demandCharge: 350,
  pfThreshold: 0.95,
  pfPenaltyPct: 1.0,
  hoursPerDay: 16,
  daysPerYear: 300,
  currency: '₹',
}

export interface CostResult {
  annualHours: number; annualKwh: number
  energyCost: number; demandCost: number
  avgKw: number; avgKva: number; avgPf: number; vthd: number
  pfDeficit: number; pfPenaltyPctTotal: number; pfPenalty: number
  harmonicLossPct: number; harmonicLoss: number
  targetPf: number; newKva: number; kvaSavings: number
  totalLeak: number; totalPotential: number
}

function num(n: number | undefined | null, fallback = 0): number {
  if (n == null || Number.isNaN(n)) return fallback
  return Number(n)
}

export function computeCost(data: ProcessResponse, inputs: CostInputs): CostResult {
  const avgKw = num(data.analytics.kw?.avg)
  const avgKva = num(data.analytics.kva?.avg)
  const avgPf = num(data.analytics.pf?.avg, 1)
  const vthd = (num(data.analytics.vthd?.phase_a?.avg) + num(data.analytics.vthd?.phase_b?.avg) + num(data.analytics.vthd?.phase_c?.avg)) / 3

  const annualHours = inputs.hoursPerDay * inputs.daysPerYear
  const annualKwh = avgKw * annualHours
  const energyCost = annualKwh * inputs.tariff
  const demandCost = avgKva * inputs.demandCharge * 12

  const pfDeficit = Math.max(0, inputs.pfThreshold - avgPf)
  const pfDeficitSteps = Math.round(pfDeficit * 100)
  const pfPenaltyPctTotal = pfDeficitSteps * inputs.pfPenaltyPct
  const pfPenalty = (energyCost + demandCost) * (pfPenaltyPctTotal / 100)

  const harmonicLossPct = vthd * 0.5
  const harmonicLoss = energyCost * (harmonicLossPct / 100)

  const targetPf = Math.max(0.95, inputs.pfThreshold)
  const newKva = avgPf > 0 ? avgKw / targetPf : avgKva
  const kvaSavings = Math.max(0, (avgKva - newKva) * inputs.demandCharge * 12)

  const totalLeak = pfPenalty + harmonicLoss
  const totalPotential = totalLeak + kvaSavings

  return {
    annualHours, annualKwh, energyCost, demandCost, avgKw, avgKva, avgPf, vthd,
    pfDeficit, pfPenaltyPctTotal, pfPenalty, harmonicLossPct, harmonicLoss,
    targetPf, newKva, kvaSavings, totalLeak, totalPotential,
  }
}

const KEY = (sessionId: string) => `pq.cost.${sessionId}`

export function loadCostInputs(sessionId: string): CostInputs {
  try {
    const raw = localStorage.getItem(KEY(sessionId))
    return raw ? { ...COST_DEFAULTS, ...(JSON.parse(raw) as Partial<CostInputs>) } : COST_DEFAULTS
  } catch { return COST_DEFAULTS }
}

export function saveCostInputs(sessionId: string, inputs: CostInputs): void {
  try { localStorage.setItem(KEY(sessionId), JSON.stringify(inputs)) } catch { /* private window */ }
}

export function fmtMoney(currency: string, n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1e7) return `${currency} ${(n / 1e7).toFixed(2)} Cr`
  if (n >= 1e5) return `${currency} ${(n / 1e5).toFixed(2)} L`
  return `${currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}
