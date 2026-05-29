import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export type NotifLevel = 'info' | 'warning' | 'error' | 'success'

export interface Notification {
  id: string
  level: NotifLevel
  title: string
  message: string
  timestamp: string   // ISO string
  read: boolean
}

interface NotificationContextValue {
  notifications: Notification[]
  unreadCount: number
  push: (level: NotifLevel, title: string, message: string) => void
  markAllRead: () => void
  clearAll: () => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

const STORAGE_KEY = 'pq_notifications'
const MAX_STORED = 100

function load(): Notification[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function save(items: Notification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_STORED)))
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(load)

  useEffect(() => { save(notifications) }, [notifications])

  const push = useCallback((level: NotifLevel, title: string, message: string) => {
    const n: Notification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      level,
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false,
    }
    setNotifications((prev) => [n, ...prev].slice(0, MAX_STORED))
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, push, markAllRead, clearAll }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be inside NotificationProvider')
  return ctx
}
