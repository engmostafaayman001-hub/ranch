import { TrackedOrder } from './order-tracking'

export type SavedClosingExpense = {
  id: string
  name: string
  amount: number
  date: string
  note: string
  shiftId?: string
  createdAt?: string
}

export type ClosingRecord = {
  id: string
  type?: 'shift' | 'driver'
  // association to a shift (optional for historic closings)
  shiftId?: string
  openedAt: string
  closedAt: string
  ordersCount?: number
  cancelledOrdersCount?: number
  salesWithoutDelivery?: number
  expensesTotal?: number
  uncollectedTotal?: number
  otherPaymentsTotal?: number
  drawerNet?: number
  currency?: string
  orders?: TrackedOrder[]
  expenses?: SavedClosingExpense[]
}

const STORAGE_KEY = 'baseeta-closings-v1'

export function readClosings(): ClosingRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as ClosingRecord[]
  } catch {
    return []
  }
}

export function mergeClosings(...groups: ClosingRecord[][]) {
  const byId = new Map<string, ClosingRecord>()
  for (const closings of groups) {
    for (const closing of closings) {
      if (!closing?.id) continue
      const existing = byId.get(closing.id)
      if (!existing || (!existing.orders?.length && closing.orders?.length) || (!existing.expenses?.length && closing.expenses?.length)) {
        byId.set(closing.id, closing)
      }
    }
  }
  return Array.from(byId.values()).sort((first, second) => new Date(second.closedAt || second.openedAt).getTime() - new Date(first.closedAt || first.openedAt).getTime())
}

export function getSettledClosingIds(closings: ClosingRecord[]) {
  return {
    orderIds: new Set(closings.flatMap((closing) => closing.orders?.map((order) => order.id) || [])),
    expenseIds: new Set(closings.flatMap((closing) => closing.expenses?.map((expense) => expense.id) || [])),
  }
}

type ReadClosingsOptions = {
  repair?: boolean
  includeDetails?: boolean
  id?: string
}

export async function fetchServerClosings(options: ReadClosingsOptions = {}): Promise<ClosingRecord[]> {
  if (typeof window === 'undefined') return []
  const params = new URLSearchParams()
  if (options.repair) params.set('repair', '1')
  if (options.includeDetails) params.set('includeDetails', '1')
  if (options.id) params.set('id', options.id)
  const query = params.toString()
  const response = await fetch(`/api/closings${query ? `?${query}` : ''}`, { cache: 'no-store' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !Array.isArray(data.closings)) {
    throw new Error(data.message || data.error || 'Could not load closings')
  }
  return data.closings as ClosingRecord[]
}

export async function readAllClosings(options: ReadClosingsOptions = {}) {
  const localClosings = readClosings()
  try {
    const serverClosings = await fetchServerClosings(options)
    const merged = options.includeDetails ? mergeClosings(serverClosings, localClosings) : serverClosings
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    }
    return merged
  } catch {
    return localClosings
  }
}

export function saveClosing(record: ClosingRecord) {
  if (typeof window === 'undefined') return
  try {
    const current = readClosings()
    const next = [record, ...current]
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    
    // Also emit a custom event specific to closings for reliable in-app listeners
    try {
      window.dispatchEvent(new CustomEvent('closings:updated', { detail: { latest: record.id } }))
    } catch {
      // ignore
    }
  } catch (error) {
    console.error('❌ [closings.ts] Failed to save closing:', error)
  }
}

export async function saveClosingRecord(record: ClosingRecord) {
  if (typeof window !== 'undefined') {
    const response = await fetch('/api/closings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.message || data.error || 'Could not save closing')
    }
    saveClosing(data.closing || record)
    return (data.closing || record) as ClosingRecord
  }

  saveClosing(record)
  return record
}

export function clearClosings() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}

export function resetClosingStorage() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event('storage'))
}
