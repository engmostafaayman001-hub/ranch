import type { TrackedOrder } from '@/lib/order-tracking'

export type DiscountType = 'percent' | 'fixed'

export interface OrderFinancials {
  discountType: DiscountType
  discountValue: number
  discountAmount: number
  subtotalAfterDiscount: number
  total: number
}

export interface ClosingFinancialSummary {
  grossSales: number
  salesExcludingDelivery: number
  deliveryRevenue: number
  totalDiscounts: number
  appDiscounts: number
  restaurantDiscounts: number
  netSales: number
  completedOrders: number
  cancelledOrders: number
  averageOrderValue: number
  cashSales: number
  cardSales: number
  otherPayments: number
  expenses: number
  collectedDrawerRevenue: number
  remainingToCollect: number
  expectedDrawer: number
  actualDrawer: number
  drawerDifference: number
}

function normalizeDiscountType(discountType: string | undefined) {
  return discountType === 'fixed' ? 'fixed' : 'percent'
}

export function calculateOrderFinancials({
  subtotal,
  tax,
  deliveryFee,
  discountType,
  discountValue,
}: {
  subtotal: number
  tax?: number
  deliveryFee?: number
  discountType?: string
  discountValue?: number
}) {
  const safeSubtotal = Math.max(0, Number(subtotal || 0))
  const safeTax = Math.max(0, Number(tax || 0))
  const safeDeliveryFee = Math.max(0, Number(deliveryFee || 0))
  const normalizedType = normalizeDiscountType(discountType)
  const rawValue = Math.max(0, Number(discountValue || 0))
  const safeValue = normalizedType === 'percent' ? Math.min(rawValue, 100) : rawValue

  let discountAmount = 0
  if (normalizedType === 'percent') {
    discountAmount = safeSubtotal * (safeValue / 100)
  } else {
    discountAmount = Math.min(safeSubtotal, safeValue)
  }

  discountAmount = Math.min(safeSubtotal, Math.max(0, Number(discountAmount.toFixed(2))))
  const subtotalAfterDiscount = Math.max(0, Number((safeSubtotal - discountAmount).toFixed(2)))
  const total = Number((subtotalAfterDiscount + safeTax + safeDeliveryFee).toFixed(2))

  return {
    discountType: normalizedType,
    discountValue: safeValue,
    discountAmount,
    subtotalAfterDiscount,
    total,
  } satisfies OrderFinancials
}

export function isCollectedDrawerOrder(order: TrackedOrder) {
  const status = String(order.payment?.status || '').toLowerCase()
  if (order.source === 'restaurant_pos') {
    return status === 'paid' || status === 'cash_on_delivery'
  }

  // App orders are collected if paid, or if they are cash on delivery.
  return status === 'paid' || status === 'cash_on_delivery'
}

function getOrderDiscountAmount(order: TrackedOrder) {
  if (typeof order.discount?.amount === 'number' && Number.isFinite(order.discount.amount)) {
    return Math.max(0, Number(order.discount.amount || 0))
  }

  const subtotalValue = Number(order.subtotal || 0)
  const taxValue = Number(order.tax || 0)
  const deliveryValue = Number(order.deliveryFee || 0)
  const totalValue = Number(order.total || 0)
  if (subtotalValue > 0 || taxValue > 0 || deliveryValue > 0 || totalValue > 0) {
    const grossValue = subtotalValue + taxValue + deliveryValue
    const estimatedNet = totalValue > 0 ? totalValue : grossValue
    return Math.max(0, Number((grossValue - estimatedNet).toFixed(2)))
  }

  return 0
}

function getOrderGrossSales(order: TrackedOrder) {
  const subtotalValue = Number(order.subtotal || 0)
  const taxValue = Number(order.tax || 0)
  const deliveryValue = Number(order.deliveryFee || 0)
  const discountAmount = getOrderDiscountAmount(order)
  return Number((subtotalValue + taxValue + deliveryValue + discountAmount).toFixed(2))
}

function getOrderSalesExcludingDelivery(order: TrackedOrder) {
  return Number((getOrderGrossSales(order) - Number(order.deliveryFee || 0)).toFixed(2))
}

