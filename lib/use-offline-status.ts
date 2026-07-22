import { useEffect, useState } from 'react'
import { offlineSyncManager } from '@/lib/offline-sync'

export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle')
  const [pendingCount, setPendingCount] = useState(() => offlineSyncManager.getQueue().filter((a) => !a.synced).length)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setSyncStatus('syncing')
      offlineSyncManager.syncQueue().then(() => {
        setSyncStatus('idle')
        setPendingCount(offlineSyncManager.getQueue().filter((a) => !a.synced).length)
      })
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline, syncStatus, pendingCount }
}
