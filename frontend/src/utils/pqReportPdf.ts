import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

import type { AnalyticsPayload, AuditMetadata, HarmonicSpectrumPoint, MetricBlock } from '@/types/pq'

const PRIMARY = '#10375C'
const MARGIN = 48

function fmt(v: number | null | undefined, digits = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return v.toFixed(digits)
}

type Status = 'good' | 'warning' | 'critical' | 'neutral'

// Mirrors AnalyticsSummaryTable.getStatus so the PDF status column matches the
// dashboard tables exactly.
function statusParam(label: string): string {
  if (label.includes('VTHD')) return 'VTHD'
  if (label.includes('ITHD')) return 'ITHD'
  if (label.includes('PF')) return 'PF'
  return label
}

function getStatus(param: string, avg: number | null | undefined): Status {
  if (avg === null || avg === undefined || Number.isNaN(avg)) return 'neutral'
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

function statusLabel(s: Status): { text: string; rgb: [number, number, number] } {
  switch (s) {
    case 'good': return { text: 'Good', rgb: [16, 185, 129] }
    case 'warning': return { text: 'Warning', rgb: [217, 119, 6] }
    case 'critical': return { text: 'Critical', rgb: [220, 38, 38] }
    default: return { text: '—', rgb: [120, 120, 120] }
  }
}

type TableRow = { label: string; unit: string; block: MetricBlock }

// Draws a Parameter / Min / Max / Avg / Status table. The whole table is kept on
// one page (reserved up front) so the header never separates from its rows.
function drawAnalyticsTable(pdf: jsPDF, yIn: number, title: string, rows: TableRow[]): number {
  const pageW = pdf.internal.pageSize.getWidth()
  const tableLeft = MARGIN
  const tableRight = pageW - MARGIN
  const headerH = 18
  const rowH = 16

  let y = ensureSpace(pdf, yIn, 16 + headerH + rowH * rows.length + 24)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(PRIMARY)
  pdf.text(title, tableLeft, y)
  y += 8

  const colParam = tableLeft + 6
  const colMin = tableLeft + 210
  const colMax = tableLeft + 285
  const colAvg = tableLeft + 360
  const colStatus = tableLeft + 432

  // Header band
  pdf.setFillColor(16, 55, 92)
  pdf.rect(tableLeft, y, tableRight - tableLeft, headerH, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  const hy = y + 12
  pdf.text('Parameter', colParam, hy)
  pdf.text('Min', colMin, hy)
  pdf.text('Max', colMax, hy)
  pdf.text('Avg', colAvg, hy)
  pdf.text('Status', colStatus, hy)
  y += headerH

  pdf.setFontSize(8)
  rows.forEach((row, i) => {
    if (i % 2 === 1) {
      pdf.setFillColor(244, 246, 255)
      pdf.rect(tableLeft, y, tableRight - tableLeft, rowH, 'F')
    }
    const ty = y + 11
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(16, 55, 92)
    pdf.text(row.unit ? `${row.label} (${row.unit})` : row.label, colParam, ty)
    pdf.setTextColor(80, 80, 80)
    pdf.text(fmt(row.block.min), colMin, ty)
    pdf.text(fmt(row.block.max), colMax, ty)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(16, 55, 92)
    pdf.text(fmt(row.block.avg), colAvg, ty)

    const { text, rgb } = statusLabel(getStatus(statusParam(row.label), row.block.avg))
    pdf.setTextColor(rgb[0], rgb[1], rgb[2])
    pdf.text(text, colStatus, ty)
    y += rowH
  })

  pdf.setDrawColor(220, 224, 235)
  pdf.setLineWidth(0.5)
  pdf.line(tableLeft, y, tableRight, y)

  return y + 16
}

function ensureSpace(pdf: jsPDF, y: number, need: number): number {
  const pageH = pdf.internal.pageSize.getHeight()
  if (y + need > pageH - MARGIN) {
    pdf.addPage()
    return MARGIN + 20
  }
  return y
}

export async function exportPqReportPdf(params: {
  metadata: AuditMetadata
  filename: string
  totalRows: number
  analytics: AnalyticsPayload
  voltageHarmonicSpectrum: HarmonicSpectrumPoint[]
  currentHarmonicSpectrum: HarmonicSpectrumPoint[]
  aiObservations: string[]
  chartElements?: HTMLElement[]
  saveAs: string
}) {
  const {
    metadata,
    filename,
    totalRows,
    analytics,
    voltageHarmonicSpectrum,
    currentHarmonicSpectrum,
    aiObservations,
    chartElements = [],
    saveAs,
  } = params

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()

  pdf.setFillColor(16, 55, 92)
  pdf.rect(0, 0, pageW, 72, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  pdf.text('Power Quality Audit Report', MARGIN, 40)
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.text(metadata.company_name || 'Company', MARGIN, 58)

  let y = 96
  pdf.setTextColor(PRIMARY)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.text('Site & audit details', MARGIN, y)
  y += 18
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  const details = [
    ['Plant', metadata.plant_name],
    ['Address', metadata.address || '—'],
    ['Machine', metadata.machine_name || '—'],
    ['Engineer', metadata.engineer_name || '—'],
    ['Audit date', metadata.audit_date || '—'],
    ['Analyzer', metadata.pq_analyzer_type],
    ['Source file', filename],
    ['Records (normalized)', String(totalRows)],
  ]
  for (const [label, value] of details) {
    pdf.setFont('helvetica', 'bold')
    pdf.text(`${label}:`, MARGIN, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(String(value), MARGIN + 100, y)
    y += 14
  }

  y += 8
  y = ensureSpace(pdf, y, 80)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.text('Executive summary', MARGIN, y)
  y += 18
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  const summaryLines = [
    `Voltage imbalance: ${fmt(analytics.voltage.imbalance_pct)}%`,
    `Current imbalance: ${fmt(analytics.current.imbalance_pct)}%`,
    `Average PF: ${fmt(analytics.pf.avg, 3)}`,
    `Average frequency: ${fmt(analytics.frequency.avg, 2)} Hz`,
    `Average kW / kVA: ${fmt(analytics.kw.avg)} / ${fmt(analytics.kva.avg)}`,
  ]
  for (const line of summaryLines) {
    pdf.text(`• ${line}`, MARGIN + 8, y)
    y += 14
  }

  y += 10
  y = ensureSpace(pdf, y, 40)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.setTextColor(PRIMARY)
  pdf.text('Detailed analytics', MARGIN, y)
  y += 18

  const nullBlock: MetricBlock = { min: null, max: null, avg: null, rms: null }
  y = drawAnalyticsTable(pdf, y, 'Voltage Analytics', [
    { label: 'Phase L1', unit: 'V', block: analytics.voltage.phase_a },
    { label: 'Phase L2', unit: 'V', block: analytics.voltage.phase_b },
    { label: 'Phase L3', unit: 'V', block: analytics.voltage.phase_c },
  ])
  y = drawAnalyticsTable(pdf, y, 'Current Analytics', [
    { label: 'Phase L1', unit: 'A', block: analytics.current.phase_a },
    { label: 'Phase L2', unit: 'A', block: analytics.current.phase_b },
    { label: 'Phase L3', unit: 'A', block: analytics.current.phase_c },
  ])
  y = drawAnalyticsTable(pdf, y, 'Power & Energy Profile', [
    { label: 'Active Power', unit: 'kW', block: analytics.kw },
    { label: 'Apparent Power', unit: 'kVA', block: analytics.kva },
    { label: 'Reactive Power (Q)', unit: 'kVAR', block: analytics.kvar ?? nullBlock },
    { label: 'Distortion (D)', unit: 'kVAR', block: analytics.dkvar ?? nullBlock },
    { label: 'Non-Active (N)', unit: 'kVAR', block: analytics.nkvar ?? nullBlock },
    { label: 'Power Factor', unit: '', block: analytics.pf },
    { label: 'Displacement PF', unit: '', block: analytics.dpf ?? nullBlock },
    { label: 'Frequency', unit: 'Hz', block: analytics.frequency },
  ])
  y = drawAnalyticsTable(pdf, y, 'Harmonic Distortion (THD)', [
    { label: 'VTHD L1', unit: '%', block: analytics.vthd?.phase_a ?? nullBlock },
    { label: 'VTHD L2', unit: '%', block: analytics.vthd?.phase_b ?? nullBlock },
    { label: 'VTHD L3', unit: '%', block: analytics.vthd?.phase_c ?? nullBlock },
    { label: 'ITHD L1', unit: '%', block: analytics.ithd?.phase_a ?? nullBlock },
    { label: 'ITHD L2', unit: '%', block: analytics.ithd?.phase_b ?? nullBlock },
    { label: 'ITHD L3', unit: '%', block: analytics.ithd?.phase_c ?? nullBlock },
  ])

  y += 8
  y = ensureSpace(pdf, y, 60)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.text('Voltage Harmonic spectrum (top orders)', MARGIN, y)
  y += 16
  pdf.setFontSize(9)
  const topV = voltageHarmonicSpectrum.slice(0, 8)
  for (const pt of topV) {
    pdf.text(`H${pt.order}: ${fmt(pt.magnitude_pct, 2)}%`, MARGIN + 8, y)
    y += 12
  }

  y += 8
  y = ensureSpace(pdf, y, 60)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.text('Current Harmonic spectrum (top orders)', MARGIN, y)
  y += 16
  pdf.setFontSize(9)
  const topI = currentHarmonicSpectrum.slice(0, 8)
  for (const pt of topI) {
    pdf.text(`H${pt.order}: ${fmt(pt.magnitude_pct, 2)}%`, MARGIN + 8, y)
    y += 12
  }

  y += 6
  y = ensureSpace(pdf, y, 80)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.setTextColor(PRIMARY)
  pdf.text('AI observations', MARGIN, y)
  y += 16
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  for (const note of aiObservations) {
    y = ensureSpace(pdf, y, 40)
    const wrapped = pdf.splitTextToSize(note, pageW - MARGIN * 2)
    pdf.text(wrapped, MARGIN + 8, y)
    y += wrapped.length * 12 + 6
  }

  if (chartElements.length > 0) {
    pdf.addPage()
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.setTextColor(PRIMARY)
    pdf.text('Measurement charts', MARGIN, MARGIN)
    y = MARGIN + 24

    const maxChartW = pageW - MARGIN * 2
    // Cap height so roughly two charts fit per page; width is derived from the
    // chart's real aspect ratio below so nothing looks stretched.
    const maxChartH = 300

    for (const el of chartElements) {
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      })
      const img = canvas.toDataURL('image/png')

      // Preserve the captured chart's true aspect ratio. Previously the image was
      // forced into a fixed box, which squashed wide charts and made them look
      // stretched. Fit to width, then clamp by height, keeping the ratio.
      const ratio = canvas.width > 0 ? canvas.height / canvas.width : 0.5
      let drawW = maxChartW
      let drawH = drawW * ratio
      if (drawH > maxChartH) {
        drawH = maxChartH
        drawW = ratio > 0 ? drawH / ratio : maxChartW
      }
      const x = MARGIN + (maxChartW - drawW) / 2

      y = ensureSpace(pdf, y, drawH + 28)
      const title = el.getAttribute('data-report-chart') ?? 'Chart'
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.setTextColor(PRIMARY)
      pdf.text(title, MARGIN, y)
      y += 12
      pdf.addImage(img, 'PNG', x, y, drawW, drawH)
      y += drawH + 20
    }
  }

  const totalPages = pdf.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)
    pdf.setFontSize(8)
    pdf.setTextColor(120, 120, 120)
    pdf.text(
      `AI Power Quality Analyzer · Page ${i} of ${totalPages}`,
      MARGIN,
      pdf.internal.pageSize.getHeight() - 24,
    )
    pdf.setDrawColor(243, 198, 35)
    pdf.setLineWidth(2)
    pdf.line(MARGIN, pdf.internal.pageSize.getHeight() - 32, pageW - MARGIN, pdf.internal.pageSize.getHeight() - 32)
  }

  pdf.save(saveAs)
}
