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

export function clearClosings() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}

export function resetClosingStorage() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event('storage'))
}
