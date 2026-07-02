import type {
  AuditMetadata,
  ProcessResponse,
  TablePageResponse,
} from '@/types/pq'
import type {
  AllSummariesResponse,
  EventsResponse,
} from '@/types/pq'
import type { HistoryItem } from '@/utils/sessionDb'

import { API_BASE } from './apiBase'

export async function fetchTablePage(params: {
  sessionId: string
  page: number
  pageSize: number
  sort?: string
  order?: 'asc' | 'desc'
  q?: string
  columnFilters?: Record<string, string>
}): Promise<TablePageResponse> {
  const sp = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
  })
  if (params.sort) sp.set('sort', params.sort)
  if (params.order) sp.set('order', params.order)
  if (params.q?.trim()) sp.set('q', params.q.trim())
  if (params.columnFilters && Object.keys(params.columnFilters).length > 0) {
    sp.set('filters', JSON.stringify(params.columnFilters))
  }

  const r = await fetch(
    `${API_BASE}/api/upload/session/${encodeURIComponent(params.sessionId)}/table?${sp}`,
  )
  if (!r.ok) {
    const errBody = await r.json().catch(() => null)
    const detail =
      errBody && typeof errBody === 'object' && 'detail' in errBody
        ? String((errBody as { detail: unknown }).detail)
        : r.statusText
    throw new Error(detail || 'Could not load table page')
  }
  return r.json() as Promise<TablePageResponse>
}

export function tableExportUrl(
  sessionId: string,
  q?: string,
  columnFilters?: Record<string, string>,
): string {
  const sp = new URLSearchParams()
  if (q?.trim()) sp.set('q', q.trim())
  if (columnFilters && Object.keys(columnFilters).length > 0) {
    sp.set('filters', JSON.stringify(columnFilters))
  }
  const qs = sp.toString()
  return `${API_BASE}/api/upload/session/${encodeURIComponent(sessionId)}/export.csv${qs ? `?${qs}` : ''}`
}

export async function downloadNormalizedSessionExcel(sessionId: string): Promise<{ blob: Blob; filename: string }> {
  const r = await fetch(
    `${API_BASE}/api/upload/session/${encodeURIComponent(sessionId)}/normalized-excel`,
  )
  if (!r.ok) {
    const detail = await r.text().catch(() => '')
    throw new Error(detail || 'Could not download normalized Excel')
  }

  const contentDisposition = r.headers.get('content-disposition')
  let filename = `pq_normalized_${sessionId.slice(0, 8)}.xlsx`
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^"]+)"?/)
    if (match) filename = match[1]
  }

  return { blob: await r.blob(), filename }
}

export async function processUpload(
  files: { file: File; model: string }[],
  metadata: AuditMetadata,
  onProgress?: (pct: number) => void,
): Promise<ProcessResponse> {
  const body = new FormData()
  files.forEach(({ file }) => {
    body.append('files', file)
  })
  const modelsList = files.map(({ model }) => model)
  body.append('file_models', JSON.stringify(modelsList))
  body.append('metadata', JSON.stringify(metadata))

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/api/upload/process`)
    xhr.responseType = 'json'
    xhr.timeout = 600_000 // 10 minutes for large multi-file uploads

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as ProcessResponse)
      } else {
        const body = xhr.response as { detail?: unknown } | string | null
        let message = xhr.statusText || 'Upload failed'
        if (body && typeof body === 'object' && 'detail' in body) {
          const d = body.detail
          if (Array.isArray(d))
            message = d.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join('; ')
          else if (typeof d === 'string') message = d
        }
        reject(new Error(message))
      }
    }
    xhr.ontimeout = () => reject(new Error('Upload timed out. Try fewer files or smaller files.'))
    xhr.onerror = () => reject(new Error('Network error: Ensure backend is running'))
    xhr.send(body)
  })
}

export function healthCheck(): Promise<{ status: string }> {
  return fetch(`${API_BASE}/api/health`).then((r) => r.json())
}

export async function fetchEvents(
  sessionId: string,
  limit: number = 100,
  severity?: string,
): Promise<EventsResponse> {
  const sp = new URLSearchParams({
    limit: String(limit),
  })
  if (severity) sp.set('severity', severity)

  const r = await fetch(
    `${API_BASE}/api/session/${encodeURIComponent(sessionId)}/events?${sp}`,
  )
  if (!r.ok) {
    throw new Error('Failed to fetch events')
  }
  return r.json() as Promise<EventsResponse>
}

export async function fetchSummaries(sessionId: string): Promise<AllSummariesResponse> {
  const r = await fetch(
    `${API_BASE}/api/session/${encodeURIComponent(sessionId)}/summaries`,
  )
  if (!r.ok) {
    throw new Error('Failed to fetch summaries')
  }
  return r.json() as Promise<AllSummariesResponse>
}

// ── Central history (server-persisted; empty when backend has no DATABASE_URL) ──

export async function fetchHistory(): Promise<HistoryItem[]> {
  const r = await fetch(`${API_BASE}/api/upload/history`)
  if (!r.ok) throw new Error('Could not load history')
  return r.json() as Promise<HistoryItem[]>
}

export async function fetchSessionFull(sessionId: string): Promise<ProcessResponse> {
  const r = await fetch(
    `${API_BASE}/api/upload/session/${encodeURIComponent(sessionId)}/full`,
  )
  if (!r.ok) throw new Error('Session not found in history')
  return r.json() as Promise<ProcessResponse>
}

export async function deleteSessionRemote(sessionId: string): Promise<void> {
  await fetch(`${API_BASE}/api/upload/session/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  })
}
