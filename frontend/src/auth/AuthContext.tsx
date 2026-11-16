import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { API_BASE } from '@/services/apiBase'
import type { Role, UserRecord } from './users'

// Sign-in with the KISEM team's one login, kept in FOX Console (console.eassiitgn.page). The
// Console checks the password (lockouts, per-person activity log) and gives this app a pass,
// which every call to this analyser's API carries; the API asks the Console whether it is
// still good. The Console's Super Admin is this app's admin.
type AuthUser = UserRecord

interface AuthState {
  user: AuthUser | null
  isAdmin: boolean
  login: (username: string, password: string) => Promise<{ ok: true } | { ok: false; reason: string }>
  /** Opened from FOX Console with ?launch=<one-time code>: signed in with no form. */
  loginWithLaunch: (code: string) => Promise<{ ok: true } | { ok: false; reason: string }>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

const FOX_CONSOLE = ((import.meta.env.VITE_FOX_CONSOLE_URL as string | undefined) || 'https://console.eassiitgn.page').replace(/\/+$/, '')
const STORAGE_KEY = 'pq_auth_user'
const SIGNED_OUT_EVENT = 'pq-signed-out'
// 8-hour session lifetime — matches the Fox Kisem convention so the
// experience is consistent across the two related platforms.
const SESSION_TTL_MS = 8 * 60 * 60 * 1000

interface StoredSession {
  user: AuthUser
  token: string
  expiresAt: number
}

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredSession
    if (!parsed.user || !parsed.token || !parsed.expiresAt) return null
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

/** The Console pass, for calls that do not go through fetch (the XHR upload). */
export function authToken(): string | null {
  return readSession()?.token ?? null
}

/** Is this a call to this analyser's own API (the only place the pass may go)? */
function isOwnApi(url: string): boolean {
  try {
    const u = new URL(url, window.location.href)
    const base = new URL(API_BASE || window.location.origin, window.location.href)
    return u.origin === base.origin && u.pathname.startsWith('/api/')
  } catch {
    return false
  }
}

// Every fetch to this analyser's API carries the pass; a 401 from it ends the session.
let fetchInstalled = false
function installAuthFetch(): void {
  if (fetchInstalled || typeof window === 'undefined') return
  fetchInstalled = true
  const plain = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!isOwnApi(url)) return plain(input, init)
    const token = authToken()
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const res = await plain(input, { ...init, headers })
    if (res.status === 401 && token) {
      localStorage.removeItem(STORAGE_KEY)
      window.dispatchEvent(new Event(SIGNED_OUT_EVENT))
    }
    return res
  }
}
installAuthFetch()

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readSession()?.user ?? null)

  // Refresh from storage if another tab logs in/out, or the API says the pass has ended
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setUser(readSession()?.user ?? null)
    }
    const onSignedOut = () => setUser(null)
    window.addEventListener('storage', onStorage)
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut)
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    let res: Response
    try {
      res = await fetch(`${FOX_CONSOLE}/api/device/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: 'power', login_id: username.trim().toLowerCase(), password, device_id: 'web-pqa' }),
      })
    } catch {
      return { ok: false as const, reason: 'FOX Console is not reachable right now. Please try again in a minute.' }
    }
    const data = await res.json().catch(() => ({})) as {
      token?: string; must_change_pw?: boolean; error?: string
      user?: { login_id: string; name: string }
    }
    if (!res.ok || !data.token || !data.user) {
      return { ok: false as const, reason: data.error || 'Sign-in failed.' }
    }
    if (data.must_change_pw) {
      return { ok: false as const, reason: `Please sign in once at ${FOX_CONSOLE.replace(/^https?:\/\//, '')} to set your own password, then use it here.` }
    }
    // The Console's Super Admin is this app's admin; everyone else is a user.
    const me = await fetch(`${FOX_CONSOLE}/api/device/me`, { headers: { Authorization: `Bearer ${data.token}` } })
      .then(r => r.ok ? r.json() : null).catch(() => null) as { user?: { role?: string } } | null
    const role: Role = me?.user?.role === 'super_admin' ? 'admin' : 'user'
    const signed: AuthUser = { username: data.user.login_id, role, display: data.user.name }
    const session: StoredSession = { user: signed, token: data.token, expiresAt: Date.now() + SESSION_TTL_MS }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    setUser(signed)
    return { ok: true as const }
  }, [])

  const loginWithLaunch = useCallback(async (code: string) => {
    let res: Response
    try {
      res = await fetch(`${FOX_CONSOLE}/api/device/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: 'power', code, device_id: 'web-pqa' }),
      })
    } catch {
      return { ok: false as const, reason: 'FOX Console is not reachable right now.' }
    }
    const data = await res.json().catch(() => ({})) as {
      token?: string; error?: string; user?: { login_id: string; name: string; role?: string }
    }
    if (!res.ok || !data.token || !data.user) {
      return { ok: false as const, reason: data.error || 'Could not sign in from FOX Console.' }
    }
    const signed: AuthUser = { username: data.user.login_id, role: data.user.role === 'super_admin' ? 'admin' : 'user', display: data.user.name }
    const session: StoredSession = { user: signed, token: data.token, expiresAt: Date.now() + SESSION_TTL_MS }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    setUser(signed)
    return { ok: true as const }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }, [])

  const value = useMemo<AuthState>(() => ({
    user,
    isAdmin: user?.role === 'admin',
    login,
    loginWithLaunch,
    logout,
  }), [user, login, loginWithLaunch, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

export type { Role }
