import { readClosings, saveClosing, type ClosingRecord } from './closings'
import { TrackedOrder } from './order-tracking'
import { isItemWithinDateRange } from './pos-day-session'

type ShiftSession = {
  isOpen: boolean
  openedAt: string
  closedAt: string | null
  shiftId?: string
}

export async function performShiftClosing(session: ShiftSession, options: { currency?: string } = {}): Promise<ClosingRecord> {
  const closedAt = session.closedAt || new Date().toISOString()
  const shiftId = session.shiftId

  try {
    const previousClosings = readClosings()
    const settledOrderIds = new Set(previousClosings.flatMap((c) => c.orders?.map((o) => o.id) || []))
    const settledExpenseIds = new Set(previousClosings.flatMap((c) => c.expenses?.map((e) => e.id) || []))

    const [ordersResp, expensesResp] = await Promise.all([
      fetch('/api/pos/orders?limit=9999', { cache: 'no-store' }),
      fetch('/api/expenses', { cache: 'no-store' }),
    ])

    const ordersData = await ordersResp.json().catch(() => ({}))
    const expensesData = await expensesResp.json().catch(() => ({}))

    const allOrders: TrackedOrder[] = Array.isArray(ordersData.orders) ? ordersData.orders : []
    const allExpenses: Array<any> = Array.isArray(expensesData.expenses) ? expensesData.expenses : []

    const ordersForClosing = allOrders.filter((o) => {
      if (settledOrderIds.has(o.id) || o.status === 'cancelled') return false
      const matchesCurrentShift = shiftId ? o.shiftId === shiftId : false
      const createdDuringSession = isItemWithinDateRange(o.createdAt, session.openedAt, closedAt, { includeSameDayBeforeStart: true })
      const isLegacyOutsideShift = !o.shiftId
      return matchesCurrentShift || isLegacyOutsideShift || createdDuringSession
    })

    const expensesForClosing = allExpenses.filter((e) => {
      if (settledExpenseIds.has(e.id)) return false
      const matchesCurrentShift = shiftId ? e.shiftId === shiftId : false
      const createdDuringSession = isItemWithinDateRange(e.date, session.openedAt, closedAt, { includeSameDayBeforeStart: true })
      const isLegacyOutsideShift = !e.shiftId
      return matchesCurrentShift || isLegacyOutsideShift || createdDuringSession
    })

    const salesWithoutDelivery = ordersForClosing.reduce((s, o) => {
      return s + (typeof o.subtotal === 'number' && Number.isFinite(o.subtotal) ? Number(o.subtotal) : Math.max(0, Number(o.total || 0) - Number(o.deliveryFee || 0)))
    }, 0)

    const uncollectedTotal = ordersForClosing.filter((o) => String(o.payment?.status || '').toLowerCase() === 'cash_on_delivery').reduce((s, o) => s + Number(o.total || 0), 0)

    const otherPaymentsTotal = ordersForClosing.filter((o) => ['vodafone_cash', 'instapay'].includes(String(o.payment?.method || '').toLowerCase())).reduce((s, o) => s + Number(o.total || 0), 0)

    const expensesTotal = expensesForClosing.reduce((s, e) => s + Number(e.amount || 0), 0)

    const drawerNet = salesWithoutDelivery - expensesTotal

    const record: ClosingRecord = {
      id: `CLOSE-${Date.now()}`,
      type: 'shift',
      openedAt: session.openedAt,
      closedAt,
      ordersCount: ordersForClosing.length,
      salesWithoutDelivery,
      expensesTotal,
      uncollectedTotal,
      otherPaymentsTotal,
      drawerNet,
      shiftId: session.shiftId,
      currency: options.currency || 'EGP',
      orders: ordersForClosing,
      expenses: expensesForClosing,
    }

    saveClosing(record)
    return record
  } catch (err) {
    console.warn('[shift-closing] performShiftClosing failed', err)
    throw err
  }
}

export default performShiftClosing
