import { getShift } from '@/lib/shifts'
import { readServerExpenses } from '@/lib/server-expenses'
import { readServerOrders } from '@/lib/server-orders'
import { summarizeClosingData } from '@/lib/financial-calculations'

export interface ClosingReport {
  grossSales: number
  netSales: number
  productSales: number
  deliveryRevenue: number
  totalDiscounts: number
  totalOrders: number
  completedOrders: number
  cancelledOrders: number
  applicationOrders: number
  openingCash: number
  expectedDrawer: number
  actualDrawer: number
  drawerDifference: number
  expenses: number
  netRevenue: number
  finalDrawerBalance: number
  paymentMethods: {
    cash: number
    card: number
    bankTransfer: number
    application: number
    other: number
  }
}

export async function generateClosingReport(shiftId: string): Promise<ClosingReport> {
  const orders = await readServerOrders({ shiftId, limit: 1000, includeReceipts: true })
  const expenses = await readServerExpenses({ shiftId })
  const expensesTotal = expenses.reduce((sum, exp) => sum + exp.amount, 0)

  const shift = await getShift(shiftId)
  const openingCash = shift?.openingBalance || 0
  const summary = summarizeClosingData(orders, expenses)

  const completedOrders = orders.filter((order) => order.status !== 'cancelled')
  const paymentMethods = completedOrders.reduce(
    (totals, order) => {
      const method = String(order.payment?.method || 'cash').toLowerCase()
      const amount = Number(order.total || 0)
      if (method === 'cash') totals.cash += amount
      else if (['card', 'visa', 'mastercard', 'mada'].includes(method)) totals.card += amount
      else if (method === 'bank_transfer' || method === 'banktransfer') totals.bankTransfer += amount
      else if (['vodafone_cash', 'instapay'].includes(method)) totals.application += amount
      else totals.other += amount
      return totals
    },
    { cash: 0, card: 0, bankTransfer: 0, application: 0, other: 0 }
  )

  const expectedDrawer = openingCash + summary.expectedDrawer
  const netRevenue = summary.netSales - expensesTotal

  return {
    grossSales: summary.grossSales,
    netSales: summary.netSales,
    productSales: summary.salesExcludingDelivery,
    deliveryRevenue: summary.deliveryRevenue,
    totalDiscounts: summary.totalDiscounts,
    totalOrders: orders.length,
    completedOrders: summary.completedOrders,
    cancelledOrders: summary.cancelledOrders,
    applicationOrders: completedOrders.filter((order) => order.source !== 'restaurant_pos').length,
    openingCash: openingCash,
    expectedDrawer: expectedDrawer,
    actualDrawer: expectedDrawer,
    drawerDifference: 0,
    expenses: expensesTotal,
    netRevenue: netRevenue,
    finalDrawerBalance: expectedDrawer,
    paymentMethods: {
      cash: paymentMethods.cash,
      card: paymentMethods.card,
      bankTransfer: paymentMethods.bankTransfer,
      application: paymentMethods.application,
      other: paymentMethods.other,
    },
  }
}
