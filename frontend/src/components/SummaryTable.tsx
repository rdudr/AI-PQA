import { useMemo } from 'react'
import type { SummaryTableData } from '@/types/pq'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  data: SummaryTableData
}

function formatValue(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—'
  }
  return Number(value).toFixed(decimals)
}

export function SummaryTable({ data }: Props) {
  const rows = useMemo(() => data.rows, [data.rows])

  return (
    <Card className="border border-[#10375c]/20 bg-white/60 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-[#10375c]">{data.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#10375c]/12 bg-[#f4f6ff]">
                <th className="px-3 py-2 text-left font-semibold text-[#10375c]">Parameter</th>
                <th className="px-3 py-2 text-right font-semibold text-[#10375c]">Min</th>
                <th className="px-3 py-2 text-right font-semibold text-[#10375c]">Max</th>
                <th className="px-3 py-2 text-right font-semibold text-[#10375c]">Avg</th>
                {rows.some((r) => r.rms !== undefined && r.rms !== null) && (
                  <th className="px-3 py-2 text-right font-semibold text-[#10375c]">RMS</th>
                )}
                {rows.some((r) => r.unit) && (
                  <th className="px-3 py-2 text-center font-semibold text-[#10375c]">Unit</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={idx}
                  className="border-b border-[#10375c]/8 hover:bg-[#f4f6ff]/50 transition-colors"
                >
                  <td className="px-3 py-2 text-[#10375c] font-medium">{row.parameter}</td>
                  <td className="px-3 py-2 text-right text-[#10375c]">
                    {formatValue(row.min)}
                  </td>
                  <td className="px-3 py-2 text-right text-[#10375c]">
                    {formatValue(row.max)}
                  </td>
                  <td className="px-3 py-2 text-right text-[#10375c]">
                    {formatValue(row.avg)}
                  </td>
                  {rows.some((r) => r.rms !== undefined && r.rms !== null) && (
                    <td className="px-3 py-2 text-right text-[#10375c]">
                      {formatValue(row.rms)}
                    </td>
                  )}
                  {rows.some((r) => r.unit) && (
                    <td className="px-3 py-2 text-center text-xs text-[#10375c]/60">
                      {row.unit || ''}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
