export type PosDaySession = {
  isOpen: boolean
  openedAt: string
  closedAt: string | null
}

export const POS_DAY_SESSION_STORAGE_KEY = 'baseeta-pos-day-session-v1'

export function createInitialPosDaySession(now = new Date()): PosDaySession {
  return {
    isOpen: true,
    openedAt: now.toISOString(),
    closedAt: null,
  }
}

export function loadPosDaySession(storageKey = POS_DAY_SESSION_STORAGE_KEY): PosDaySession {
  if (typeof window === 'undefined') {
    return createInitialPosDaySession()
  }

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) {
      const initial = createInitialPosDaySession()
      window.localStorage.setItem(storageKey, JSON.stringify(initial))
      return initial
    }

    const parsed = JSON.parse(raw) as Partial<PosDaySession>
    if (typeof parsed?.openedAt === 'string') {
      return {
        isOpen: parsed.isOpen !== false,
        openedAt: parsed.openedAt,
        closedAt: typeof parsed.closedAt === 'string' ? parsed.closedAt : null,
      }
    }
  } catch {
    // ignore storage issues and fall back to a fresh session
  }

  return createInitialPosDaySession()
}

export function savePosDaySession(session: PosDaySession, storageKey = POS_DAY_SESSION_STORAGE_KEY) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey, JSON.stringify(session))
}

export function getSessionDateRange(session: PosDaySession) {
  const start = new Date(session.openedAt)
  const end = session.isOpen ? new Date() : new Date(session.closedAt || session.openedAt)
  if (start > end) {
    return { start: end.toISOString(), end: start.toISOString() }
  }
  return { start: start.toISOString(), end: end.toISOString() }
}
