const OFFLINE_QUEUE_STORAGE_KEY = 'ranch-offline-queue-v1'

export type OfflineQueueAction = {
  id: string
  type: 'create-order' | 'update-order' | 'delete-order' | 'create-expense' | 'clear-orders' | 'print-receipt'
  payload: Record<string, unknown>
  createdAt: string
  attempts: number
}

export function readOfflineQueue(): OfflineQueueAction[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY)
    if (!raw) return []
    const value = JSON.parse(raw) as OfflineQueueAction[]
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

export function writeOfflineQueue(actions: OfflineQueueAction[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(actions))
}

export function queueOfflineAction(action: Omit<OfflineQueueAction, 'id' | 'createdAt' | 'attempts'>) {
  const nextAction: OfflineQueueAction = {
    id: `${action.type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    payload: action.payload,
    type: action.type,
    createdAt: new Date().toISOString(),
    attempts: 0,
  }
  const current = readOfflineQueue()
  writeOfflineQueue([...current, nextAction])
  return nextAction
}

export function removeOfflineAction(actionId: string) {
  const current = readOfflineQueue().filter((item) => item.id !== actionId)
  writeOfflineQueue(current)
  return current
}

export function clearOfflineQueue() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(OFFLINE_QUEUE_STORAGE_KEY)
}

async function runQueuedAction(action: OfflineQueueAction) {
  const payload = action.payload || {}

  switch (action.type) {
    case 'create-order': {
      const response = await fetch('/api/pos/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      return response.ok
    }
    case 'update-order': {
      const response = await fetch('/api/pos/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      return response.ok
    }
    case 'delete-order': {
      const response = await fetch('/api/pos/orders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      return response.ok
    }
    case 'create-expense': {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      return response.ok
    }
    case 'clear-orders': {
      const orderIds = Array.isArray(payload.orderIds) ? payload.orderIds : []
      if (!orderIds.length) return true
      const results = await Promise.all(orderIds.map((orderId) => fetch('/api/pos/orders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })))
      return results.every((result) => result.ok)
    }
    case 'print-receipt':
      return true
    default:
      return true
  }
}

export async function syncOfflineQueue() {
  if (typeof window === 'undefined' || !window.navigator.onLine) return []

  const actions = readOfflineQueue()
  if (!actions.length) return []

  const remaining: OfflineQueueAction[] = []

  for (const action of actions) {
    try {
      const succeeded = await runQueuedAction(action)
      if (!succeeded) {
        remaining.push(action)
      }
    } catch {
      remaining.push(action)
    }
  }

  if (remaining.length !== actions.length) {
    writeOfflineQueue(remaining)
  } else if (!remaining.length) {
    clearOfflineQueue()
  }

  return remaining
}