function getOrderNetSales(order: TrackedOrder) {
  const discountAmount = getOrderDiscountAmount(order)
  return Math.max(0, Number((getOrderSalesExcludingDelivery(order) - discountAmount).toFixed(2)))
}

function getOrderPaymentMethod(order: TrackedOrder) {
  return String(order.payment?.method || '').toLowerCase()
}

export function summarizeClosingData(orders: TrackedOrder[], expenses: Array<{ amount?: number }>): ClosingFinancialSummary {
  const completedOrders = orders.filter((order) => order.status !== 'cancelled')
  const cancelledOrders = orders.filter((order) => order.status === 'cancelled')

  const grossSales = completedOrders.reduce((sum, order) => sum + getOrderGrossSales(order), 0)
  const salesExcludingDelivery = completedOrders.reduce((sum, order) => sum + getOrderSalesExcludingDelivery(order), 0)
  const deliveryRevenue = completedOrders.reduce((sum, order) => sum + Number(order.deliveryFee || 0), 0)

  const appDiscounts = completedOrders
    .filter((order) => order.source !== 'restaurant_pos')
    .reduce((sum, order) => sum + getOrderDiscountAmount(order), 0)

  const restaurantDiscounts = completedOrders
    .filter((order) => order.source === 'restaurant_pos')
    .reduce((sum, order) => sum + getOrderDiscountAmount(order), 0)

  const totalDiscounts = appDiscounts + restaurantDiscounts
  const netSales = completedOrders.reduce((sum, order) => sum + getOrderNetSales(order), 0)

  const cashSales = completedOrders.reduce((sum, order) => {
    const method = getOrderPaymentMethod(order)
    return method === 'cash' ? sum + getOrderNetSales(order) : sum
  }, 0)
  const cardSales = completedOrders.reduce((sum, order) => {
    const method = getOrderPaymentMethod(order)
    return ['card', 'visa', 'mastercard', 'mada'].includes(method) ? sum + getOrderNetSales(order) : sum
  }, 0)
  const otherPayments = completedOrders.reduce((sum, order) => {
    const method = getOrderPaymentMethod(order)
    if (method === 'cash' || ['card', 'visa', 'mastercard', 'mada'].includes(method)) return sum
    return sum + getOrderNetSales(order)
  }, 0)

  const expensesTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  const collectedDrawerRevenue = completedOrders.reduce((sum, order) => (isCollectedDrawerOrder(order) ? sum + getOrderNetSales(order) : sum), 0)
  const remainingToCollect = completedOrders.reduce((sum, order) => {
    const method = getOrderPaymentMethod(order)
    const status = String(order.payment?.status || '').toLowerCase()
    return status === 'cash_on_delivery' && method === 'cash' ? sum + getOrderNetSales(order) : sum
  }, 0)

  const expectedDrawer = Math.max(0, Number((collectedDrawerRevenue - expensesTotal).toFixed(2)))
  const actualDrawer = expectedDrawer
  const drawerDifference = Number((actualDrawer - expectedDrawer).toFixed(2))

  return {
    grossSales: Number(grossSales.toFixed(2)),
    salesExcludingDelivery: Number(salesExcludingDelivery.toFixed(2)),
    deliveryRevenue: Number(deliveryRevenue.toFixed(2)),
    totalDiscounts: Number(totalDiscounts.toFixed(2)),
    appDiscounts: Number(appDiscounts.toFixed(2)),
    restaurantDiscounts: Number(restaurantDiscounts.toFixed(2)),
    netSales: Number(netSales.toFixed(2)),
    completedOrders: completedOrders.length,
    cancelledOrders: cancelledOrders.length,
    averageOrderValue: completedOrders.length > 0 ? Number((grossSales / completedOrders.length).toFixed(2)) : 0,
    cashSales: Number(cashSales.toFixed(2)),
    cardSales: Number(cardSales.toFixed(2)),
    otherPayments: Number(otherPayments.toFixed(2)),
    expenses: Number(expensesTotal.toFixed(2)),
    collectedDrawerRevenue: Number(collectedDrawerRevenue.toFixed(2)),
    remainingToCollect: Number(remainingToCollect.toFixed(2)),
    expectedDrawer,
    actualDrawer,
    drawerDifference,
  }
}
