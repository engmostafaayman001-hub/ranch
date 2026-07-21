import { saveClosing, type ClosingRecord, type SavedClosingExpense } from './closings'
import { summarizeClosingData } from './financial-calculations'
import type { TrackedOrder } from '@/lib/order-tracking'

type ShiftSession = {
  isOpen: boolean
  openedAt: string
  closedAt: string | null
  shiftId?: string
}

type ShiftClosingOptions = {
  orders?: TrackedOrder[]
  expenses?: SavedClosingExpense[]
  currency?: string
}

export async function performShiftClosing(session: ShiftSession, options: ShiftClosingOptions = {}): Promise<ClosingRecord> {
  const closedAt = session.closedAt || new Date().toISOString()
  const orders = options.orders || []
  const expenses = options.expenses || []
  const summary = summarizeClosingData(orders, expenses)

  try {
    const record: ClosingRecord = {
      id: `CLOSE-${Date.now()}`,
      type: 'shift',
      openedAt: session.openedAt,
      closedAt,
      shiftId: session.shiftId,
      currency: options.currency || 'EGP',
      ordersCount: orders.length,
      salesWithoutDelivery: summary.salesExcludingDelivery,
      expensesTotal: summary.expenses,
      uncollectedTotal: summary.remainingToCollect,
      otherPaymentsTotal: summary.otherPayments,
      drawerNet: Number(summary.expectedDrawer.toFixed(2)),
      orders: orders.length ? orders : undefined,
      expenses: expenses.length ? expenses : undefined,
    }

    saveClosing(record)
    return record
  } catch (err) {
    console.warn('[shift-closing] performShiftClosing failed', err)
    throw err
  }
}

export default performShiftClosing
