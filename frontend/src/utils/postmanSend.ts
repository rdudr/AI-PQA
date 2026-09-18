/** "Send to PostMan" — the link between this analyser and the KISEM report.
 *
 *  Gathers what the engineer saw on the dashboard — the compliance verdicts,
 *  the equipment-health scores, the cost-of-poor-quality figures typed on
 *  the Cost page, and the charts themselves as images — and parks it on the
 *  server under the chosen panel and recording ID. PostMan lists the queue
 *  and pulls the recording in; the server keeps it for 24 hours.
 *
 *  The charts are captured from the very ECharts nodes on screen (the same
 *  capture the audit PDF uses), so the report shows the analyser's graphs,
 *  not a redrawing of them.
 */
import html2canvas from 'html2canvas'
import * as echarts from 'echarts'

import type { AuditMetadata, ProcessResponse } from '@/types/pq'
import { API_BASE } from '@/services/apiBase'
import type { PostmanExportOptions } from '@/services/api'
import { complianceSummary, evaluateCompliance } from '@/utils/compliance'
import { computeHealth, overallHealthScore, statusOf } from '@/utils/equipmentHealth'
import { computeCost, loadCostInputs } from '@/utils/costOfPoorQuality'

export interface PostmanChart { title: string; image: string; w: number; h: number }

/** Capture every dashboard chart as a JPEG data URL, toolbox hidden. */
export async function captureCharts(chartElements: HTMLElement[]): Promise<PostmanChart[]> {
  const instances: echarts.ECharts[] = []
  document.querySelectorAll('.echarts-for-react').forEach((node) => {
    const chart = echarts.getInstanceByDom(node as HTMLElement)
    if (chart) { chart.setOption({ toolbox: { show: false } }); instances.push(chart) }
  })
  await new Promise((r) => setTimeout(r, 100))
  const out: PostmanChart[] = []
  try {
    for (const el of chartElements) {
      const canvas = await html2canvas(el, { scale: 1.5, backgroundColor: '#ffffff', useCORS: true })
      out.push({ title: el.getAttribute('data-report-chart') ?? 'Chart', image: canvas.toDataURL('image/jpeg', 0.85), w: canvas.width, h: canvas.height })
    }
  } finally {
    instances.forEach((chart) => chart.setOption({ toolbox: { show: true } }))
  }
  return out
}

export async function sendToPostman(
  data: ProcessResponse,
  metadata: AuditMetadata,
  opts: PostmanExportOptions,
  chartElements: HTMLElement[],
): Promise<{ ok: boolean; panel: string; charts: number; expires_hours: number }> {
  const rules = evaluateCompliance(data)
  const health = computeHealth(data)
  const overall = overallHealthScore(health)
  const costInputs = loadCostInputs(data.session_id)
  const charts = await captureCharts(chartElements)
  const body = {
    metadata,
    role: opts.role,
    panel_name: opts.panelName,
    recording_id: opts.recordingId,
    data_quality: data.data_quality,
    nominal_voltage: data.nominal_voltage,
    compliance: { rules, summary: complianceSummary(rules) },
    health: { components: health, overall, status: statusOf(overall) },
    cost: { inputs: costInputs, result: computeCost(data, costInputs) },
    charts,
  }
  const r = await fetch(`${API_BASE}/api/upload/session/${encodeURIComponent(data.session_id)}/postman-send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const errBody = await r.json().catch(() => null)
    const detail = errBody && typeof errBody === 'object' && 'detail' in errBody ? String((errBody as { detail: unknown }).detail) : r.statusText
    throw new Error(detail || 'Could not send to PostMan')
  }
  return r.json()
}
