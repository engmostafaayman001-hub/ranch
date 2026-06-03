export interface AppNotification {
  id: string
  title: string
  message: string
  code?: string
  audience: 'all_customers'
  createdAt: string
}

const READ_KEY = 'readNotifications'

export function getReadNotificationIds() {
  if (typeof window === 'undefined') return []

  try {
    const stored = localStorage.getItem(READ_KEY)
    const parsed = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

export function markNotificationsRead(ids: string[]) {
  const read = new Set([...getReadNotificationIds(), ...ids])
  localStorage.setItem(READ_KEY, JSON.stringify([...read]))
}
