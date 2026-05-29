import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, BellOff, Check, Trash2 } from 'lucide-react'
import { useNotifications, type Notification } from '@/contexts/NotificationContext'
import { cn } from '@/utils/cn'

const levelStyles: Record<Notification['level'], string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  info:    'border-blue-200   bg-blue-50   text-blue-800',
  warning: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  error:   'border-red-200    bg-red-50    text-red-800',
}

const levelDot: Record<Notification['level'], string> = {
  success: 'bg-emerald-500',
  info:    'bg-blue-500',
  warning: 'bg-yellow-500',
  error:   'bg-red-500',
}

function fmt(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications()
  const [open, setOpen] = useState(false)
  const [muted, setMuted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const toggle = () => {
    setOpen((v) => {
      if (!v) markAllRead()
      return !v
    })
  }

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={toggle}
        className="relative flex size-9 items-center justify-center rounded-xl border border-[#10375c]/10 bg-white/70 text-[#10375c] shadow-sm transition hover:bg-[#f4f6ff]"
        title={muted ? 'Notifications muted' : 'Notifications'}
      >
        {muted ? <BellOff className="size-4 opacity-40" /> : <Bell className="size-4" />}
        {!muted && unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 z-50 w-80 rounded-2xl border border-[#10375c]/12 bg-white shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#10375c]/08 px-4 py-3">
              <p className="text-sm font-semibold text-[#10375c]">
                Notifications {notifications.length > 0 && `(${notifications.length})`}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMuted((v) => !v)}
                  title={muted ? 'Unmute' : 'Mute notifications'}
                  className="rounded-lg p-1.5 text-[#10375c]/50 hover:bg-[#f4f6ff] hover:text-[#10375c]"
                >
                  {muted ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
                </button>
                {notifications.length > 0 && (
                  <>
                    <button
                      onClick={markAllRead}
                      title="Mark all read"
                      className="rounded-lg p-1.5 text-[#10375c]/50 hover:bg-[#f4f6ff] hover:text-[#10375c]"
                    >
                      <Check className="size-3.5" />
                    </button>
                    <button
                      onClick={clearAll}
                      title="Clear all"
                      className="rounded-lg p-1.5 text-[#10375c]/50 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-[#10375c]/40">
                  No notifications
                </p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      'flex gap-3 border-b border-[#10375c]/06 px-4 py-3 last:border-0',
                      !n.read && 'bg-[#f4f6ff]/60',
                    )}
                  >
                    <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', levelDot[n.level])} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-[#10375c]">{n.title}</p>
                        <span className="shrink-0 text-[10px] text-[#10375c]/40">{fmt(n.timestamp)}</span>
                      </div>
                      <p className={cn('mt-0.5 rounded-lg border px-2 py-1 text-xs', levelStyles[n.level])}>
                        {n.message}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
