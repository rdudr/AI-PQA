import type { InspectResponse, MappingsResponse, PQModel } from '@/types/config'

import { API_BASE as BASE } from './apiBase'

export interface CustomColumn {
  name: string
  sheet: string
  mapTo: string
}

async function _json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const detail = body?.detail ?? res.statusText
    throw new Error(String(detail))
  }
  return res.json() as Promise<T>
}

export async function fetchModels(): Promise<PQModel[]> {
  return _json(await fetch(`${BASE}/api/config/models?_=${Date.now()}`))
}

export async function addModel(name: string): Promise<PQModel> {
  return _json(
    await fetch(`${BASE}/api/config/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }),
  )
}

export async function deleteModel(name: string): Promise<void> {
  await _json(await fetch(`${BASE}/api/config/models/${encodeURIComponent(name)}`, { method: 'DELETE' }))
}

export async function inspectFile(modelName: string, file: File): Promise<InspectResponse> {
  const body = new FormData()
  body.append('file', file)
  return _json(
    await fetch(`${BASE}/api/config/models/${encodeURIComponent(modelName)}/inspect`, {
      method: 'POST',
      body,
    }),
  )
}

export async function fetchMappings(modelName: string): Promise<MappingsResponse> {
  return _json(await fetch(`${BASE}/api/config/models/${encodeURIComponent(modelName)}/mappings`))
}

export async function saveMappings(modelName: string, mappings: Record<string, string | { standard_column: string; source_page?: string | null }>): Promise<void> {
  await _json(
    await fetch(`${BASE}/api/config/models/${encodeURIComponent(modelName)}/mappings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mappings }),
    }),
  )
}

export async function fetchCustomColumns(modelName: string): Promise<CustomColumn[]> {
  const res = await _json<{ model: string; columns: CustomColumn[] }>(
    await fetch(`${BASE}/api/config/models/${encodeURIComponent(modelName)}/custom-columns`)
  )
  return res.columns ?? []
}

export async function saveCustomColumns(modelName: string, columns: CustomColumn[]): Promise<void> {
  await _json(
    await fetch(`${BASE}/api/config/models/${encodeURIComponent(modelName)}/custom-columns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ columns }),
    }),
  )
}
