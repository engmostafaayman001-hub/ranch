import { useCallback, useEffect, useState } from 'react'
import { loadShiftSession, saveShiftSession, type ShiftSession, createInitialShiftSession } from './pos-day-session'

export function useShiftSession(): readonly [ShiftSession, (s: ShiftSession) => void] {
  const [session, setSession] = useState<ShiftSession>(() => {
    try {
      return loadShiftSession()
    } catch {
      return createInitialShiftSession()
    }
  })

  useEffect(() => {
    function handleStorage() {
      try {
        const updated = loadShiftSession()
        setSession(updated)
      } catch {
        // ignore
      }
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('focus', handleStorage)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('focus', handleStorage)
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
