import { useMemo } from 'react'
import { AlertTriangle, Info, Zap } from 'lucide-react'
import type { EventsResponse } from '@/types/pq'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Props {
  data: EventsResponse
  maxRows?: number
}

export function EventsTable({ data, maxRows = 50 }: Props) {
  const displayEvents = useMemo(
    () => data.events.slice(0, maxRows),
    [data.events, maxRows],
  )

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Zap className="w-4 h-4" />
      case 'warning':
        return <AlertTriangle className="w-4 h-4" />
      default:
        return <Info className="w-4 h-4" />
    }
  }

  if (data.total_events === 0) {
    return (
      <Card className="border border-[#10375c]/20 bg-white/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-[#10375c]">Events Detected</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-[#10375c]/60">
            No events detected. System operating within normal parameters.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border border-[#10375c]/20 bg-white/60 backdrop-blur-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-[#10375c]">
          Events Detected ({data.total_events})
        </CardTitle>
        {data.total_events > maxRows && (
          <span className="text-xs text-[#10375c]/60">
            Showing {maxRows} of {data.total_events}
          </span>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {displayEvents.map((event, idx) => (
            <div
              key={idx}
              className="border border-[#10375c]/12 rounded-lg p-3 bg-white/50 hover:bg-white/80 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0 text-[#10375c]">
                  {getSeverityIcon(event.severity)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[#10375c] text-sm">
                      {event.event_type.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <Badge variant="outline" className={`text-xs ${getSeverityColor(event.severity)}`}>
                      {event.severity}
                    </Badge>
                    {event.phase && (
                      <Badge variant="secondary" className="text-xs">
                        {event.phase}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-[#10375c]/80 mt-1">{event.message}</p>
                  {event.timestamp && (
                    <p className="text-xs text-[#10375c]/50 mt-1">{event.timestamp}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
