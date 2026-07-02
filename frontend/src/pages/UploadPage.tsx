import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Trash2 } from 'lucide-react'

import { saveSession } from '@/utils/sessionDb'
import type { AuditMetadata } from '@/types/pq'
import type { PQModel } from '@/types/config'
import { processUpload } from '@/services/api'
import { fetchModels } from '@/services/configApi'
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


  const [files, setFiles] = useState<{ file: File; model: string }[]>([])
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

  // PQ model list for dropdown options
  const [models, setModels] = useState<PQModel[]>([])

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

  const loadModelsList = useCallback(() => {
    setLoadingModels(true)
    fetchModels().then(m => {
      setModels(m)
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[PQ] Failed to load models from API:', err)
    }).finally(() => {
      setLoadingModels(false)
    })
  }, [])

  useEffect(() => {
    loadModelsList()
  }, [loadModelsList])

  const previewRows = useMemo(
    () => (files.length > 0 ? `${files.length} file(s) ready to process` : 'No files yet'),
    [files],
  )

  const submit = async () => {
    setError(null)
    if (files.length === 0) { setError('Attach at least one measurement file to continue.'); return }
    if (!meta.company_name.trim() || !meta.plant_name.trim()) {
      setError('Company and plant names are required.')
      return
    }
    setBusy(true)
    setProgress(0)
    setDisplayProgress(0)
    setIsProcessing(false)
    try {
      const uniqueModels = Array.from(new Set(files.map(f => f.model).filter(m => m !== 'Auto-detect')))
      const modelString = uniqueModels.length > 0 ? uniqueModels.join(', ') : 'Auto-detect'
      const finalMeta = { ...meta, pq_analyzer_type: modelString }

      const payload = await processUpload(files, finalMeta, (pct) => {
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
          `${score.toFixed(0)}/100 for merged files`,
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
          Upload power quality export files. You can select the specific analyzer model for each file below, or choose Auto-detect. Mappings and models can be managed in the Settings tab.
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
              file={null}
              onFiles={(newFiles) => {
                setError(null)
                setFiles((prev) => {
                  const added = newFiles.map((f) => ({
                    file: f,
                    model: 'Auto-detect',
                  }))
                  return [...prev, ...added]
                })
              }}
            />

            {files.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-semibold tracking-wider uppercase text-[#10375c]/60">Uploaded Files ({files.length})</h3>
                <div className="divide-y divide-[#10375c]/08 rounded-2xl border border-[#10375c]/10 bg-white/50 overflow-hidden shadow-sm">
                  {files.map((item, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 hover:bg-[#f4f6ff]/40 transition">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#10375c]">{item.file.name}</p>
                        <p className="text-[11px] text-[#10375c]/55">{(item.file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <select
                          value={item.model}
                          onChange={(e) => {
                            const updated = [...files]
                            updated[idx].model = e.target.value
                            setFiles(updated)
                          }}
                          className="rounded-lg border border-[#10375c]/15 bg-white px-2 py-1.5 text-xs text-[#10375c] shadow-sm focus:outline-none focus:ring-1 focus:ring-[#10375c]/30"
                        >
                          <option value="Auto-detect">Auto-detect model</option>
                          {models.map(m => (
                            <option key={m.name} value={m.name}>{m.name}</option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => {
                            setFiles((prev) => prev.filter((_, i) => i !== idx))
                          }}
                          className="rounded-lg p-1.5 text-[#10375c]/55 hover:bg-red-50 hover:text-red-500 transition cursor-pointer"
                          title="Remove file"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card className="border border-white/70 lg:col-span-2">
          <CardHeader>
            <CardTitle>Audit metadata</CardTitle>
            <CardDescription>Captured on PDF exports and API payloads.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* ── Files count in queue ─────────────────────────────── */}
            <div className="space-y-2">
              <Label>Files in Queue</Label>
              <div className="flex items-center justify-between rounded-xl border border-[#10375c]/15 bg-[#f4f6ff]/40 px-3 py-2 text-sm text-[#10375c] shadow-sm">
                <span className="font-semibold">Total files to process</span>
                <span className="rounded-full bg-[#10375c] px-2.5 py-0.5 text-xs font-bold text-white">
                  {files.length} {files.length === 1 ? 'file' : 'files'}
                </span>
              </div>
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
