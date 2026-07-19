export type ShiftSession = {
  isOpen: boolean
  openedAt: string
  closedAt: string | null
  shiftId?: string
  confirmed?: boolean
}

const OLD_POS_DAY_SESSION_STORAGE_KEY = 'baseeta-pos-day-session-v1'
export const SHIFT_SESSION_STORAGE_KEY = 'ranch-shift-session-v1'
export const POS_DAY_SESSION_STORAGE_KEY = SHIFT_SESSION_STORAGE_KEY

export function createInitialShiftSession(now = new Date()): ShiftSession {
  return {
    isOpen: true,
    openedAt: now.toISOString(),
    closedAt: null,
    shiftId: `SHIFT-${now.getTime()}`,
    confirmed: false,
  }
}

export function loadShiftSession(storageKey = SHIFT_SESSION_STORAGE_KEY): ShiftSession {
  if (typeof window === 'undefined') {
    return createInitialShiftSession()
  }

  try {
    const raw = window.localStorage.getItem(storageKey) || window.localStorage.getItem(OLD_POS_DAY_SESSION_STORAGE_KEY)
    if (!raw) {
      const initial = createInitialShiftSession()
      window.localStorage.setItem(storageKey, JSON.stringify(initial))
      return initial
    }

    const parsed = JSON.parse(raw) as Partial<ShiftSession>
    if (typeof parsed?.openedAt === 'string') {
      return {
        isOpen: parsed.isOpen !== false,
        openedAt: parsed.openedAt,
        closedAt: typeof parsed.closedAt === 'string' ? parsed.closedAt : null,
        shiftId: typeof parsed.shiftId === 'string' ? parsed.shiftId : `SHIFT-${new Date(parsed.openedAt).getTime()}`,
        confirmed: parsed.confirmed === true,
      }
    }
  } catch {
    // ignore storage issues and fall back to a fresh session
  }

  return createInitialShiftSession()
}

export function saveShiftSession(session: ShiftSession, storageKey = SHIFT_SESSION_STORAGE_KEY) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey, JSON.stringify(session))
}

export function getShiftSessionDateRange(session: ShiftSession) {
  const start = new Date(session.openedAt)
  const end = session.isOpen ? new Date() : new Date(session.closedAt || session.openedAt)
  if (start > end) {
    return { start: end.toISOString(), end: start.toISOString() }
  }
  return { start: start.toISOString(), end: end.toISOString() }
}

export function isItemWithinDateRange(
  value: string | undefined,
  start: string,
  end: string,
  options?: { includeSameDayBeforeStart?: boolean },
) {
  if (!value) return false

  const compareDate = new Date(value)
  const startDate = new Date(start)
  const endDate = new Date(end)

  if (Number.isNaN(compareDate.getTime()) || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return false
  }

  const compareTime = compareDate.getTime()
  const startTime = startDate.getTime()
  const endTime = endDate.getTime()
  const withinWindow = compareTime >= startTime && compareTime <= endTime

  if (withinWindow) {
    return true
  }

  if (options?.includeSameDayBeforeStart) {
    const sameDayAsShiftStart = compareDate.toISOString().slice(0, 10) === startDate.toISOString().slice(0, 10)
    return sameDayAsShiftStart && compareTime < startTime
  }

  return false
}

export function isItemInShiftWindow(
  value: string | undefined,
  session: ShiftSession,
  options?: { includeSameDayBeforeStart?: boolean },
) {
  const range = getShiftSessionDateRange(session)
  return isItemWithinDateRange(value, range.start, range.end, options)
}

// backwards compatibility for existing imports
export type PosDaySession = ShiftSession
export const createInitialPosDaySession = createInitialShiftSession
export const loadPosDaySession = loadShiftSession
export const savePosDaySession = saveShiftSession
export const getSessionDateRange = getShiftSessionDateRange
