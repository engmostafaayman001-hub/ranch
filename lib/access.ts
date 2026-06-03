import { DASHBOARD_ACCESS_EMAILS } from '@/lib/constants'

const REGISTERED_USERS_KEY = 'registeredUsers'

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function canAccessDashboardByEmail(email?: string | null) {
  if (!email) return false
  return DASHBOARD_ACCESS_EMAILS.includes(normalizeEmail(email))
}

export function getRegisteredEmails() {
  if (typeof window === 'undefined') return []

  try {
    const stored = localStorage.getItem(REGISTERED_USERS_KEY)
    const parsed = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? parsed.map((email) => normalizeEmail(String(email))) : []
  } catch {
    return []
  }
}

export function rememberRegisteredEmail(email: string) {
  const normalized = normalizeEmail(email)
  const emails = new Set([...getRegisteredEmails(), normalized])
  localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify([...emails]))
}

export function isRegisteredEmail(email: string) {
  const normalized = normalizeEmail(email)
  return (
    canAccessDashboardByEmail(normalized) ||
    getRegisteredEmails().includes(normalized)
  )
}
