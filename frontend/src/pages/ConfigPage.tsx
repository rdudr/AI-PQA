import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, Upload, ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useNotifications } from '@/contexts/NotificationContext'
import { inspectFile, fetchMappings, saveMappings, fetchCustomColumns, saveCustomColumns } from '@/services/configApi'
import { Loading3D } from '@/components/Loading3D'
import type { InspectResponse } from '@/types/config'

// Generate harmonic parameters: zero-padded odd orders 01,03,05..25 (13 orders).
// Odd-only matches every analyzer we currently support (Hioki, ALM-45, Schneider,
// Fluke, Dranetz, Elspec) — they all report only odd harmonics for power
// systems, since even orders are typically negligible in symmetric three-phase.
const generateHarmonics = (phase: string) =>
  [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25].map(
    n => `${phase}_%FH${String(n).padStart(2, '0')}`,
  )

const STANDARD_COLS = [
  'timestamp',
  'date',
  'time',
  'voltage_phase_a', 'voltage_phase_b', 'voltage_phase_c',
  'current_phase_a', 'current_phase_b', 'current_phase_c',
  'kw', 'kva', 'kvar', 'pf', 'frequency',
  'vthd_a', 'vthd_b', 'vthd_c',
  'ithd_a', 'ithd_b', 'ithd_c',
  'nkvar', 'dkvar', 'dpf',
  // Voltage harmonics — per-phase line-to-line (U12, U23, U31)
  ...generateHarmonics('U12'),
  ...generateHarmonics('U23'),
  ...generateHarmonics('U31'),
  // Current harmonics — per-phase (A1, A2, A3)
  ...generateHarmonics('A1'),
  ...generateHarmonics('A2'),
  ...generateHarmonics('A3'),
  // Voltage RMS min/max
  'Urms12_min', 'Urms12_max',
  'Urms23_min', 'Urms23_max',
  'Urms31_min', 'Urms31_max',
  // Current RMS min/max
  'Arms1_min', 'Arms1_max',
  'Arms2_min', 'Arms2_max',
  'Arms3_min', 'Arms3_max',
]
// Total: 23 base + (13 × 3 = 39 voltage harmonics) + (13 × 3 = 39 current harmonics) + 12 RMS = 113

// O(1) membership lookup — replaces repeated O(n) STANDARD_COLS.includes() calls
// that ran once per row × per assignment on every re-render.
const STANDARD_COLS_SET = new Set(STANDARD_COLS)

// Extract the standard-column string from a mapping value. Handles both plain-string
// assignments AND object-type {standard_column, source_page} assignments from
// multi-sheet XLSX configs. String(objectValue) = "[object Object]" was never found
// in STANDARD_COLS, so mixing the two silently broke the exclusion logic.
const extractStd = (v: unknown): string => {
  if (!v) return ''
  if (typeof v === 'object' && v !== null) {
    return (v as { standard_column?: string }).standard_column ?? ''
  }
  return String(v)
}


