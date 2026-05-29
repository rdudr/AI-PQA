import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight, Building2, Calendar, Cpu, FileWarning,
  History as HistoryIcon, Search, Trash2, Upload,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useNotifications } from '@/contexts/NotificationContext'
import { deleteFromHistory, listHistory, saveSession, setCurrentFromHistory } from '@/utils/sessionDb'
import type { HistoryItem } from '@/utils/sessionDb'
import { deleteSessionRemote, fetchHistory, fetchSessionFull } from '@/services/api'
import type { ProcessResponse } from '@/types/pq'
import { useAuth } from '@/auth/AuthContext'

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-700 bg-emerald-50 border-emerald-200'
  if (score >= 60) return 'text-amber-700  bg-amber-50  border-amber-200'
  return 'text-red-700 bg-red-50 border-red-200'
}

export function HistoryPage() {
  const navigate = useNavigate()
  const { push } = useNotifications()
  const { isAdmin } = useAuth()

  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    // Prefer the central (server-persisted) history; merge in any browser-only
    // sessions so local dev — where the backend has no database — still works.
    void (async () => {
      let merged: HistoryItem[] = []
      try {
        merged = await fetchHistory()
      } catch {
        merged = []
      }
      try {
        const local = await listHistory()
        const seen = new Set(merged.map(i => i.session_id))
        for (const it of local) if (!seen.has(it.session_id)) merged.push(it)
      } catch {
        /* IndexedDB unavailable — ignore */
      }
      merged.sort((a, b) => (b.audit_date || '').localeCompare(a.audit_date || ''))
      setItems(merged)
      setLoading(false)
    })()
  }, [])

  const filtered = items.filter(item => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return [item.filename, item.plant_name, item.company_name, item.analyzer, item.audit_date]
      .some(v => String(v).toLowerCase().includes(q))
  })

  const openSession = async (sessionId: string) => {
    let loaded: ProcessResponse | null = null
    try {
      loaded = await fetchSessionFull(sessionId)
      // Cache locally + set as the dashboard's current session.
      if (loaded) await saveSession(loaded)
    } catch {
      loaded = null
    }
    if (!loaded) {
      // Backend miss (e.g. local dev or session only in this browser).
      loaded = await setCurrentFromHistory(sessionId)
    }
    if (!loaded) {
      push('error', 'Session not found', 'This audit could not be re-opened.')
      return
    }
    push('success', 'Audit loaded', `"${loaded.filename}" is now active on the dashboard.`)
    navigate('/dashboard')
  }

  const removeSession = async (sessionId: string, filename: string) => {
    if (!isAdmin) {
      push('error', 'Permission denied', 'Only the administrator can delete audits.')
      return
    }
    if (!confirm(`Delete history entry for "${filename}"?`)) return
    try {
      await deleteSessionRemote(sessionId)
    } catch {
      /* backend delete best-effort */
    }
    await deleteFromHistory(sessionId)
    setItems(prev => prev.filter(i => i.session_id !== sessionId))
    push('info', 'Audit removed', `"${filename}" was deleted from history.`)
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs uppercase tracking-[0.28em] text-[#10375c]/55">Multi-session · Phase 4</p>
        <h1 className="mt-1 flex items-center gap-3 text-3xl font-semibold text-[#10375c]">
          <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-md shadow-blue-500/30">
            <HistoryIcon className="size-5" strokeWidth={2.5} />
          </span>
          Audit History
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#10375c]/70">
          Every PQ analyzer file you process is kept here. Click an entry to
          reopen it on the dashboard — no re-upload needed.
        </p>
      </motion.div>

      {/* Search row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-[#10375c]/12 bg-white/85 px-3 py-2 shadow-sm w-full max-w-md">
          <Search className="size-4 text-[#10375c]/45" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by plant, company, analyzer, or filename…"
            className="w-full bg-transparent text-sm text-[#10375c] outline-none placeholder:text-[#10375c]/40"
          />
        </div>
        {isAdmin && (
          <Button asChild variant="accent">
            <Link to="/upload"><Upload className="size-4" /> New audit</Link>
          </Button>
        )}
      </div>

      {loading ? (
        <Card className="border border-white/70"><CardContent className="py-10 text-center text-sm text-[#10375c]/55">
          Loading history…
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card className="border border-dashed border-[#eb8317]/45 bg-white/70">
          <CardHeader>
            <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-[#eb8317]/12 text-[#eb8317]">
              <FileWarning />
            </div>
            <CardTitle>{query ? 'No matches' : 'No audits yet'}</CardTitle>
            <CardDescription>
              {query
                ? `Nothing matched "${query}". Try a different term.`
                : isAdmin
                  ? 'Upload a PQ analyzer file to create your first audit.'
                  : 'Ask the administrator to upload a PQ analyzer file.'}
            </CardDescription>
          </CardHeader>
          {isAdmin && !query && (
            <CardContent>
              <Button asChild><Link to="/upload">Go to upload</Link></Button>
            </CardContent>
          )}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item, idx) => (
            <motion.div
              key={item.session_id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.04, 0.4) }}
              whileHover={{ y: -3 }}
              className="group glass-panel relative overflow-hidden rounded-2xl border border-white/70 bg-gradient-to-br from-white/90 via-[#eef4ff]/80 to-[#dde9fb]/80 p-4 shadow-[0_8px_24px_rgba(16,55,92,0.08)] backdrop-blur-[18px] transition-shadow hover:shadow-[0_14px_32px_rgba(16,55,92,0.14)]"
            >
              {/* Top stripe — colored by score */}
              <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${
                item.quality_score >= 80
                  ? 'from-emerald-400 via-emerald-500 to-emerald-400'
                  : item.quality_score >= 60
                    ? 'from-amber-400 via-amber-500 to-amber-400'
                    : 'from-red-400 via-rose-500 to-pink-400'
              }`} />

              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-[#10375c]">
                    {item.plant_name || '(no plant name)'}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-[#10375c]/60">{item.company_name || '—'}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${scoreColor(item.quality_score)}`}>
                  {Math.round(item.quality_score)}/100
                </span>
              </div>

              <dl className="mt-3 space-y-1.5 text-[11px] text-[#10375c]/75">
                <div className="flex items-center gap-1.5">
                  <Cpu className="size-3 text-[#10375c]/45" />
                  <span className="font-mono">{item.analyzer || '—'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="size-3 text-[#10375c]/45" />
                  <span>{item.audit_date || '—'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Building2 className="size-3 text-[#10375c]/45" />
                  <span>{item.total_rows.toLocaleString()} rows</span>
                </div>
              </dl>

              <p className="mt-2 truncate font-mono text-[10px] text-[#10375c]/50" title={item.filename}>
                {item.filename}
              </p>

              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => openSession(item.session_id)}
                  className="inline-flex items-center gap-1 rounded-full bg-[#10375c] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-[#1d4a73]"
                >
                  Open <ArrowRight className="size-3" />
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => removeSession(item.session_id, item.filename)}
                    title="Delete"
                    className="rounded-full border border-red-200/60 bg-white/70 p-1.5 text-red-500 opacity-0 transition group-hover:opacity-100 hover:bg-red-50"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
