import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Settings, Trash2, ChevronDown } from 'lucide-react'

import { saveSession } from '@/utils/sessionDb'
import type { AuditMetadata } from '@/types/pq'
import type { PQModel } from '@/types/config'
import { processUpload } from '@/services/api'
import { fetchModels, addModel, deleteModel } from '@/services/configApi'
import { useNotifications } from '@/contexts/NotificationContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FileUploadZone } from '@/upload/FileUploadZone'
import { Loading3D } from '@/components/Loading3D'

function todayIsoDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function UploadPage() {
  const navigate = useNavigate()
  const { push } = useNotifications()

  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingModels, setLoadingModels] = useState(false)

  const [displayProgress, setDisplayProgress] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)

  // Slowly tick the progress bar during backend processing
  useEffect(() => {
    if (!isProcessing) return

    const timer = setInterval(() => {
      setDisplayProgress((prev) => {
        if (prev >= 99) return prev
        const remaining = 100 - prev
        const step = Math.max(0.1, remaining * 0.1)
        const next = prev + step
        return next >= 99 ? 99 : parseFloat(next.toFixed(1))
      })
    }, 800)

    return () => clearInterval(timer)
  }, [isProcessing])

  // PQ model dropdown state
  const [models, setModels] = useState<PQModel[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [dropOpen, setDropOpen] = useState(false)
  const [addingNew, setAddingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const dropRef = useRef<HTMLDivElement>(null)

  const [meta, setMeta] = useState<AuditMetadata>({
    pq_analyzer_type: '',
    custom_analyzer_name: '',
    company_name: '',
    plant_name: '',
    address: '',
    machine_name: '',
    engineer_name: '',
    audit_date: todayIsoDate(),
  })

  useEffect(() => {
    setLoadingModels(true)
    fetchModels().then(m => {
      setModels(m)
      if (m.length > 0) {
        setSelectedModel(m[0].name)
        setMeta(prev => ({ ...prev, pq_analyzer_type: m[0].name }))
      }
    }).catch(() => {}).finally(() => {
      setLoadingModels(false)
    })
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false)
        setAddingNew(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedModelInfo = models.find((m) => m.name === selectedModel)

  const handleSelectModel = (name: string) => {
    setSelectedModel(name)
    setMeta((m) => ({ ...m, pq_analyzer_type: name as AuditMetadata['pq_analyzer_type'] }))
    setDropOpen(false)
    setAddingNew(false)
  }

  const handleAddNew = async () => {
    const name = newName.trim()
    if (!name) return
    try {
      const created = await addModel(name)
      setModels((prev) => [...prev, created])
      handleSelectModel(name)
      setAddingNew(false)
      setNewName('')
      setDropOpen(false)
      push('success', 'PQ model added', `"${name}" has been added. Configure it before uploading.`)
    } catch (e) {
      push('error', 'Could not add model', String(e))
    }
  }

  const handleDelete = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await deleteModel(name)
      setModels((prev) => prev.filter((m) => m.name !== name))
      if (selectedModel === name) {
        setSelectedModel('other')
        setMeta((m) => ({ ...m, pq_analyzer_type: 'other' }))
      }
      push('info', 'PQ model removed', `"${name}" and its configuration have been deleted.`)
    } catch (e) {
      push('error', 'Could not remove model', String(e))
    }
  }

  const previewRows = useMemo(
    () => (file ? `${file.name} · ${(file.size / 1024).toFixed(1)} KB` : 'No file yet'),
    [file],
  )

  const submit = async () => {
    setError(null)
    if (!file) { setError('Attach a measurement file to continue.'); return }
    if (!meta.company_name.trim() || !meta.plant_name.trim()) {
      setError('Company and plant names are required.')
      return
    }
    setBusy(true)
    setProgress(0)
    setDisplayProgress(0)
    setIsProcessing(false)
    try {
      const payload = await processUpload(file, meta, (pct) => {
        setProgress(pct)
        if (pct < 100) {
          setDisplayProgress(Math.round(pct * 0.9))
        } else {
          setDisplayProgress(90)
          setIsProcessing(true)
        }
      })

      // Fire notifications for unmatched columns from data quality
      const dq = (payload as any).data_quality
      if (dq?.scale_fixes && Object.keys(dq.scale_fixes).length > 0) {
        push('warning', 'Unit corrections applied', `Scale fixes: ${Object.entries(dq.scale_fixes).map(([k, v]) => `${k} ${v}`).join(', ')}`)
      }
      if (dq?.outliers_removed && Object.keys(dq.outliers_removed).length > 0) {
        const total = Object.values(dq.outliers_removed as Record<string, number>).reduce((a, b) => a + b, 0)
        push('warning', 'Outliers removed', `${total} outlier data point(s) removed across ${Object.keys(dq.outliers_removed).length} column(s).`)
      }
      if (dq?.three_phase_warn?.length > 0) {
        for (const w of dq.three_phase_warn as string[]) {
          push('warning', 'Three-phase issue', w)
        }
      }
      if (dq?.quality_score !== undefined) {
        const score = dq.quality_score as number
        push(
          score >= 80 ? 'success' : score >= 60 ? 'warning' : 'error',
          'Data quality score',
          `${score.toFixed(0)}/100 for "${file.name}"`,
        )
      }

      setIsProcessing(false)
      setDisplayProgress(100)

      // Delay navigation slightly so the user sees the progress bar complete at 100%
      await new Promise((resolve) => setTimeout(resolve, 600))

      await saveSession(payload)
      navigate('/dashboard')
    } catch (e) {
      setIsProcessing(false)
      const msg = e instanceof Error ? e.message : 'Processing failed'
      setError(msg)
      push('error', 'Upload failed', msg)
    } finally {
      setBusy(false)
    }
  }

  // Split models: built-ins vs custom
  const builtins = models.filter((m) => m.is_builtin)
  const customs = models.filter((m) => !m.is_builtin)

  // ── Full-screen loading for all async operations ─────────────────────────
  if (loadingModels) {
    return <Loading3D fullScreen message="Loading PQ models..." />
  }
  if (busy) {
    return (
      <Loading3D
        fullScreen
        message={!isProcessing ? `Uploading file… ${progress}%` : 'Analyzing PQ data…'}
        progress={displayProgress}
        progressLabel={!isProcessing ? 'Upload progress' : 'Processing progress'}
      />
    )
  }
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs uppercase tracking-[0.28em] text-[#10375c]/55">Phase 2 · Measurement intake</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#10375c]">Upload PQ analyzer export</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#10375c]/70">
          Select your PQ model below. Add new models from the dropdown, configure column mappings, then upload your file.
        </p>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* File upload */}
        <Card className="border border-white/70 lg:col-span-3">
          <CardHeader>
            <CardTitle>Drag &amp; drop upload</CardTitle>
            <CardDescription>{previewRows}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FileUploadZone
              disabled={busy}
              error={error}
              file={file}
              onClear={() => { setError(null); setFile(null) }}
              onFiles={(files) => { setError(null); setFile(files[0] ?? null) }}
            />
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card className="border border-white/70 lg:col-span-2">
          <CardHeader>
            <CardTitle>Audit metadata</CardTitle>
            <CardDescription>Captured on PDF exports and API payloads.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* ── Smart PQ model dropdown ─────────────────────────────── */}
            <div className="space-y-2">
              <Label>PQ Analyzer Model</Label>
              <div ref={dropRef} className="relative">
                {/* Trigger */}
                <button
                  type="button"
                  onClick={() => setDropOpen((v) => !v)}
                  className="flex w-full items-center justify-between rounded-xl border border-[#10375c]/15 bg-white px-3 py-2 text-sm text-[#10375c] shadow-sm hover:bg-[#f4f6ff]"
                >
                  <span className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${selectedModelInfo?.has_config ? 'bg-emerald-500' : 'bg-[#10375c]/20'}`} />
                    {selectedModel || 'Select model'}
                  </span>
                  <ChevronDown className="size-4 opacity-50" />
                </button>

                {/* Panel */}
                <AnimatePresence>
                  {dropOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-[#10375c]/12 bg-white shadow-lg"
                    >
                      <div className="max-h-64 overflow-y-auto p-1">
                        {/* Custom models (user-added) */}
                        {customs.length > 0 && (
                          <>
                            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-[#10375c]/40">My models</p>
                            {customs.map((m) => (
                              <div
                                key={m.name}
                                onClick={() => handleSelectModel(m.name)}
                                className={`group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-[#f4f6ff] ${selectedModel === m.name ? 'bg-[#f4f6ff] font-medium' : ''}`}
                              >
                                <span className="flex items-center gap-2">
                                  <span className={`size-2 rounded-full ${m.has_config ? 'bg-emerald-500' : 'bg-yellow-400'}`} />
                                  {m.name}
                                  {!m.has_config && <span className="text-[10px] text-orange-500">(not configured)</span>}
                                </span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDropOpen(false); navigate(`/config/${encodeURIComponent(m.name)}`) }}
                                    className="rounded-md p-1 text-[#10375c]/50 hover:bg-white hover:text-[#10375c]"
                                    title="Configure"
                                  >
                                    <Settings className="size-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => handleDelete(m.name, e)}
                                    className="rounded-md p-1 text-[#10375c]/50 hover:bg-white hover:text-red-500"
                                    title="Remove"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                            <div className="mx-3 my-1 border-t border-[#10375c]/08" />
                          </>
                        )}

                        {/* Built-in models */}
                        <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-[#10375c]/40">Built-in</p>
                        {builtins.map((m) => (
                          <div
                            key={m.name}
                            onClick={() => handleSelectModel(m.name)}
                            className={`group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-[#f4f6ff] ${selectedModel === m.name ? 'bg-[#f4f6ff] font-medium' : ''}`}
                          >
                            <span className="flex items-center gap-2">
                              <span className={`size-2 rounded-full ${m.has_config ? 'bg-emerald-500' : 'bg-[#10375c]/15'}`} />
                              {m.name}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDropOpen(false); navigate(`/config/${encodeURIComponent(m.name)}`) }}
                              className="rounded-md p-1 text-[#10375c]/40 opacity-0 hover:bg-white hover:text-[#10375c] group-hover:opacity-100"
                              title="Configure"
                            >
                              <Settings className="size-3.5" />
                            </button>
                          </div>
                        ))}

                        {/* Add new */}
                        <div className="mx-3 my-1 border-t border-[#10375c]/08" />
                        {!addingNew ? (
                          <button
                            onClick={() => setAddingNew(true)}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#10375c] hover:bg-[#f4f6ff]"
                          >
                            <Plus className="size-4" /> Add new PQ model
                          </button>
                        ) : (
                          <div className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              autoFocus
                              className="mb-2 w-full rounded-lg border border-[#10375c]/20 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#10375c]/30"
                              placeholder="e.g. Megger MPQ2000"
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleAddNew(); if (e.key === 'Escape') { setAddingNew(false); setNewName('') } }}
                            />
                            <div className="flex gap-2">
                              <button onClick={handleAddNew} className="flex-1 rounded-lg bg-[#10375c] px-2 py-1 text-xs font-medium text-white hover:bg-[#10375c]/90">
                                Add model
                              </button>
                              <button onClick={() => { setAddingNew(false); setNewName('') }} className="rounded-lg border px-2 py-1 text-xs text-[#10375c]/60 hover:bg-[#f4f6ff]">
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Configure shortcut if model has no config */}
              {selectedModelInfo && !selectedModelInfo.has_config && (
                <button
                  onClick={() => navigate(`/config/${encodeURIComponent(selectedModel)}`)}
                  className="mt-1 flex items-center gap-1 text-xs text-orange-600 hover:underline"
                >
                  <Settings className="size-3" /> Configure column mappings for this model
                </button>
              )}
            </div>

            {/* ── Rest of metadata fields ──────────────────────────────── */}
            {[
              { id: 'company', label: 'Company Name', key: 'company_name' },
              { id: 'plant',   label: 'Plant Name',   key: 'plant_name'   },
              { id: 'address', label: 'Address',      key: 'address'      },
              { id: 'machine', label: 'Machine Name', key: 'machine_name' },
              { id: 'eng',     label: 'Engineer',     key: 'engineer_name'},
            ].map(({ id, label, key }) => (
              <div key={id} className="space-y-2">
                <Label htmlFor={id}>{label}</Label>
                <Input
                  id={id}
                  value={(meta as any)[key]}
                  onChange={(e) => setMeta((m) => ({ ...m, [key]: e.target.value }))}
                />
              </div>
            ))}

            <div className="space-y-2">
              <Label htmlFor="audit">Audit Date</Label>
              <Input id="audit" type="date" value={meta.audit_date}
                onChange={(e) => setMeta((m) => ({ ...m, audit_date: e.target.value }))} />
            </div>

            <Button className="w-full" size="lg" disabled={busy} type="button" onClick={submit}>
              Process &amp; launch dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
