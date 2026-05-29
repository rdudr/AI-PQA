import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, LogIn, ShieldCheck, User as UserIcon, Eye, EyeOff } from 'lucide-react'

import { useAuth } from '@/auth/AuthContext'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }
  const { login, user } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // If already signed-in, drop straight to the dashboard
  if (user) {
    navigate(location.state?.from ?? '/dashboard', { replace: true })
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!username.trim() || !password) {
      setError('Username and password are required.')
      return
    }
    setBusy(true)
    const result = login(username, password)
    setBusy(false)
    if (!result.ok) {
      setError(result.reason)
      return
    }
    navigate(location.state?.from ?? '/dashboard', { replace: true })
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F4F6FF]">
      {/* Decorative iridescent blobs in the background */}
      <div className="pointer-events-none absolute -top-32 -left-32 size-96 rounded-full bg-blue-300/30 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 -right-32 size-[28rem] rounded-full bg-violet-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 size-[32rem] rounded-full bg-cyan-200/30 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-12 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="grid w-full max-w-4xl gap-6 lg:grid-cols-2"
        >
          {/* ── LEFT: Brand panel ─────────────────────────────────────── */}
          <div className="relative hidden overflow-hidden rounded-3xl bg-gradient-to-br from-[#10375c] via-[#1d4a73] to-[#10375c] p-8 text-white lg:flex lg:flex-col lg:justify-between">
            {/* Inner sheen */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(243,198,35,0.20),transparent_50%)]" />
            <div className="relative">
              <div className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-[#f3c623] text-2xl font-bold text-[#10375c] shadow-lg shadow-[#f3c623]/30">
                PQ
              </div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/55">Industrial analytics</p>
              <h2 className="mt-2 text-3xl font-bold leading-tight">
                AI Power Quality<br/>Analyzer
              </h2>
              <p className="mt-3 max-w-xs text-sm text-white/70">
                Sign in to upload PQ exports, configure analyzer profiles, and
                explore harmonic, dip-swell and energy analytics.
              </p>
            </div>
            <div className="relative space-y-2 text-sm text-white/70">
              <p className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-300" />
                Role-based access (Admin / User)
              </p>
              <p className="flex items-center gap-2">
                <Lock className="size-4 text-cyan-300" />
                Session expires after 8 hours of inactivity
              </p>
            </div>
          </div>

          {/* ── RIGHT: Login form ─────────────────────────────────────── */}
          <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/65 p-8 shadow-[0_20px_60px_rgba(16,55,92,0.12)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.4),transparent_45%)]" />

            <div className="relative">
              <p className="text-xs uppercase tracking-[0.28em] text-[#10375c]/55">Welcome back</p>
              <h1 className="mt-1 text-2xl font-semibold text-[#10375c]">Sign in to continue</h1>
              <p className="mt-1 text-sm text-[#10375c]/65">
                Enter your credentials to access the dashboard.
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                {/* Username */}
                <div>
                  <label htmlFor="username" className="text-xs font-medium text-[#10375c]/75">
                    Username
                  </label>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border border-[#10375c]/12 bg-white/85 px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-300/50">
                    <UserIcon className="size-4 text-[#10375c]/45" />
                    <input
                      id="username"
                      type="text"
                      autoComplete="username"
                      autoFocus
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. Rishabh"
                      className="w-full bg-transparent text-sm text-[#10375c] outline-none placeholder:text-[#10375c]/40"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className="text-xs font-medium text-[#10375c]/75">
                    Password
                  </label>
                  <div className="mt-1 flex items-center gap-2 rounded-xl border border-[#10375c]/12 bg-white/85 px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-300/50">
                    <Lock className="size-4 text-[#10375c]/45" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-transparent text-sm text-[#10375c] outline-none placeholder:text-[#10375c]/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      tabIndex={-1}
                      className="rounded-md p-1 text-[#10375c]/45 hover:bg-[#10375c]/06 hover:text-[#10375c]"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border border-red-300/60 bg-red-50/80 px-3 py-2 text-xs text-red-700"
                  >
                    {error}
                  </motion.div>
                )}

                <motion.button
                  type="submit"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#10375c] to-[#1d4a73] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#10375c]/20 transition hover:shadow-[#10375c]/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LogIn className="size-4" />
                  {busy ? 'Signing in…' : 'Sign in'}
                </motion.button>
              </form>

              <div className="mt-6 rounded-xl border border-[#10375c]/08 bg-white/50 p-3 text-[10px] text-[#10375c]/55">
                <p className="font-semibold uppercase tracking-wider text-[#10375c]/65">Roles</p>
                <p className="mt-1 leading-relaxed">
                  <span className="font-mono font-semibold text-emerald-700">Admin</span> can upload &amp; configure PQ analyzers.{' '}
                  <span className="font-mono font-semibold text-blue-700">User</span> can view all dashboards but cannot add or edit.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
