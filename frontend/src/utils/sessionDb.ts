import type { ProcessResponse } from '@/types/pq'

const DB_NAME = 'pq_analyzer_db'
// Bumped to v2 to create a second store ("history") alongside the existing
// "sessions" store.  Existing data in "sessions" is preserved.
const DB_VERSION = 2
const STORE_NAME = 'sessions'
const HISTORY_STORE = 'history'
const SESSION_KEY = 'current_session'

function getDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB database'))
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        // History store keyed by session_id so we can look up by ID later
        db.createObjectStore(HISTORY_STORE, { keyPath: 'session_id' })
      }
    }
  })
}

// ── Current session (latest upload) ──────────────────────────────────────

export async function saveSession(data: ProcessResponse): Promise<void> {
  const db = await getDb()
  // Also push to history so the History page can list it
  await pushHistory(data)
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(data, SESSION_KEY)

    request.onerror = () => {
      reject(new Error('Failed to save session data in IndexedDB'))
    }

    request.onsuccess = () => {
      resolve()
    }
  })
}

export async function loadSession(): Promise<ProcessResponse | null> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(SESSION_KEY)

    request.onerror = () => {
      reject(new Error('Failed to load session data from IndexedDB'))
    }

    request.onsuccess = () => {
      resolve(request.result || null)
    }
  })
}

export async function clearSession(): Promise<void> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(SESSION_KEY)

    request.onerror = () => {
      reject(new Error('Failed to clear session data from IndexedDB'))
    }

    request.onsuccess = () => {
      resolve()
    }
  })
}

// ── History store (all past sessions) ────────────────────────────────────

/** Append/replace a session in the history store. Keyed by session_id. */
export async function pushHistory(data: ProcessResponse): Promise<void> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readwrite')
    const store = tx.objectStore(HISTORY_STORE)
    // The store has keyPath: 'session_id' so we don't pass a key arg
    const req = store.put(data)
    req.onerror = () => reject(new Error('Failed to push to history'))
    req.onsuccess = () => resolve()
  })
}

/** Lightweight summary used by the History page list. */
export interface HistoryItem {
  session_id: string
  filename: string
  plant_name: string
  company_name: string
  analyzer: string
  audit_date: string
  total_rows: number
  quality_score: number
  // We don't ship the full PQRow[] in the summary — it's too heavy.
  // The History page calls loadFromHistory(id) to get the full payload.
}

export async function listHistory(): Promise<HistoryItem[]> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readonly')
    const store = tx.objectStore(HISTORY_STORE)
    const req = store.getAll()
    req.onerror = () => reject(new Error('Failed to list history'))
    req.onsuccess = () => {
      const rows = (req.result as ProcessResponse[]).map(r => ({
        session_id: r.session_id,
        filename: r.filename,
        plant_name: r.metadata?.plant_name ?? '',
        company_name: r.metadata?.company_name ?? '',
        analyzer: r.metadata?.pq_analyzer_type ?? '',
        audit_date: r.metadata?.audit_date ?? '',
        total_rows: r.total_rows,
        quality_score: r.data_quality?.quality_score ?? 0,
      } satisfies HistoryItem))
      // Newest first — assumes session_id is roughly chronological (uuid4 is not,
      // so fall back to audit_date when present).
      rows.sort((a, b) => (b.audit_date || '').localeCompare(a.audit_date || ''))
      resolve(rows)
    }
  })
}

export async function loadFromHistory(sessionId: string): Promise<ProcessResponse | null> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readonly')
    const store = tx.objectStore(HISTORY_STORE)
    const req = store.get(sessionId)
    req.onerror = () => reject(new Error('Failed to load from history'))
    req.onsuccess = () => resolve((req.result as ProcessResponse) ?? null)
  })
}

export async function deleteFromHistory(sessionId: string): Promise<void> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readwrite')
    const store = tx.objectStore(HISTORY_STORE)
    const req = store.delete(sessionId)
    req.onerror = () => reject(new Error('Failed to delete from history'))
    req.onsuccess = () => resolve()
  })
}

/** Set a specific historical session as the "current" one for the dashboard. */
export async function setCurrentFromHistory(sessionId: string): Promise<ProcessResponse | null> {
  const item = await loadFromHistory(sessionId)
  if (!item) return null
  const db = await getDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.put(item, SESSION_KEY)
    req.onerror = () => reject(new Error('Failed to set current'))
    req.onsuccess = () => resolve()
  })
  return item
}
