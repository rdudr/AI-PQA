import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Download, Loader2 } from 'lucide-react'

import type { PQRow } from '@/types/pq'
import { SessionExpiredError, fetchTablePage, tableExportUrl } from '@/services/api'
import { buildDownloadName } from '@/utils/downloadName'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/useDebounce'

// Pretty header label for any standardized column name
const HEADER_LABELS: Record<string, string> = {
  timestamp: 'Timestamp',
  date: 'Date',
  time: 'Time',
  voltage_phase_a: 'Va',
  voltage_phase_b: 'Vb',
  voltage_phase_c: 'Vc',
  current_phase_a: 'Ia',
  current_phase_b: 'Ib',
  current_phase_c: 'Ic',
  kw: 'kW',
  kva: 'kVA',
  kvar: 'kVAR',
  pf: 'PF',
  frequency: 'Hz',
  vthd_a: 'VTHD A',
  vthd_b: 'VTHD B',
  vthd_c: 'VTHD C',
  ithd_a: 'ITHD A',
  ithd_b: 'ITHD B',
  ithd_c: 'ITHD C',
}

const labelFor = (col: string): string => HEADER_LABELS[col] ?? col

type Props = {
  sessionId: string
  companyName?: string
  auditDate?: string
  pqName?: string
  machineName?: string
  /** Rows cached in the browser from the original upload — used as a read-only
   *  fallback when the server no longer holds the session (e.g. after a restart
   *  without DATABASE_URL configured). */
  fallbackRows?: PQRow[]
  fallbackColumns?: string[]
  /** Total rows in the original dataset (may exceed fallbackRows.length). */
  fallbackTotal?: number
}

