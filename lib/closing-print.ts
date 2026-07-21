import type { ReceiptPayload } from '@/lib/printer'
import type { TrackedOrder } from '@/lib/order-tracking'

type ClosingExpense = {
  id: string
  name: string
  amount: number
  date?: string
  note?: string
}

type ClosingPrintInput = {
  title: string
  dateLabel: string
  orders: TrackedOrder[]
  expenses: ClosingExpense[]
  revenue: number
  expenseTotal: number
  net: number
  paymentBreakdown: Record<string, number>
  paymentLabel: (method: string) => string
  currency: string
  isArabic: boolean
  invoiceName?: string
  invoiceAddress?: string
  invoicePhone?: string
  logoUrl?: string
  invoiceMessage?: string
}

function isCollectedDrawerOrder(order: TrackedOrder) {
  const method = String(order.payment?.method || '').toLowerCase()
  const status = String(order.payment?.status || '').toLowerCase()

  if (order.source === 'restaurant_pos') {
    return status === 'paid' || status === 'cash_on_delivery'
  }

  return method === 'cash' ? status === 'paid' : status === 'paid'
}

export function createClosingReceiptPayload(input: ClosingPrintInput): ReceiptPayload {
  const collectedOrders = input.orders.filter(isCollectedDrawerOrder)
  const completedOrders = input.orders.filter((order) => String(order.status || '').toLowerCase() !== 'cancelled')
  const cancelledOrders = input.orders.filter((order) => String(order.status || '').toLowerCase() === 'cancelled')
  const totalSalesToday = completedOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
  const restaurantSales = completedOrders
    .filter((order) => order.source === 'restaurant_pos')
    .reduce((sum, order) => sum + Number(order.total || 0), 0)
  const appSales = completedOrders
    .filter((order) => order.source !== 'restaurant_pos')
    .reduce((sum, order) => sum + Number(order.total || 0), 0)
  const discounts = completedOrders.reduce((sum, order) => sum + Number(order.discount?.amount || 0), 0)
  const deliveryFees = completedOrders.reduce((sum, order) => sum + Number(order.deliveryFee || 0), 0)
  const paymentEntries = Object.entries(input.paymentBreakdown)
    .sort(([, firstTotal], [, secondTotal]) => Number(secondTotal || 0) - Number(firstTotal || 0))
  const paymentTotals = paymentEntries.reduce((sum, [, total]) => sum + Number(total || 0), 0)
  const paymentCounts = collectedOrders.reduce<Record<string, number>>((totals, order) => {
    const method = order.payment?.method || 'cash'
    totals[method] = (totals[method] || 0) + 1
    return totals
  }, {})
  const paymentLines = paymentEntries.map(([method, total]) => ({
    name: `${input.paymentLabel(method)} (${paymentCounts[method] || 0} ${input.isArabic ? 'طلب' : 'orders'})`,
    quantity: 1,
    price: Number(total || 0),
  }))
  const expenseLines = input.expenses.map((expense) => ({
    name: expense.name,
    quantity: 1,
    price: Number(expense.amount || 0),
    notes: expense.note,
  }))

  return {
    orderId: `CLOSE-${input.dateLabel}`,
    orderType: input.title,
    createdAt: new Date().toISOString(),
    customer: {
      name: input.title,
      address: input.dateLabel,
      notes: [
        `${input.isArabic ? 'عدد الطلبات' : 'Orders'}: ${input.orders.length}`,
        `${input.isArabic ? 'طرق الدفع' : 'Payment methods'}: ${paymentEntries.length}`,
        `${input.isArabic ? 'عدد المصروفات' : 'Expenses'}: ${input.expenses.length}`,
      ].join(' | '),
    },
    lines: [
      { kind: 'section', hidePrice: true, name: input.isArabic ? 'ملخص التقفيل' : 'Closing Summary', quantity: 0 },
      { name: input.isArabic ? 'إجمالي المبيعات اليوم' : 'Total sales today', quantity: 1, price: totalSalesToday },
      { name: input.isArabic ? 'إجمالي مبيعات المطعم' : 'Total restaurant sales', quantity: 1, price: restaurantSales },
      { name: input.isArabic ? 'إجمالي مبيعات التطبيق' : 'Total app sales', quantity: 1, price: appSales },
      { name: input.isArabic ? 'إجمالي طرق الدفع' : 'Total payment methods', quantity: 1, price: paymentTotals },
      { name: input.isArabic ? 'إجمالي الخصومات' : 'Total discounts', quantity: 1, price: discounts },
      { name: input.isArabic ? 'إجمالي الطلبات الملغية' : 'Total cancelled orders', quantity: 1, price: cancelledOrders.length },
      { name: input.isArabic ? 'إجمالي خدمة التوصيل المحصلة' : 'Collected delivery service', quantity: 1, price: deliveryFees },
      { kind: 'section', hidePrice: true, name: input.isArabic ? 'طرق الدفع' : 'Payment Methods', quantity: 0 },
      ...(paymentLines.length ? paymentLines : [{ name: input.isArabic ? 'لا توجد مدفوعات' : 'No payments', quantity: 1, hidePrice: true }]),
      { kind: 'section', hidePrice: true, name: input.isArabic ? 'المصروفات' : 'Expenses', quantity: 0 },
      ...(expenseLines.length ? expenseLines : [{ name: input.isArabic ? 'لا توجد مصروفات' : 'No expenses', quantity: 1, hidePrice: true }]),
    ],
    subtotal: totalSalesToday,
    discountAmount: discounts,
    total: input.net,
    paymentMethod: paymentEntries.length
      ? paymentEntries.map(([method]) => input.paymentLabel(method)).join(' / ')
      : (input.isArabic ? 'لا توجد مدفوعات' : 'No payments'),
    currency: input.currency,
    invoiceName: input.invoiceName || input.title,
    invoiceAddress: input.invoiceAddress,
    invoicePhone: input.invoicePhone,
    invoiceMessage: input.isArabic ? 'تمت طباعة التقفيل من Baseeta POS' : 'Printed from Baseeta POS',
    logoUrl: input.logoUrl,
    isArabic: input.isArabic,
    summaryLabels: {
      subtotal: input.isArabic ? 'إجمالي المبيعات' : 'Gross Sales',
      discount: input.isArabic ? 'إجمالي الخصومات' : 'Total Discounts',
      total: input.isArabic ? 'صافي الدرج بعد كل شيء' : 'Final drawer net',
    },
  }
}
