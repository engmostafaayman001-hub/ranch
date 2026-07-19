export type ClosingRecord = {
  id: string
  type?: 'daily' | 'driver'
  openedAt: string
  closedAt: string
  ordersCount: number
  salesWithoutDelivery: number
  expensesTotal: number
  uncollectedTotal: number
  otherPaymentsTotal: number
  drawerNet: number
  currency?: string
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
  } catch {
    // ignore
  }
}

export function clearClosings() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}
