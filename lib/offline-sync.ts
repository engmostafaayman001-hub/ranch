/**
 * Offline-first synchronization system
 * Manages local queue and syncs with server when online
 */

export type OfflineSyncAction = {
  id: string
  timestamp: number
  type: 'create_order' | 'update_order' | 'delete_order' | 'create_expense'
  endpoint: string
  method: 'POST' | 'PATCH' | 'DELETE'
  payload: Record<string, unknown>
  retries: number
  lastError?: string
  synced: boolean
}

const OFFLINE_QUEUE_KEY = 'baseeta-offline-queue-v1'
const OFFLINE_CACHE_KEY = 'baseeta-offline-cache-v1'
const MAX_RETRIES = 5

export class OfflineSyncManager {
  private queue: OfflineSyncAction[] = []
  private isSyncing = false

  constructor() {
    this.loadQueue()
    this.setupOnlineListener()
  }

  private loadQueue() {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY)
      this.queue = raw ? JSON.parse(raw) : []
    } catch {
      this.queue = []
    }
  }

  private saveQueue() {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(this.queue))
    } catch {
      console.error('[OfflineSyncManager] Failed to save queue')
    }
  }

  private setupOnlineListener() {
    if (typeof window === 'undefined') return
    window.addEventListener('online', () => {
      console.log('[OfflineSyncManager] Connection restored, starting sync...')
      this.syncQueue()
    })
  }

  addAction(action: Omit<OfflineSyncAction, 'id' | 'timestamp' | 'retries' | 'synced'>) {
    const newAction: OfflineSyncAction = {
      ...action,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      retries: 0,
      synced: false,
    }
    this.queue.push(newAction)
    this.saveQueue()
    console.log(`[OfflineSyncManager] Action queued: ${newAction.type} (${newAction.id})`)
    return newAction.id
  }

  getQueue() {
    return [...this.queue]
  }

  clearQueue() {
    this.queue = []
    this.saveQueue()
  }

  async syncQueue() {
    if (this.isSyncing || !navigator.onLine) return
    this.isSyncing = true

    try {
      const unsyncedActions = this.queue.filter((action) => !action.synced)
      console.log(`[OfflineSyncManager] Starting sync for ${unsyncedActions.length} pending actions`)

      for (const action of unsyncedActions) {
        if (action.retries >= MAX_RETRIES) {
          console.warn(`[OfflineSyncManager] Max retries reached for action ${action.id}`)
          continue
        }

        try {
          const response = await fetch(action.endpoint, {
            method: action.method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action.payload),
          })

          if (response.ok) {
            action.synced = true
            console.log(`[OfflineSyncManager] Successfully synced action ${action.id}`)
          } else {
            action.retries += 1
            action.lastError = `HTTP ${response.status}`
          }
        } catch (error) {
          action.retries += 1
          action.lastError = error instanceof Error ? error.message : 'Unknown error'
          console.error(`[OfflineSyncManager] Sync error for ${action.id}: ${action.lastError}`)
        }

        this.saveQueue()
      }

      // Clean up synced actions after a delay
      const syncedBefore = this.queue.filter((a) => a.synced).length
      if (syncedBefore > 0) {
        setTimeout(() => {
          this.queue = this.queue.filter((a) => !a.synced)
          this.saveQueue()
          console.log(`[OfflineSyncManager] Cleaned up ${syncedBefore} synced actions`)
        }, 5000)
      }
    } finally {
      this.isSyncing = false
    }
  }

  cacheData(key: string, data: unknown) {
    if (typeof window === 'undefined') return
    try {
      const cache = this.getCache()
      cache[key] = { data, timestamp: Date.now() }
      window.localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(cache))
    } catch {
      console.error('[OfflineSyncManager] Failed to cache data')
    }
  }

  getCachedData(key: string) {
    if (typeof window === 'undefined') return null
    try {
      const cache = this.getCache()
      return cache[key]?.data || null
    } catch {
      return null
    }
  }

  private getCache() {
    if (typeof window === 'undefined') return {}
    try {
      const raw = window.localStorage.getItem(OFFLINE_CACHE_KEY)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  }

  isOnline() {
    if (typeof window === 'undefined') return true
    return navigator.onLine
  }
}

export const offlineSyncManager = new OfflineSyncManager()
