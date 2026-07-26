import { NextRequest } from 'next/server'
import { getRequestDashboardAccess } from '@/lib/server-access'
import { readServerClosings, saveServerClosing } from '@/lib/server-closings'
import { closeShift } from '@/lib/shifts'
import { getSettledClosingIds, type ClosingRecord } from '@/lib/closings'
import { readServerOrders } from '@/lib/server-orders'
import { readServerExpenses } from '@/lib/server-expenses'
import { summarizeClosingData } from '@/lib/financial-calculations'

export const runtime = 'nodejs'

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      ...init?.headers,
    },
  })
}

function isClosingRecord(value: unknown): value is ClosingRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<ClosingRecord>
  return Boolean(record.id && record.openedAt && record.closedAt)
}

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

async function enrichShiftClosing(record: ClosingRecord): Promise<ClosingRecord> {
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

function closingChanged(first: ClosingRecord, second: ClosingRecord) {
  return (
    (first.orders?.length || 0) !== (second.orders?.length || 0) ||
    (first.expenses?.length || 0) !== (second.expenses?.length || 0) ||
    first.ordersCount !== second.ordersCount ||
    first.cancelledOrdersCount !== second.cancelledOrdersCount ||
    first.expensesTotal !== second.expensesTotal ||
    first.drawerNet !== second.drawerNet
  )
}

export async function GET(request: NextRequest) {
  const access = await getRequestDashboardAccess(request)
  if (!access.allowed) return json({ error: 'Unauthorized' }, { status: 401 })

  const closings = await readServerClosings()
  const enrichedClosings: ClosingRecord[] = []

  for (const closing of closings) {
    const enriched = await enrichShiftClosing(closing)
    if (closingChanged(closing, enriched)) {
      await saveServerClosing(enriched)
    }
    enrichedClosings.push(enriched)
  }

  return json({ closings: enrichedClosings })
}

export async function POST(request: NextRequest) {
  const access = await getRequestDashboardAccess(request)
  if (!access.allowed) return json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const record = body.record || body.closing || body
  if (!isClosingRecord(record)) {
    return json({ error: 'invalid_closing', message: 'Closing record requires id, openedAt, and closedAt' }, { status: 400 })
  }

  const enrichedRecord = await enrichShiftClosing(record)
  const saved = await saveServerClosing(enrichedRecord)
  if (saved.shiftId) {
    await closeShift(saved.shiftId, saved.closedAt, access.email || access.name || null)
  }

  return json({ closing: saved }, { status: 201 })
}
