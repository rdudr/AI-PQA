import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from './AuthContext'
import type { Role } from './users'

interface Props {
  children: ReactNode
  /** Restrict access to a specific role. Omit to allow any signed-in user. */
  role?: Role
}

/**
 * Route guard.
 *
 *   <RequireAuth>            ← any signed-in user
 *   <RequireAuth role="admin"> ← only the admin account
 *
 * Unauthenticated visitors get bounced to `/login` with a `from` location
 * so the login page can send them back where they tried to go.
 *
 * Authenticated-but-wrong-role visitors get bounced to `/` so they don't
 * see a 404 — they just land on the home page with a notification later.
 */
export function RequireAuth({ children, role }: Props) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  if (role && user.role !== role) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
