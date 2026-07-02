import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import * as echarts from 'echarts'

export async function exportDashboardPdf(root: HTMLElement, filename: string) {
  const instances: echarts.ECharts[] = []
  root.querySelectorAll('.echarts-for-react').forEach((node) => {
    const chart = echarts.getInstanceByDom(node as HTMLElement)
    if (chart) {
      chart.setOption({ toolbox: { show: false } })
      instances.push(chart)
    }
  })

  await new Promise((r) => setTimeout(r, 100))

  const canvas = await html2canvas(root, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    windowWidth: root.scrollWidth,
  })

  instances.forEach((chart) => chart.setOption({ toolbox: { show: true } }))

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imgWidth = pageWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  let heightLeft = imgHeight
  let position = 0

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
  heightLeft -= pageHeight

  while (heightLeft > 0) {
    position = heightLeft - imgHeight
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
  }

  pdf.save(filename)
}
