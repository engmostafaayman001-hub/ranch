import { getSettledClosingIds, type ClosingRecord } from '@/lib/closings'
import { summarizeClosingData } from '@/lib/financial-calculations'
import { readServerClosings, saveServerClosing } from '@/lib/server-closings'
import { deleteServerExpense, readServerExpenses } from '@/lib/server-expenses'
import { deleteServerOrder, readServerOrders } from '@/lib/server-orders'
import { isShiftActiveState, readShifts } from '@/lib/shifts'
import type { TrackedOrder } from '@/lib/order-tracking'

function isValidRangeDate(value?: string) {
  const time = new Date(value || '').getTime()
  return Number.isFinite(time)
}

function isWithinClosingRange(value: string | undefined, openedAt: string, closedAt: string) {
  const time = new Date(value || '').getTime()
  const start = new Date(openedAt).getTime()
  const end = new Date(closedAt).getTime()
  if (!Number.isFinite(time) || !Number.isFinite(start) || !Number.isFinite(end)) return false
  const from = Math.min(start, end)
  const to = Math.max(start, end)
  return time >= from && time <= to
}

export async function enrichShiftClosing(record: ClosingRecord): Promise<ClosingRecord> {
  if (record.type === 'driver' || !record.shiftId || !isValidRangeDate(record.openedAt) || !isValidRangeDate(record.closedAt)) {
    return record
  }

  const [orders, expenses, existingClosings] = await Promise.all([
    readServerOrders({ limit: 10000 }),
    readServerExpenses(),
    readServerClosings(),
  ])
  const otherClosings = existingClosings.filter((closing) => closing.id !== record.id)
  const { orderIds: settledOrderIds, expenseIds: settledExpenseIds } = getSettledClosingIds(otherClosings)
  const existingOrderIds = new Set((record.orders || []).map((order) => order.id))
  const existingExpenseIds = new Set((record.expenses || []).map((expense) => expense.id))

  const missingOrders = orders.filter((order) => {
    if (existingOrderIds.has(order.id) || settledOrderIds.has(order.id)) return false
    if (order.shiftId === record.shiftId) return true
    return !order.shiftId && isWithinClosingRange(order.createdAt, record.openedAt, record.closedAt)
  })
  const missingExpenses = expenses.filter((expense) => {
    if (existingExpenseIds.has(expense.id) || settledExpenseIds.has(expense.id)) return false
    if (expense.shiftId === record.shiftId) return true
    return !expense.shiftId && isWithinClosingRange(expense.date, record.openedAt, record.closedAt)
  })

  const mergedOrders = [...(record.orders || []), ...missingOrders]
  const mergedExpenses = [...(record.expenses || []), ...missingExpenses]
  const summary = summarizeClosingData(mergedOrders, mergedExpenses)

  return {
    ...record,
    orders: mergedOrders.length ? mergedOrders : undefined,
    expenses: mergedExpenses.length ? mergedExpenses : undefined,
    ordersCount: mergedOrders.length,
    cancelledOrdersCount: summary.cancelledOrders,
    salesWithoutDelivery: summary.salesExcludingDelivery,
    expensesTotal: summary.expenses,
    uncollectedTotal: summary.remainingToCollect,
    otherPaymentsTotal: summary.otherPayments,
    drawerNet: Number(summary.expectedDrawer.toFixed(2)),
  }
}

export function closingChanged(first: ClosingRecord, second: ClosingRecord) {
  return (
    (first.orders?.length || 0) !== (second.orders?.length || 0) ||
    (first.expenses?.length || 0) !== (second.expenses?.length || 0) ||
    first.ordersCount !== second.ordersCount ||
    first.cancelledOrdersCount !== second.cancelledOrdersCount ||
    first.expensesTotal !== second.expensesTotal ||
    first.drawerNet !== second.drawerNet
  )
}

export async function pruneSettledClosingItems(record: ClosingRecord) {
  if (record.type === 'driver') return { orders: 0, expenses: 0 }

  const orderIds = Array.from(new Set((record.orders || []).map((order) => order.id).filter(Boolean)))
  const expenseIds = Array.from(new Set((record.expenses || []).map((expense) => expense.id).filter(Boolean)))
  const [orderResults, expenseResults] = await Promise.all([
    Promise.all(orderIds.map((id) => deleteServerOrder(id).catch(() => false))),
    Promise.all(expenseIds.map((id) => deleteServerExpense(id).catch(() => false))),
  ])

  return {
    orders: orderResults.filter(Boolean).length,
    expenses: expenseResults.filter(Boolean).length,
  }
}

export async function repairServerClosings(options: { pruneSettled?: boolean } = {}) {
  const closings = await readServerClosings()
  const repaired: ClosingRecord[] = []

  for (const closing of closings) {
    const enriched = await enrichShiftClosing(closing)
    if (closingChanged(closing, enriched)) {
      await saveServerClosing(enriched)
    }
    if (options.pruneSettled) {
      await pruneSettledClosingItems(enriched)
    }
    repaired.push(enriched)
  }

  return repaired
}

function orderTime(order: TrackedOrder) {
  const time = new Date(order.createdAt || '').getTime()
  return Number.isFinite(time) ? time : 0
}

function buildArchivedShiftClosing(shiftId: string, orders: TrackedOrder[]): ClosingRecord {
  const sortedOrders = [...orders].sort((first, second) => orderTime(first) - orderTime(second))
  const openedAt = sortedOrders[0]?.createdAt || new Date().toISOString()
  const closedAt = sortedOrders[sortedOrders.length - 1]?.createdAt || openedAt
  const summary = summarizeClosingData(sortedOrders, [])

  return {
    id: `CLOSE-MIGRATED-${shiftId}`,
    type: 'shift',
    shiftId,
    openedAt,
    closedAt,
    currency: 'EGP',
    ordersCount: sortedOrders.length,
    cancelledOrdersCount: summary.cancelledOrders,
    salesWithoutDelivery: summary.salesExcludingDelivery,
    expensesTotal: 0,
    uncollectedTotal: summary.remainingToCollect,
    otherPaymentsTotal: summary.otherPayments,
    drawerNet: Number(summary.expectedDrawer.toFixed(2)),
    orders: sortedOrders,
  }
}

export async function archiveClosedShiftOrdersWithoutClosing(options: { pruneSettled?: boolean } = {}) {
  const [orders, closings, shifts] = await Promise.all([
    readServerOrders({ limit: 10000 }),
    readServerClosings(),
    readShifts(),
  ])
  const closedShiftIds = new Set(closings.map((closing) => closing.shiftId).filter(Boolean))
  const settledOrderIds = getSettledClosingIds(closings).orderIds
  const shiftsById = new Map(shifts.map((shift) => [shift.id, shift]))
  const byShiftId = new Map<string, TrackedOrder[]>()

  for (const order of orders) {
    const shiftId = order.shiftId
    if (!shiftId || closedShiftIds.has(shiftId) || settledOrderIds.has(order.id)) continue
    const shift = shiftsById.get(shiftId)
    if (!shift || isShiftActiveState(shift.state)) continue
    byShiftId.set(shiftId, [...(byShiftId.get(shiftId) || []), order])
  }

  const archived: ClosingRecord[] = []
  for (const [shiftId, shiftOrders] of byShiftId.entries()) {
    const closing = buildArchivedShiftClosing(shiftId, shiftOrders)
    await saveServerClosing(closing)
    if (options.pruneSettled) {
      await pruneSettledClosingItems(closing)
    }
    archived.push(closing)
  }

  return archived
}
