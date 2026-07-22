import { useCallback, useEffect, useState } from 'react'
import { loadShiftSession, saveShiftSession, type ShiftSession, createInitialShiftSession } from './pos-day-session'

type ServerShift = {
  id: string
  openedAt: string
  closedAt?: string | null
  state?: string
}

function serverShiftToSession(shift: ServerShift): ShiftSession {
  return {
    isOpen: !['closed', 'locked'].includes(String(shift.state || '').toLowerCase()),
    openedAt: shift.openedAt,
    closedAt: typeof shift.closedAt === 'string' ? shift.closedAt : null,
    shiftId: shift.id,
    confirmed: true,
  }
}

export function useShiftSession(): readonly [ShiftSession, (s: ShiftSession) => void] {
  const [session, setSession] = useState<ShiftSession>(() => {
    try {
      return loadShiftSession()
    } catch {
      return createInitialShiftSession()
    }
  })

  useEffect(() => {
    let active = true
    async function syncSharedShift() {
      try {
        const response = await fetch('/api/shifts', { cache: 'no-store' })
        const data = await response.json().catch(() => ({}))
        const shift = data?.shift as ServerShift | undefined
        if (!active || !response.ok || !shift?.id || !shift.openedAt) return

        const sharedSession = serverShiftToSession(shift)
        saveShiftSession(sharedSession)
        setSession((current) => {
          if (
            current.shiftId === sharedSession.shiftId &&
            current.openedAt === sharedSession.openedAt &&
            current.closedAt === sharedSession.closedAt &&
            current.isOpen === sharedSession.isOpen
          ) {
            return current
          }
          return sharedSession
        })
      } catch {
        // Keep the local session if the shared shift cannot be reached.
      }
    }

    function handleStorage() {
      try {
        const updated = loadShiftSession()
        setSession(updated)
      } catch {
        // ignore
      }
    }

    void syncSharedShift()
    window.addEventListener('storage', handleStorage)
    window.addEventListener('focus', handleStorage)
    window.addEventListener('focus', syncSharedShift)
    return () => {
      active = false
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('focus', handleStorage)
      window.removeEventListener('focus', syncSharedShift)
    }
  }, [])

  const setShift = useCallback((next: ShiftSession) => {
    try {
      saveShiftSession(next)
    } catch {
      // ignore
    }
    setSession(next)
    // notify other tabs
    try {
      window.dispatchEvent(new Event('storage'))
    } catch {
      // ignore
    }
  }, [])

  return [session, setShift] as const
}

export default useShiftSession
