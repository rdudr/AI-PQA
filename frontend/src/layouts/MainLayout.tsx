import { motion } from 'framer-motion'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, ShieldCheck, User as UserIcon } from 'lucide-react'

import { useAuth } from '@/auth/AuthContext'
import { NotificationBell } from '@/components/NotificationBell'
import { cn } from '@/utils/cn'

interface NavItem {
  to: string
  label: string
  adminOnly?: boolean
}

const NAV: NavItem[] = [
  { to: '/',           label: 'Overview' },
  { to: '/upload',     label: 'Upload' },
  { to: '/dashboard',  label: 'Dashboard' },
  { to: '/history',    label: 'History' },
  { to: '/compliance', label: 'Compliance' },
  { to: '/cost',       label: 'Cost' },
  { to: '/energy',     label: 'Energy' },
  { to: '/health',     label: 'Health' },
  { to: '/settings',   label: 'Settings', adminOnly: true },
]

export function MainLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAdmin, logout } = useAuth()

  const visibleNav = NAV.filter(item => !item.adminOnly || isAdmin)

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-transparent">
      <header className="sticky top-0 z-40 w-full border-b border-white/20 bg-white/35 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <motion.div
              layoutId="brand-mark"
              className="grid size-10 place-items-center rounded-2xl bg-[#10375c] text-sm font-bold text-[#f3c623] shadow-lg shadow-[#10375c]/15"
            >
              PQ
            </motion.div>
            <div className="text-left">
              <p className="text-xs uppercase tracking-[0.22em] text-[#10375c]/55">
                Industrial Analytics
              </p>
              <p className="text-lg font-semibold text-[#10375c]">
                AI Power Quality Analyzer
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <nav className="flex flex-wrap items-center gap-1 rounded-2xl border border-[#10375c]/10 bg-white/70 p-1 shadow-sm">
              {visibleNav.map((item) => {
                const active = location.pathname === item.to
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      'rounded-xl px-3 py-1.5 text-xs font-medium transition-colors',
                      active
                        ? 'bg-[#10375c] text-white shadow-sm'
                        : 'text-[#10375c]/70 hover:bg-[#f4f6ff]',
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
            <NotificationBell />

            {/* User chip + role badge + logout. Hidden if somehow rendered
                without a user (RequireAuth normally prevents this). */}
            {user && (
              <div className="flex items-center gap-1.5 rounded-2xl border border-[#10375c]/10 bg-white/70 p-1 pl-3 shadow-sm">
                <span className={cn(
                  'inline-flex items-center gap-1 text-xs font-bold',
                  isAdmin ? 'text-emerald-700' : 'text-blue-700',
                )}>
                  {isAdmin ? <ShieldCheck className="size-3.5" /> : <UserIcon className="size-3.5" />}
                  {user.display}
                </span>
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                  isAdmin ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700',
                )}>
                  {isAdmin ? 'Admin' : 'User'}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Sign out"
                  className="rounded-xl p-1.5 text-[#10375c]/55 transition hover:bg-red-50 hover:text-red-600"
                >
                  <LogOut className="size-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1400px] flex-grow px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