export function DataGrid({
  sessionId, companyName, auditDate, pqName, machineName,
  fallbackRows, fallbackColumns, fallbackTotal,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const debouncedFilter = useDebounce(globalFilter, 250)
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const debouncedColFilters = useDebounce(columnFilters, 300)

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  })

  const [rows, setRows] = useState<PQRow[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dataColumns, setDataColumns] = useState<string[]>([])
  // Server lost the session (restart without DATABASE_URL) — serve the
  // browser-cached preview rows instead of erroring out.
  const [serverGone, setServerGone] = useState(false)

  const activeColFilters = useMemo(() => {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(debouncedColFilters)) {
      if (v.trim()) out[k] = v.trim()
    }
    return Object.keys(out).length ? out : undefined
  }, [debouncedColFilters])

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }, [debouncedFilter, sorting, activeColFilters])

  const sortCol = sorting[0]?.id
  const sortOrder: 'asc' | 'desc' | undefined =
    sorting[0] === undefined ? undefined : sorting[0].desc ? 'desc' : 'asc'

  // Client-side equivalent of the server's search + per-column filters, used
  // only in the cached-preview fallback.
  const filterFallbackRows = useCallback((source: PQRow[]): PQRow[] => {
    let out = source
    const q = debouncedFilter.trim().toLowerCase()
    if (q) {
      out = out.filter((row) =>
        Object.values(row).some(
          (v) => v !== null && v !== undefined && String(v).toLowerCase().includes(q),
        ),
      )
    }
    if (activeColFilters) {
      for (const [col, val] of Object.entries(activeColFilters)) {
        const needle = val.toLowerCase()
        out = out.filter((row) => {
          const v = row[col]
          return v !== null && v !== undefined && String(v).toLowerCase().includes(needle)
        })
      }
    }
    return out
  }, [debouncedFilter, activeColFilters])

  const showFallback = useCallback(() => {
    const source = fallbackRows ?? []
    const filtered = filterFallbackRows(source)
    setServerGone(true)
    setRows(filtered)
    setTotal(filtered.length)
    setTotalPages(1)
    if (fallbackColumns && fallbackColumns.length > 0) {
      setDataColumns(fallbackColumns)
    } else if (source.length > 0) {
      setDataColumns(Object.keys(source[0]))
    }
  }, [fallbackRows, fallbackColumns, filterFallbackRows])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    if (serverGone) {
      // Already know the server lost the session — filter the cache locally.
      showFallback()
      setLoading(false)
      return
    }
    try {
      const res = await fetchTablePage({
        sessionId,
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
        sort: sortCol,
        order: sortOrder,
        q: debouncedFilter,
        columnFilters: activeColFilters,
      })
      setRows(res.rows)
      setTotal(res.total)
      setTotalPages(Math.max(1, res.total_pages))
      if (res.columns && res.columns.length > 0) {
        setDataColumns(res.columns)
      } else if (res.rows.length > 0) {
        // Derive columns from first row if backend didn't provide them
        setDataColumns(Object.keys(res.rows[0]))
      }
    } catch (e) {
      if (e instanceof SessionExpiredError && fallbackRows && fallbackRows.length > 0) {
        showFallback()
      } else {
        setError(e instanceof Error ? e.message : 'Load failed')
        setRows([])
      }
    } finally {
      setLoading(false)
    }
  }, [
    serverGone,
    showFallback,
    fallbackRows,
    sessionId,
    pagination.pageIndex,
    pagination.pageSize,
    debouncedFilter,
    activeColFilters,
    sortCol,
    sortOrder,
  ])

  useEffect(() => {
    void load()
  }, [load])

  // Dynamic columns — built from the actual normalized data
  const columns = useMemo<ColumnDef<PQRow>[]>(
    () =>
      dataColumns.map((col) => ({
        accessorKey: col,
        id: col,
        header: labelFor(col),
        size: col === 'timestamp' || col === 'date' || col === 'time' ? 180 : 110,
        cell: ({ getValue }) => {
          const v = getValue() as string | number | null | undefined
          if (v === null || v === undefined || v === '') return '—'
          return typeof v === 'number' ? v.toFixed(2) : String(v)
        },
      })),
    [dataColumns],
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    manualPagination: true,
    manualSorting: true,
    pageCount: totalPages,
    getCoreRowModel: getCoreRowModel(),
  })

  const tableRows = table.getRowModel().rows
  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 36,
    overscan: 8,
  })

  const exportHref = tableExportUrl(
    sessionId,
    debouncedFilter,
    activeColFilters,
  )

  const stickyClass =
    'sticky left-0 z-20 bg-white/95 backdrop-blur border-r border-[#10375c]/10 shadow-[4px_0_12px_-4px_rgba(16,55,92,0.12)]'

  return (
    <Card className="overflow-hidden border border-white/70">
      <CardHeader className="flex flex-col gap-4 border-b border-[#10375c]/10 bg-white/40 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Normalized PQ Data</CardTitle>
          <p className="text-sm text-[#10375c]/60">
            {dataColumns.length > 0
              ? `${dataColumns.length} mapped column${dataColumns.length === 1 ? '' : 's'} · same as the Normalized Excel export`
              : 'Same columns as the Normalized Excel export'}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Input
            placeholder="Search all columns…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="sm:w-64"
          />
          {serverGone ? (
            <Button
              variant="secondary"
              type="button"
              disabled
              title="Server-side export unavailable — re-upload the file to restore it"
            >
              <Download className="size-4" />
              Export CSV
            </Button>
          ) : (
            <Button variant="secondary" type="button" asChild>
              <a href={exportHref} download={buildDownloadName({
                company: companyName,
                pqName,
                machineName,
                dateInput: auditDate,
                ext: 'csv'
              })}>
                <Download className="size-4" />
                Export CSV
              </a>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {serverGone ? (
          <div className="border-b border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800">
            <span className="font-semibold">Showing cached preview.</span>{' '}
            The server no longer holds this session&apos;s full dataset (it likely
            restarted). Displaying the {(fallbackRows?.length ?? 0).toLocaleString()} rows
            saved in this browser
            {fallbackTotal && fallbackTotal > (fallbackRows?.length ?? 0)
              ? ` of ${fallbackTotal.toLocaleString()} total`
              : ''}. Re-upload the file to restore full paging, sorting and exports.
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#10375c]/10 bg-white/35 px-4 py-3 text-sm text-[#10375c]/70">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage() || loading}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage() || loading}
          >
            Next
          </Button>
          <span className="px-2">
            Page {pagination.pageIndex + 1} of {totalPages || 1}
          </span>
          <label className="flex items-center gap-2 text-[#10375c]/70">
            Rows
            <select
              className="rounded-lg border border-[#10375c]/15 bg-white/80 px-2 py-1 text-[#10375c]"
              value={pagination.pageSize}
              disabled={loading}
              onChange={(e) =>
                setPagination({
                  pageIndex: 0,
                  pageSize: Number(e.target.value),
                })
              }
            >
              {[25, 50, 100, 200, 500].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <span className="text-[#10375c]/50">{total} rows match</span>
          {loading ? (
            <span className="inline-flex items-center gap-1 text-[#10375c]/55">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </span>
          ) : null}
        </div>
        {error ? (
          <p className="px-4 py-3 text-sm font-medium text-[#eb8317]">{error}</p>
        ) : null}
        <div ref={scrollRef} className="max-h-[520px] overflow-auto">
          <table className="border-collapse text-left text-xs" style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
            <colgroup>
              {table.getVisibleFlatColumns().map((col) => (
                <col key={col.id} style={{ width: col.getSize() }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-30 bg-white/95 backdrop-blur">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header, colIdx) => (
                    <th
                      key={header.id}
                      className={`cursor-pointer select-none border-b border-[#10375c]/10 px-3 py-2 font-semibold text-[#10375c] whitespace-nowrap ${
                        colIdx === 0 ? stickyClass : 'bg-white/95'
                      }`}
                      style={{ width: header.getSize(), minWidth: header.getSize(), maxWidth: header.getSize() }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {{
                        asc: ' ↑',
                        desc: ' ↓',
                      }[header.column.getIsSorted() as string] ?? ''}
                    </th>
                  ))}
                </tr>
              ))}
              <tr className="border-b border-[#10375c]/10 bg-[#f4f6ff]/90">
                {table.getVisibleFlatColumns().map((col, colIdx) => {
                  const key = col.id
                  // Every column is filterable except pure text/date stamps where exact match is rare
                  const filterable = key !== 'timestamp'
                  return (
                    <th
                      key={`filter-${key}`}
                      className={`px-2 py-1 font-normal ${colIdx === 0 ? stickyClass : ''}`}
                    >
                      {filterable ? (
                        <input
                          className="w-full min-w-[72px] rounded-md border border-[#10375c]/12 bg-white/90 px-2 py-1 text-[10px] text-[#10375c]"
                          placeholder="Filter"
                          value={columnFilters[key] ?? ''}
                          onChange={(e) =>
                            setColumnFilters((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                        />
                      ) : null}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = tableRows[virtualRow.index]
                return (
                  <tr
                    key={row.id}
                    className="border-b border-[#10375c]/5 bg-white/40 hover:bg-[#f4f6ff]/80"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      transform: `translateY(${virtualRow.start}px)`,
                      height: '36px',
                    }}
                  >
                    {row.getVisibleCells().map((cell, colIdx) => (
                      <td
                        key={cell.id}
                        className={`px-3 py-2 text-[#10375c]/85 whitespace-nowrap overflow-hidden text-ellipsis ${
                          colIdx === 0 ? stickyClass : ''
                        }`}
                        style={{
                          width: cell.column.getSize(),
                          minWidth: cell.column.getSize(),
                          maxWidth: cell.column.getSize(),
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
