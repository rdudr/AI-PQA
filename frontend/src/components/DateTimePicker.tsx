import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, Check, ChevronLeft, ChevronRight, X } from 'lucide-react'

import { cn } from '@/utils/cn'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad = (n: number) => String(n).padStart(2, '0')

// `YYYY-MM-DDTHH:MM` — matches the format the dashboard's range filter expects.
function toLocalString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function parseLocal(s?: string): Date | null {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatDisplay(d: Date): string {
  return `${pad(d.getDate())} ${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const startDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

type Accent = 'cyan' | 'orange'

const ACCENTS: Record<Accent, { label: string; selected: string; okBtn: string; ring: string }> = {
  cyan: {
    label: 'text-cyan-300',
    selected: 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-sm shadow-blue-500/30',
    okBtn: 'from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-blue-500/20',
    ring: 'focus:ring-cyan-400/40',
  },
  orange: {
    label: 'text-orange-300',
    selected: 'bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-sm shadow-orange-500/30',
    okBtn: 'from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 shadow-orange-500/20',
    ring: 'focus:ring-orange-400/40',
  },
}

interface DateTimePickerProps {
  label: string
  value: string
  onChange: (v: string) => void
  min?: string
  max?: string
  accent?: Accent
  open: boolean
  onOpenChange: (open: boolean) => void
  placeholder?: string
}

export function DateTimePicker({
  label,
  value,
  onChange,
  min,
  max,
  accent = 'cyan',
  open,
  onOpenChange,
  placeholder = 'Select date & time',
}: DateTimePickerProps) {
  const minD = useMemo(() => parseLocal(min), [min])
  const maxD = useMemo(() => parseLocal(max), [max])
  const selected = useMemo(() => parseLocal(value), [value])
  const styles = ACCENTS[accent]

  // Working draft — only committed to `value` when the user presses OK, so the
  // panel doesn't refilter on every intermediate day/time click.
  const seed = selected ?? minD ?? new Date()
  const [draft, setDraft] = useState<Date>(seed)
  const [view, setView] = useState<{ y: number; m: number }>(() => ({ y: seed.getFullYear(), m: seed.getMonth() }))

  // Re-seed when the picker transitions closed → open so it reflects the latest
  // committed value. Adjusting state during render (guarded by the prev-open
  // tracker) is React's recommended alternative to a re-seeding effect.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDraft(seed)
      setView({ y: seed.getFullYear(), m: seed.getMonth() })
    }
  }

  const cells = useMemo(() => buildMonthGrid(view.y, view.m), [view])
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), [])
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), [])

  const isDayDisabled = (d: Date): boolean => {
    const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59)
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0)
    if (minD && endOfDay.getTime() < minD.getTime()) return true
    if (maxD && startOfDay.getTime() > maxD.getTime()) return true
    return false
  }

  const pickDay = (d: Date) =>
    setDraft(prev => new Date(d.getFullYear(), d.getMonth(), d.getDate(), prev.getHours(), prev.getMinutes()))
  const setHour = (h: number) =>
    setDraft(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate(), h, prev.getMinutes()))
  const setMinute = (mm: number) =>
    setDraft(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate(), prev.getHours(), mm))

  const clampDraft = (d: Date): Date => {
    let t = d.getTime()
    if (minD && t < minD.getTime()) t = minD.getTime()
    if (maxD && t > maxD.getTime()) t = maxD.getTime()
    return new Date(t)
  }

  const confirm = () => {
    onChange(toLocalString(clampDraft(draft)))
    onOpenChange(false)
  }
  const clear = () => {
    onChange('')
    onOpenChange(false)
  }
  const gotoMonth = (delta: number) =>
    setView(v => {
      const d = new Date(v.y, v.m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-2">
      <span className={cn('text-[9px] font-bold uppercase tracking-wider', styles.label)}>{label}</span>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="mt-1 flex w-full items-center justify-between gap-2 rounded-lg bg-white/5 px-2 py-1.5 text-left transition hover:bg-white/10 cursor-pointer"
      >
        <span className={cn('font-mono text-xs font-semibold', selected ? 'text-white' : 'text-blue-200/50')}>
          {selected ? formatDisplay(selected) : placeholder}
        </span>
        <CalendarDays className={cn('size-3.5 shrink-0', styles.label)} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-lg border border-white/15 bg-[#0c2a47]/95 p-2.5 shadow-xl">
              {/* Month navigation */}
              <div className="mb-1.5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => gotoMonth(-1)}
                  className="rounded-md p-1 text-blue-200 transition hover:bg-white/10 hover:text-white cursor-pointer"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span className="text-xs font-semibold text-white">
                  {MONTH_NAMES[view.m]} {view.y}
                </span>
                <button
                  type="button"
                  onClick={() => gotoMonth(1)}
                  className="rounded-md p-1 text-blue-200 transition hover:bg-white/10 hover:text-white cursor-pointer"
                  aria-label="Next month"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>

              {/* Weekday header */}
              <div className="grid grid-cols-7 gap-0.5">
                {WEEKDAYS.map((d, i) => (
                  <div key={i} className="py-0.5 text-center text-[9px] font-bold text-blue-200/50">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((cell, i) => {
                  if (!cell) return <div key={i} />
                  const isSel = sameDay(cell, draft)
                  const disabled = isDayDisabled(cell)
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={disabled}
                      onClick={() => pickDay(cell)}
                      className={cn(
                        'aspect-square rounded-md text-[11px] font-medium transition cursor-pointer',
                        isSel ? styles.selected : 'text-blue-100 hover:bg-white/10',
                        disabled && 'cursor-not-allowed text-blue-200/20 hover:bg-transparent',
                      )}
                    >
                      {cell.getDate()}
                    </button>
                  )
                })}
              </div>

              {/* Time selectors */}
              <div className="mt-2 flex items-center gap-1.5 border-t border-white/10 pt-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-blue-200">Time</span>
                <select
                  value={draft.getHours()}
                  onChange={(e) => setHour(Number(e.target.value))}
                  className={cn(
                    'rounded-md border border-white/10 bg-[#0c2a47] px-1.5 py-1 font-mono text-xs font-semibold text-white outline-none [color-scheme:dark] focus:ring-2',
                    styles.ring,
                  )}
                  aria-label="Hour"
                >
                  {hours.map(h => (
                    <option key={h} value={h}>{pad(h)}</option>
                  ))}
                </select>
                <span className="font-mono text-xs font-bold text-blue-200">:</span>
                <select
                  value={draft.getMinutes()}
                  onChange={(e) => setMinute(Number(e.target.value))}
                  className={cn(
                    'rounded-md border border-white/10 bg-[#0c2a47] px-1.5 py-1 font-mono text-xs font-semibold text-white outline-none [color-scheme:dark] focus:ring-2',
                    styles.ring,
                  )}
                  aria-label="Minute"
                >
                  {minutes.map(mm => (
                    <option key={mm} value={mm}>{pad(mm)}</option>
                  ))}
                </select>
              </div>

              {/* Confirm / clear */}
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={clear}
                  className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-100 transition hover:bg-white/10 cursor-pointer"
                >
                  <X className="size-3" /> Clear
                </button>
                <button
                  type="button"
                  onClick={confirm}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-md transition cursor-pointer',
                    styles.okBtn,
                  )}
                >
                  <Check className="size-3.5" strokeWidth={3} /> OK
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
