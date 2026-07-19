import { loadShiftSession } from '@/lib/pos-day-session'

const OFFLINE_QUEUE_STORAGE_KEY = 'ranch-offline-queue-v1'

export type OfflineQueueAction = {
  id: string
  type: 'create-order' | 'update-order' | 'delete-order' | 'create-expense' | 'create-shift' | 'close-shift' | 'clear-orders' | 'print-receipt'
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

function getActiveShiftId(payload: Record<string, unknown> = {}) {
  const explicitShiftId = String(payload.shiftId || payload.shift || '').trim()
  if (explicitShiftId) return explicitShiftId

  if (typeof window === 'undefined') return ''
  const session = loadShiftSession()
  return session.shiftId ? String(session.shiftId) : ''
}

function resolvePayload(actionType: OfflineQueueAction['type'], payload: Record<string, unknown>) {
  const nextPayload = { ...payload }
  const activeShiftId = getActiveShiftId(payload)

  if (activeShiftId) {
    if (actionType === 'create-order' || actionType === 'create-expense') {
      const currentShiftId = String((nextPayload as Record<string, unknown>).shiftId || '').trim()
      if (!currentShiftId) {
        ;(nextPayload as Record<string, unknown>).shiftId = activeShiftId
      }
    }

    if (actionType === 'close-shift') {
      const currentShiftId = String((nextPayload as Record<string, unknown>).shiftId || '').trim()
      if (!currentShiftId) {
        ;(nextPayload as Record<string, unknown>).shiftId = activeShiftId
      }
    }
  }

  return nextPayload
}

async function runQueuedAction(action: OfflineQueueAction) {
  const payload = action.payload || {}
  const resolvedPayload = resolvePayload(action.type, payload)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const activeShiftId = getActiveShiftId(resolvedPayload)
  if (activeShiftId) {
    headers['x-shift-id'] = activeShiftId
  }

  switch (action.type) {
    case 'create-order': {
      const response = await fetch('/api/pos/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify(resolvedPayload),
      })
      return response.ok
    }
    case 'update-order': {
      const response = await fetch('/api/pos/orders', {
        method: 'PATCH',
        headers,
        body: JSON.stringify(resolvedPayload),
      })
      return response.ok
    }
    case 'delete-order': {
      const response = await fetch('/api/pos/orders', {
        method: 'DELETE',
        headers,
        body: JSON.stringify(resolvedPayload),
      })
      return response.ok
    }
    case 'create-expense': {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers,
        body: JSON.stringify(resolvedPayload),
      })
      return response.ok
    }
    case 'create-shift': {
      const response = await fetch('/api/shifts', {
        method: 'POST',
        headers,
        body: JSON.stringify(resolvedPayload),
      })
      return response.ok
    }
    case 'close-shift': {
      const response = await fetch('/api/shifts', {
        method: 'PATCH',
        headers,
        body: JSON.stringify(resolvedPayload),
      })
      return response.ok
    }
    case 'clear-orders': {
      const orderIds = Array.isArray(payload.orderIds) ? payload.orderIds : []
      if (!orderIds.length) return true
      const results = await Promise.all(orderIds.map((orderId) => fetch('/api/pos/orders', {
        method: 'DELETE',
        headers,
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
