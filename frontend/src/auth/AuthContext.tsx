import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { findUser } from './users'
import type { Role, UserRecord } from './users'

type AuthUser = Omit<UserRecord, 'password'>

interface AuthState {
  user: AuthUser | null
  isAdmin: boolean
  login: (username: string, password: string) => { ok: true } | { ok: false; reason: string }
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

const STORAGE_KEY = 'pq_auth_user'
// 8-hour session lifetime — matches the Fox Kisem convention so the
// experience is consistent across the two related platforms.
const SESSION_TTL_MS = 8 * 60 * 60 * 1000

interface StoredSession {
  user: AuthUser
  expiresAt: number
}

function readStored(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredSession
    if (!parsed.user || !parsed.expiresAt) return null
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed.user
  } catch {
    return null
  }
}

function writeStored(user: AuthUser): void {
  const payload: StoredSession = { user, expiresAt: Date.now() + SESSION_TTL_MS }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStored())

  // Refresh from storage if another tab logs in/out
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setUser(readStored())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const login = useCallback((username: string, password: string) => {
    const found = findUser(username, password)
    if (!found) return { ok: false as const, reason: 'Invalid username or password' }
    const safe: AuthUser = { username: found.username, role: found.role, display: found.display }
    writeStored(safe)
    setUser(safe)
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
    logout,
  }), [user, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

export type { Role }
