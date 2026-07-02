import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { useRef, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'

type Props = {
  option: EChartsOption
  height?: number | string
  className?: string
  reportTitle?: string
}

export function ChartCard({
  option,
  height = 360,
  className,
  reportTitle,
}: Props) {
  const chartRef = useRef<ReactECharts>(null)
  const [showCopied, setShowCopied] = useState(false)

  const optionWithCopy = useMemo(() => {
    const copyTool = {
      show: true,
      title: 'Copy Image',
      icon: 'path://M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
      onclick: async () => {
        const instance = chartRef.current?.getEchartsInstance()
        if (!instance) return
        try {
          instance.setOption({ toolbox: { show: false } })
          const dataUrl = instance.getDataURL({
            type: 'png',
            pixelRatio: 2,
            backgroundColor: '#ffffff'
          })
          instance.setOption({ toolbox: { show: true } })

          const res = await fetch(dataUrl)
          const blob = await res.blob()
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
          
          setShowCopied(true)
          setTimeout(() => setShowCopied(false), 2000)
        } catch (e) {
          console.error('Failed to copy chart image', e)
        }
      }
    }

    const newOption = { ...option }
    if (newOption.toolbox && (newOption.toolbox as any).feature) {
      newOption.toolbox = {
        ...newOption.toolbox,
        feature: {
          ...(newOption.toolbox as any).feature,
          myCopy: copyTool
        }
      }
    }
    return newOption
  }, [option])

  return (
    <div
      className={`relative liquid-glass-card rounded-2xl p-2 ${className ?? ''}`}
      {...(reportTitle ? { 'data-report-chart': reportTitle } : {})}
    >
      <AnimatePresence>
        {showCopied && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-50/95 px-4 py-1.5 text-sm font-medium text-emerald-700 shadow-md backdrop-blur-md"
          >
            <Check className="size-4" />
            Copied to clipboard
          </motion.div>
        )}
      </AnimatePresence>

      <ReactECharts
        ref={chartRef}
        option={optionWithCopy}
        style={{ height, width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge
        lazyUpdate
      />
    </div>
  )
}
