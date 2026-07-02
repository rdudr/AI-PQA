import { useCallback, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, FileSpreadsheet, RefreshCw, UploadCloud, X } from 'lucide-react'

import { cn } from '@/utils/cn'

type Props = {
  onFiles: (files: File[]) => void
  file?: File | null
  onClear?: () => void
  accept?: string
  disabled?: boolean
  error?: string | null
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileUploadZone({
  onFiles,
  file = null,
  onClear,
  // Include both extensions AND legacy MIME types so .xls files survive
  // every browser's file-picker validation (some browsers ignore the
  // .xls extension if no matching MIME is listed).
  accept = '.csv,.xls,.xlsx,.xlsm,.xlsb,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12,application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  disabled,
  error,
}: Props) {
  const [dragOver, setDragOver] = useState(false)

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (disabled) return
      const list = Array.from(e.dataTransfer.files ?? [])
      if (list.length) onFiles(list)
    },
    [disabled, onFiles],
  )

  const openPicker = useCallback(() => {
    document.getElementById('pq-file-input')?.click()
  }, [])

  const hint = useMemo(
    () => 'Drop CSV, XLS, XLSX, XLSM, or XLSB — modular parsers normalize vendor formats.',
    [],
  )

  const hasFile = Boolean(file)

  return (
    <div className="space-y-2">
      <div
        {...(!hasFile
          ? {
              role: 'button',
              tabIndex: 0,
              onClick: openPicker,
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  openPicker()
                }
              },
            }
          : {})}
        onDragEnter={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'glass-panel relative flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-14 text-center transition-colors',
          hasFile
            ? 'border-emerald-400/70 bg-emerald-50/70'
            : dragOver
              ? 'cursor-pointer border-[#f3c623] bg-[#fffdf3]'
              : 'cursor-pointer border-[#10375c]/18 hover:border-[#10375c]/35',
          disabled && 'pointer-events-none opacity-60',
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {hasFile && file ? (
            <motion.div
              key="ready"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 16 }}
                className="grid size-14 place-items-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
              >
                <CheckCircle2 className="size-8" strokeWidth={2.5} />
              </motion.div>

              <div>
                <p className="text-base font-semibold text-emerald-700">File ready to process</p>
                <div className="mt-1.5 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-white/70 px-3 py-1 text-sm font-medium text-[#10375c]">
                  <FileSpreadsheet className="size-4 text-emerald-600" />
                  <span className="max-w-[18rem] truncate">{file.name}</span>
                  <span className="text-[#10375c]/50">·</span>
                  <span className="tabular-nums text-[#10375c]/70">{formatSize(file.size)}</span>
                </div>
              </div>

              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={openPicker}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#10375c]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#10375c] shadow-sm transition hover:bg-[#f4f6ff] cursor-pointer"
                >
                  <RefreshCw className="size-3.5" /> Replace file
                </button>
                {onClear && (
                  <button
                    type="button"
                    onClick={onClear}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-xs font-semibold text-[#10375c]/60 transition hover:bg-red-50 hover:text-red-600 cursor-pointer"
                  >
                    <X className="size-3.5" /> Remove
                  </button>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="grid size-14 place-items-center rounded-2xl bg-[#10375c]/10 text-[#10375c]">
                <UploadCloud className="size-7" />
              </div>
              <div>
                <p className="text-base font-semibold text-[#10375c]">
                  Drag &amp; drop power quality export
                </p>
                <p className="mt-1 max-w-md text-sm text-[#10375c]/65">{hint}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <input
          id="pq-file-input"
          type="file"
          accept={accept}
          multiple
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const list = Array.from(e.target.files ?? [])
            if (list.length) onFiles(list)
            // Reset so selecting the same file again still fires onChange.
            e.target.value = ''
          }}
        />
      </div>
      {error ? (
        <p className="text-sm font-medium text-[#eb8317]">{error}</p>
      ) : null}
    </div>
  )
}