export function ConfigPage() {
  const { modelName } = useParams<{ modelName: string }>()
  const navigate = useNavigate()
  const { push } = useNotifications()

  const [result, setResult] = useState<InspectResponse | null>(null)
  const [assignments, setAssignments] = useState<Record<string, string | { standard_column: string; source_page?: string | null }>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [columnSourcePages, setColumnSourcePages] = useState<Record<string, string>>({})  // raw_name -> source_page
  const [inspecting, setInspecting] = useState(false)
  const [loading, setLoading] = useState(false)

  // Custom column mapping
  const [customColName, setCustomColName] = useState('')
  const [customColSheet, setCustomColSheet] = useState('')
  const [customColMapTo, setCustomColMapTo] = useState('')
  const [customColumns, setCustomColumns] = useState<Array<{ name: string; sheet: string; mapTo: string }>>([])

  // Show left to assign list
  const [showLeftToAssign, setShowLeftToAssign] = useState(false)
  // Reveal the list of mapped standard-target names
  const [showMappedNames, setShowMappedNames] = useState(false)

  // Load existing mappings + custom columns on mount — each call degrades gracefully
  useEffect(() => {
    if (!modelName) return
    Promise.all([
      fetchMappings(modelName).catch(() => ({ model: modelName, mappings: {} })),
      fetchCustomColumns(modelName).catch(() => []),
    ]).then(([mappingsData, customCols]) => {
      const base: Record<string, string | { standard_column: string; source_page?: string | null }> =
        Object.keys(mappingsData.mappings).length > 0 ? mappingsData.mappings : {}
      setAssignments(base)

      // Restore saved source page selections from loaded mappings
      const restoredSourcePages: Record<string, string> = {}
      Object.entries(base).forEach(([colName, mapping]) => {
        if (typeof mapping === 'object' && mapping !== null && (mapping as any).source_page) {
          restoredSourcePages[colName] = (mapping as any).source_page
        }
      })
      if (Object.keys(restoredSourcePages).length > 0) {
        setColumnSourcePages(restoredSourcePages)
      }

      if (customCols.length > 0) setCustomColumns(customCols)
    })
  }, [modelName])

  const handleFile = useCallback(async (file: File) => {
    if (!modelName) return
    setInspecting(true)
    try {
      // inspectFile is the critical call — run it first so a clear error is shown if backend is down
      const data = await inspectFile(modelName, file)
      setResult(data)

      // Load saved mappings and custom columns — non-fatal, degrade gracefully if backend is restarting
      const [savedMappings, savedCustomCols] = await Promise.all([
        fetchMappings(modelName).catch(() => ({ model: modelName, mappings: {} })),
        fetchCustomColumns(modelName).catch(() => []),
      ])

      const savedBase: Record<string, string | { standard_column: string; source_page?: string | null }> =
        savedMappings.mappings || {}

      // Merge saved mappings with auto-detected matches from the inspector.
      // Priority: saved > auto.  This means:
      //  • Columns already saved keep their assignment.
      //  • New columns that the inspector auto-detected get pre-filled so the
      //    user doesn't see a blank "NA" for every known column on first open.
      const merged: typeof savedBase = { ...savedBase }
      for (const col of data.columns) {
        if (merged[col.raw_name] !== undefined) continue   // saved takes priority
        // Default to NA for auto-detected columns on first load to let the user select everything
      }

      setAssignments(merged)
      setCustomColumns(savedCustomCols)

      // Restore saved source page selections from loaded mappings
      const restoredSourcePages: Record<string, string> = {}
      Object.entries(merged).forEach(([colName, mapping]) => {
        if (typeof mapping === 'object' && mapping !== null && (mapping as any).source_page) {
          restoredSourcePages[colName] = (mapping as any).source_page
        }
      })
      if (Object.keys(restoredSourcePages).length > 0) {
        setColumnSourcePages(restoredSourcePages)
      }

      if (data.unmatched_count > 0) {
        push('warning', 'Unmatched columns', `${data.unmatched_count} column(s) in "${file.name}" could not be auto-detected. Assign them below.`)
      } else {
        push('success', 'All columns matched', `All ${data.total_columns} columns in "${file.name}" were auto-detected.`)
      }
    } catch (e) {
      const msg = String(e)
      const isNetworkError = msg.includes('Failed to fetch') || msg.includes('NetworkError')
      push(
        'error',
        'Inspect failed',
        isNetworkError
          ? 'Cannot reach the backend. Make sure the backend server is running on port 8000.'
          : msg
      )
    } finally {
      setInspecting(false)
    }
  }, [modelName, push])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleAddCustomColumn = () => {
    if (!customColName.trim() || !customColSheet.trim() || !customColMapTo.trim()) {
      push('warning', 'Required fields', 'Please fill in all fields: Column name, Sheet, and Maps to.')
      return
    }
    // Custom columns are tracked independently — never touch the main assignments state
    // so the main table entry for the same column name is not affected
    setCustomColumns(prev => [...prev, { name: customColName, sheet: customColSheet, mapTo: customColMapTo }])
    // Reset form
    setCustomColName('')
    setCustomColSheet('')
    setCustomColMapTo('')
    push('success', 'Custom column added', `"${customColName}" mapped to "${customColMapTo}" from sheet "${customColSheet}".`)
  }

  const handleRemoveCustomColumn = (index: number) => {
    // Only remove from customColumns — never touch assignments
    setCustomColumns(prev => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!modelName) return
    setSaving(true)
    setLoading(true)
    try {
      // Build mappings with source pages — extract string from object assignments correctly
      const mappingsWithPages: Record<string, string | { standard_column: string; source_page?: string | null }> = {}
      Object.entries(assignments).forEach(([colName, mapping]) => {
        if (!mapping) return

        // Extract the actual standard column string (mapping may already be an object if loaded from backend)
        const standardCol = typeof mapping === 'object' && mapping !== null
          ? (mapping as { standard_column: string }).standard_column
          : String(mapping)
        if (!standardCol) return

        // Source page: prefer explicit user selection, fall back to what was loaded from backend
        const sourcePage = columnSourcePages[colName]
          ?? (typeof mapping === 'object' && mapping !== null ? (mapping as any).source_page : null)

        if (sourcePage && sourcePage !== 'NA') {
          mappingsWithPages[colName] = { standard_column: standardCol, source_page: sourcePage }
        } else {
          mappingsWithPages[colName] = standardCol
        }
      })

      // Save mappings and custom columns in parallel
      await Promise.all([
        saveMappings(modelName, mappingsWithPages),
        saveCustomColumns(modelName, customColumns),
      ])
      setSaved(true)
      push('success', 'Configuration saved', `Column mappings for "${modelName}" saved successfully.`)
      setTimeout(() => navigate('/upload'), 1200)
    } catch (e) {
      push('error', 'Save failed', String(e))
    } finally {
      setSaving(false)
      setLoading(false)
    }
  }

  // Count how many times each standard column is used across ALL assignments.
  // Computed once per assignments change (O(rows)) instead of rebuilding a
  // per-row "used by others" set inside every dropdown (O(rows²)).
  const assignmentCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const mapped of Object.values(assignments)) {
      const std = extractStd(mapped)
      if (std && std !== 'NA' && STANDARD_COLS_SET.has(std)) {
        counts[std] = (counts[std] ?? 0) + 1
      }
    }
    return counts
  }, [assignments])

  if (!modelName) return null

  // Show loading while inspecting file or saving
  if (inspecting || loading) {
    return <Loading3D
      fullScreen
      message={inspecting ? 'Analyzing file structure...' : 'Saving configuration...'}
    />
  }

  // Normalized assignments: extract the standard_column string from each value
  // (assignments may contain either plain strings or {standard_column, source_page} objects)
  const normAssignments: Record<string, string> = {}
  Object.entries(assignments).forEach(([k, v]) => {
    if (!v) return
    const s = typeof v === 'object' ? ((v as { standard_column?: string }).standard_column ?? '') : String(v)
    if (s) normAssignments[k] = s
  })

  // Pre-computed counts used by the Mapping Summary section
  const mainAssignedCount = Object.keys(normAssignments).length
  const mainDataCount = Object.values(normAssignments).filter(v => v !== 'NA').length
  const mainNaCount = Object.values(normAssignments).filter(v => v === 'NA').length
  const customDataCount = customColumns.filter(c => c.mapTo && c.mapTo !== 'NA').length
  const customNaCount = customColumns.filter(c => c.mapTo === 'NA').length
  const totalDataCols = mainDataCount + customDataCount
  const totalNaCols = mainNaCount + customNaCount
  const totalOutputCols = totalDataCols + totalNaCols
  const totalMapped = mainAssignedCount + customColumns.length

  // Calculate assignment stats
  const assignmentStats = result
    ? {
        total: result.total_columns,
        assigned: mainAssignedCount,
        unmatched: result.unmatched_count,
      }
    : null
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs uppercase tracking-widest text-[#10375c]/50">PQ Model Configuration</p>
        <h1 className="mt-1 text-3xl font-semibold text-[#10375c]">{modelName}</h1>
        <p className="mt-1 text-sm text-[#10375c]/60">
          Upload a sample file from this analyzer. The system will detect all column names and auto-suggest mappings.
          Assign any unmatched columns and click Save.
        </p>
      </motion.div>


      {/* Assignment Statistics Box - Sticky.
          Counts are based on STANDARD targets (the dictionary of column names
          the system understands).  "Mapped" = distinct targets you've used,
          "Left" = standard targets you haven't used yet (drop-down lists them). */}
      {result && (() => {
        // Distinct standardized targets used by any mapping (main + custom)
        const mappedStdSet = new Set<string>()
        result.columns.forEach((col) => {
          const v = normAssignments[col.raw_name]
          if (v && v !== 'NA') mappedStdSet.add(v)
        })
        customColumns.forEach((col) => {
          if (col.mapTo && col.mapTo !== 'NA') mappedStdSet.add(col.mapTo)
        })
        const mappedNames = Array.from(mappedStdSet).sort()
        const unusedStdCols = STANDARD_COLS.filter(c => !mappedStdSet.has(c))
        const totalStd = STANDARD_COLS.length
        const mappedCount = mappedStdSet.size
        const leftCount = unusedStdCols.length
        const percent = totalStd ? Math.round((mappedCount / totalStd) * 100) : 0

        return (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-20 z-30 rounded-xl border border-[#10375c]/15 bg-gradient-to-r from-[#10375c]/5 to-[#2d7db5]/5 p-4 backdrop-blur-sm w-full"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1 — Total Mapped: distinct standardized targets you've used.
                  Click to reveal the list of mapped target names. */}
            <div className="flex flex-col">
              <span
                className="text-xs font-medium text-[#10375c]/60 uppercase tracking-wide flex items-center gap-2 cursor-pointer hover:text-[#10375c]"
                onClick={() => setShowMappedNames(!showMappedNames)}
              >
                Total Mapped
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${showMappedNames ? 'rotate-180' : ''}`}
                />
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-600">{mappedCount}</span>
                <span className="text-xs text-[#10375c]/50">of {totalStd} standard</span>
              </div>

              {showMappedNames && (
                <div className="mt-3 pt-3 border-t border-[#10375c]/10 max-h-48 overflow-y-auto">
                  <p className="text-[10px] uppercase tracking-wide text-[#10375c]/45 mb-1">
                    Mapped target names ({mappedNames.length})
                  </p>
                  <div className="space-y-1">
                    {mappedNames.map((col) => (
                      <div
                        key={col}
                        className="text-xs px-2 py-1.5 rounded bg-emerald-50 text-emerald-900 transition"
                      >
                        <span className="font-medium">{col}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2 — Left Mapped: standardized targets you haven't used yet.
                  Click to reveal the list of remaining target names. */}
            <div className="flex flex-col">
              <span
                className="text-xs font-medium text-[#10375c]/60 uppercase tracking-wide flex items-center gap-2 cursor-pointer hover:text-[#10375c]"
                onClick={() => setShowLeftToAssign(!showLeftToAssign)}
              >
                Left Mapped
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${showLeftToAssign ? 'rotate-180' : ''}`}
                />
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className={`text-2xl font-bold ${leftCount === 0 ? 'text-[#10375c]/40' : 'text-orange-600'}`}>
                  {leftCount}
                </span>
                <span className="text-xs text-[#10375c]/50">available to map</span>
              </div>

              {showLeftToAssign && (
                <div className="mt-3 pt-3 border-t border-[#10375c]/10 max-h-48 overflow-y-auto">
                  <p className="text-[10px] uppercase tracking-wide text-[#10375c]/45 mb-1">
                    Standard targets not used ({unusedStdCols.length})
                  </p>
                  <div className="space-y-1">
                    {unusedStdCols.map((col) => (
                      <div
                        key={col}
                        className="text-xs px-2 py-1.5 rounded bg-[#10375c]/5 hover:bg-[#10375c]/10 text-[#10375c] transition"
                      >
                        <span className="font-medium">{col}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3 — Progress: percentage of standard dictionary used */}
            <div className="flex flex-col">
              <span className="text-xs font-medium text-[#10375c]/60 uppercase tracking-wide">Progress</span>
              <div className="mt-1 w-full bg-[#10375c]/10 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-full transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="mt-1 text-xs text-[#10375c]/60">
                {percent}% mapped ({mappedCount}/{totalStd})
              </span>
            </div>
          </div>
        </motion.div>
        )
      })()}

      {/* Drop zone - Only show if no file uploaded yet */}
      {!result && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 transition ${
            dragging ? 'border-[#10375c] bg-[#f4f6ff]' : 'border-[#10375c]/20 bg-white/60'
          }`}
        >
          <Upload className="size-8 text-[#10375c]/40" />
          <p className="text-sm text-[#10375c]/60">Drag &amp; drop a sample CSV, Excel, or XLSM/XLSB file here</p>
          <label className="cursor-pointer rounded-xl bg-[#10375c] px-4 py-2 text-sm font-medium text-white hover:bg-[#10375c]/90">
            Browse file
            <input
              type="file"
              accept=".csv,.xls,.xlsx,.xlsm,.xlsb,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12,application/vnd.ms-excel.sheet.binary.macroEnabled.12"
              className="hidden"
              onChange={onInputChange}
            />
          </label>
        </div>
      )}

      {/* Mapping table */}
      {result && (
        <Card className="no-hover border border-white/70">
          <CardHeader>
            <CardTitle>Column Mapping — {result.filename}</CardTitle>
            <CardDescription>
              <span>
                {result.total_columns} columns found · {result.unmatched_count} unmatched
                {result.unmatched_count > 0 && (
                  <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                    Action required
                  </span>
                )}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#10375c]/08 text-xs uppercase tracking-wide text-[#10375c]/50">
                    <th className="pb-2 text-left font-medium">Column in file</th>
                    <th className="pb-2 text-left font-medium">Sheet / page</th>
                    <th className="pb-2 text-left font-medium">Sample values</th>
                    <th className="pb-2 text-left font-medium">Maps to</th>
                    <th className="pb-2 text-left font-medium">Source Page</th>
                    <th className="pb-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.columns.map((col) => (
                    <tr key={col.raw_name} data-column={col.raw_name} className="border-b border-[#10375c]/05 last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs text-[#10375c]">{col.raw_name}</td>
                      <td className="py-2 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {col.sheets.map((s) => (
                            <span key={s} className="rounded-full bg-[#10375c]/08 px-1.5 py-0.5 text-[10px] text-[#10375c]/55">{s}</span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-xs text-[#10375c]/50">
                        {col.sample_values.join(', ')}
                      </td>
                      <td className="py-2 pr-4">
                        {(() => {
                          const rawVal = assignments[col.raw_name]
                          const selectVal = extractStd(rawVal) || 'NA'

                          // Available = standard cols not used by any OTHER row.
                          // assignmentCounts includes this row, but it only counts
                          // selectVal for this row — so for any c !== selectVal the
                          // count reflects only other rows. Always keep selectVal so a
                          // valid (even conflicting) assignment never shows blank.
                          const availableCols = STANDARD_COLS.filter(
                            (c) => c === selectVal || (assignmentCounts[c] ?? 0) === 0,
                          )

                          return (
                            <select
                              value={selectVal}
                              onChange={(e) =>
                                setAssignments((prev) => ({ ...prev, [col.raw_name]: e.target.value }))
                              }
                              className="w-44 rounded-lg border border-[#10375c]/15 bg-white px-2 py-1 text-xs text-[#10375c] focus:outline-none focus:ring-1 focus:ring-[#10375c]/30"
                            >
                              <option value="NA">NA (skip)</option>
                              {availableCols.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          )
                        })()}
                      </td>
                      <td className="py-2 pr-4">
                        {(() => {
                          // Get sheets where this column exists
                          const availableSheets = col.sheets
                          const sourcePage = columnSourcePages[col.raw_name] ?? (availableSheets.length === 1 ? availableSheets[0] : '')

                          // If only one sheet available, show as text (auto-selected)
                          if (availableSheets.length === 1) {
                            return (
                              <span className="text-xs text-[#10375c] font-medium">
                                {availableSheets[0]}
                              </span>
                            )
                          }

                          // If multiple sheets, show dropdown
                          return (
                            <select
                              value={sourcePage}
                              onChange={(e) =>
                                setColumnSourcePages((prev) => ({ ...prev, [col.raw_name]: e.target.value }))
                              }
                              className="w-40 rounded-lg border border-[#10375c]/15 bg-white px-2 py-1 text-xs text-[#10375c] focus:outline-none focus:ring-1 focus:ring-[#10375c]/30"
                            >
                              <option value="">— select page —</option>
                              {availableSheets.map((sheet) => (
                                <option key={sheet} value={sheet}>{sheet}</option>
                              ))}
                            </select>
                          )
                        })()}
                      </td>
                      <td className="py-2">
                        {(() => {
                          const val = assignments[col.raw_name]
                          const isRealAssignment = val && val !== '' && val !== 'NA' && String(val) !== 'NA'

                          let statusColor: string
                          let statusLabel: string
                          if (isRealAssignment) {
                            statusColor = 'bg-emerald-100 text-emerald-700'
                            statusLabel = 'assigned'
                          } else {
                            statusColor = 'bg-orange-100 text-orange-700'
                            statusLabel = 'not yet assign'
                          }

                          return (
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}>
                              {statusLabel}
                            </span>
                          )
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Custom Column Mapping Section */}
            <div className="mt-8 border-t border-[#10375c]/10 pt-6 space-y-4">
              <h3 className="text-sm font-semibold text-[#10375c]">Custom Column Mapping</h3>
              <p className="text-xs text-[#10375c]/60">
                Add custom columns that aren't in the standard list. Specify the column name from your file, which sheet it comes from, and what to map it to.
              </p>

              {/* Custom Column Input */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#10375c]/70 mb-1.5">Column name in file</label>
                  <select
                    value={customColName}
                    onChange={(e) => {
                      setCustomColName(e.target.value)
                      setCustomColSheet('') // Reset sheet selection when column changes
                    }}
                    className="w-full rounded-lg border border-[#10375c]/15 bg-white px-3 py-2 text-xs text-[#10375c] focus:outline-none focus:ring-1 focus:ring-[#10375c]/30"
                  >
                    <option value="">— select column —</option>
                    {result?.columns.map((col) => (
                      <option key={col.raw_name} value={col.raw_name}>{col.raw_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#10375c]/70 mb-1.5">Source sheet</label>
                  <select
                    value={customColSheet}
                    onChange={(e) => setCustomColSheet(e.target.value)}
                    className="w-full rounded-lg border border-[#10375c]/15 bg-white px-3 py-2 text-xs text-[#10375c] focus:outline-none focus:ring-1 focus:ring-[#10375c]/30"
                    disabled={!customColName}
                  >
                    <option value="">— select sheet —</option>
                    {customColName && result?.columns.find((col) => col.raw_name === customColName)?.sheets.map((sheet) => (
                      <option key={sheet} value={sheet}>{sheet}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#10375c]/70 mb-1.5">Maps to</label>
                  {(() => {
                    // Get all assigned standard columns (from both main table and custom columns)
                    const assignedCols = new Set(
                      Object.entries(assignments)
                        .filter(([, mapped]) => mapped && mapped !== '' && mapped !== 'NA' && STANDARD_COLS.includes(String(mapped)))
                        .map(([, mapped]) => mapped)
                    )

                    // Also exclude custom columns that are already added
                    customColumns.forEach((customCol) => {
                      if (customCol.mapTo && customCol.mapTo !== 'NA') {
                        assignedCols.add(customCol.mapTo)
                      }
                    })

                    // Get available columns
                    const availableCols = STANDARD_COLS.filter((c) => !assignedCols.has(c))

                    return (
                      <select
                        value={customColMapTo}
                        onChange={(e) => setCustomColMapTo(e.target.value)}
                        className="w-full rounded-lg border border-[#10375c]/15 bg-white px-3 py-2 text-xs text-[#10375c] focus:outline-none focus:ring-1 focus:ring-[#10375c]/30"
                      >
                        <option value="">— select standard column —</option>
                        <option value="NA">NA (not available)</option>
                        {availableCols.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    )
                  })()}
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleAddCustomColumn}
                    variant="secondary"
                    className="w-full"
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Custom Columns List */}
              {customColumns.length > 0 && (
                <div className="overflow-x-auto bg-[#10375c]/02 rounded-lg border border-[#10375c]/10 p-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[#10375c]/50 uppercase tracking-wide">
                        <th className="pb-2 text-left font-medium">Column Name</th>
                        <th className="pb-2 text-left font-medium">Sheet</th>
                        <th className="pb-2 text-left font-medium">Maps To</th>
                        <th className="pb-2 text-left font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customColumns.map((col, index) => (
                        <tr key={index} className="border-t border-[#10375c]/05 last:border-0">
                          <td className="py-2 pr-4 font-mono text-[#10375c]">{col.name}</td>
                          <td className="py-2 pr-4 text-[#10375c]/70">{col.sheet}</td>
                          <td className="py-2 pr-4 font-semibold text-[#10375c]">{col.mapTo}</td>
                          <td className="py-2">
                            <button
                              onClick={() => handleRemoveCustomColumn(index)}
                              className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded transition"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Mapping Summary Section */}
            {result && assignmentStats && assignmentStats.assigned > 0 && (
              <div className="mt-8 border-t border-[#10375c]/10 pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#10375c]">📊 Mapping Summary - All {totalMapped} Mapped Columns</h3>
                </div>

                {/* Mapping Details Table - ALL COLUMNS */}
                <div className="overflow-x-auto bg-[#10375c]/02 rounded-lg border border-[#10375c]/10 p-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#10375c]/10 text-[#10375c]/60 uppercase tracking-wide bg-[#10375c]/05">
                        <th className="pb-3 px-3 text-left font-medium">File Column</th>
                        <th className="pb-3 px-3 text-left font-medium">Sheet</th>
                        <th className="pb-3 px-3 text-left font-medium">→ Maps To (Standard)</th>
                        <th className="pb-3 px-3 text-left font-medium">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        // Get all mapped columns (from both main table and custom columns)
                        const mappedFromMain = result.columns
                          .filter((col) => !!normAssignments[col.raw_name])
                          .map((col) => ({
                            fileColumn: col.raw_name,
                            sheet: col.sheets.join(', '),
                            mapsTo: normAssignments[col.raw_name],
                            type: normAssignments[col.raw_name] === 'NA' ? 'Marker' : 'Data',
                          }))

                        // Add custom columns
                        const mappedCustom = customColumns.map((col) => ({
                          fileColumn: col.name,
                          sheet: col.sheet,
                          mapsTo: col.mapTo,
                          type: col.mapTo === 'NA' ? 'Marker' : 'Data',
                        }))

                        const allMapped = [...mappedFromMain, ...mappedCustom]

                        return allMapped.map((mapping, index) => (
                          <tr key={`${mapping.fileColumn}-${index}`} className="border-b border-[#10375c]/05 last:border-0">
                            <td className="py-2.5 px-3 font-mono text-[#10375c] font-medium">{mapping.fileColumn}</td>
                            <td className="py-2.5 px-3 text-[#10375c]/70">{mapping.sheet}</td>
                            <td className="py-2.5 px-3 font-semibold text-emerald-600">→ {mapping.mapsTo}</td>
                            <td className="py-2.5 px-3">
                              <span className={`inline-block px-2 py-1 rounded text-[10px] font-medium ${
                                mapping.type === 'Marker'
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                {mapping.type}
                              </span>
                            </td>
                          </tr>
                        ))
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Mapping Summary Info */}
                <div className="text-xs text-[#10375c]/60 bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                  <p><strong>Total mapped:</strong> {totalMapped} columns</p>
                  <p><strong>Data columns:</strong> {totalDataCols} (with measurement values)</p>
                  <p><strong>NA/Marker columns:</strong> {totalNaCols} (metadata/tracking)</p>
                </div>

                {/* Summary Stats - Enhanced */}
                <div className="mt-6 bg-gradient-to-r from-emerald-500/15 to-blue-500/15 rounded-lg p-6 border border-emerald-300/30">
                  <h4 className="text-sm font-semibold text-[#10375c] mb-4">📥 Excel Output Summary</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-[#10375c]/70 uppercase tracking-wide">Data Columns</span>
                      <span className="mt-2 text-2xl font-bold text-emerald-600">{totalDataCols}</span>
                      <span className="text-xs text-[#10375c]/50">measurement columns</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-[#10375c]/70 uppercase tracking-wide">NA Columns</span>
                      <span className="mt-2 text-2xl font-bold text-orange-600">{totalNaCols}</span>
                      <span className="text-xs text-[#10375c]/50">metadata/markers</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-[#10375c]/70 uppercase tracking-wide">Total Output</span>
                      <span className="mt-2 text-2xl font-bold text-blue-600">{totalOutputCols}</span>
                      <span className="text-xs text-[#10375c]/50">total columns</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-[#10375c]/70 uppercase tracking-wide">Excluded</span>
                      <span className="mt-2 text-2xl font-bold text-red-600">
                        {result?.total_columns ? Math.max(0, result.total_columns - totalMapped) : 0}
                      </span>
                      <span className="text-xs text-[#10375c]/50">auto-excluded</span>
                    </div>
                  </div>
                  <div className="mt-4 text-xs text-[#10375c]/60 border-t border-emerald-300/20 pt-3">
                    ✅ Your normalized Excel will have <strong>{totalOutputCols}</strong> columns with all your data ready for analysis!
                  </div>
                </div>

                {/* Old Grid Stats (hidden but kept for compatibility) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 rounded-lg p-4 hidden">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-[#10375c]/60">Columns in Output</span>
                    <span className="mt-1 text-lg font-bold text-emerald-600">{totalDataCols}</span>
                    <span className="text-xs text-[#10375c]/50">with real data</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-[#10375c]/60">NA Columns</span>
                    <span className="mt-1 text-lg font-bold text-orange-600">{totalNaCols}</span>
                    <span className="text-xs text-[#10375c]/50">markers/flags</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-[#10375c]/60">Skipped</span>
                    <span className="mt-1 text-lg font-bold text-[#10375c]/40">
                      {result.total_columns - mainAssignedCount}
                    </span>
                    <span className="text-xs text-[#10375c]/50">columns</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-[#10375c]/60">Output Rows</span>
                    <span className="mt-1 text-lg font-bold text-[#10375c]">
                      {result.columns[0]?.sample_values ? 'Auto' : 'TBD'}
                    </span>
                    <span className="text-xs text-[#10375c]/50">from file</span>
                  </div>
                </div>

              </div>
            )}

            <div className="mt-6 flex gap-3">
              <Button
                onClick={handleSave}
                disabled={saving || saved}
                variant="accent"
                className="gap-2"
              >
                {saved
                  ? <><CheckCircle className="size-4" /> Saved — redirecting…</>
                  : saving ? 'Saving…' : 'Save configuration'}
              </Button>
              <Button variant="secondary" onClick={() => navigate('/upload')}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
