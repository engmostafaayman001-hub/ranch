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
}

export function createClosingReceiptPayload(input: ClosingPrintInput): ReceiptPayload {
  const collectedOrders = input.orders.filter((order) => String(order.payment?.method || '').toLowerCase() === 'cash' && String(order.payment?.status || '').toLowerCase() === 'paid')
  const adjustedSales = collectedOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
  const orderBaseSales = collectedOrders.reduce((sum, order) => {
    if (typeof order.subtotal === 'number' && Number.isFinite(order.subtotal)) return sum + Number(order.subtotal || 0)
    return sum + Math.max(0, Number(order.total || 0) - Number(order.deliveryFee || 0) - Number(order.tax || 0) + Number(order.discount?.amount || 0))
  }, 0)
  const deliveryFees = collectedOrders.reduce((sum, order) => sum + Number(order.deliveryFee || 0), 0)
  const paymentCounts = collectedOrders.reduce<Record<string, number>>((totals, order) => {
    const method = order.payment?.method || 'cash'
    totals[method] = (totals[method] || 0) + 1
    return totals
  }, {})
  const paymentEntries = Object.entries(input.paymentBreakdown)
    .sort(([, firstTotal], [, secondTotal]) => Number(secondTotal || 0) - Number(firstTotal || 0))
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
  const orderLines = input.orders.map((order) => ({
    name: `${input.isArabic ? 'طلب' : 'Order'} ${order.id} - ${order.customer || '-'}`,
    quantity: 1,
    price: Number(order.total || 0),
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
      { name: input.isArabic ? 'إجمالي المحصل في الدرج' : 'Collected drawer revenue', quantity: 1, price: adjustedSales },
      { name: input.isArabic ? 'إجمالي المبيعات بدون توصيل وخصم وضريبة' : 'Sales before delivery, discount and tax', quantity: 1, price: orderBaseSales },
      { name: input.isArabic ? 'إجمالي خدمة التوصيل المحصلة' : 'Collected delivery service', quantity: 1, price: deliveryFees },
      { name: input.isArabic ? 'إجمالي المصروفات' : 'Expenses total', quantity: 1, price: input.expenseTotal },
      { name: input.isArabic ? 'إجمالي صافي الدرج بعد كل الخصومات والضريبة والمصروفات' : 'Cash drawer net after discounts, tax and expenses', quantity: 1, price: input.net },
      { name: `${input.isArabic ? 'عدد الطلبات' : 'Orders count'}: ${input.orders.length}`, quantity: 1, hidePrice: true },
      { kind: 'section', hidePrice: true, name: input.isArabic ? 'طرق الدفع' : 'Payment Methods', quantity: 0 },
      ...(paymentLines.length ? paymentLines : [{ name: input.isArabic ? 'لا توجد مدفوعات' : 'No payments', quantity: 1, hidePrice: true }]),
      { kind: 'section', hidePrice: true, name: input.isArabic ? 'المصروفات' : 'Expenses', quantity: 0 },
      ...(expenseLines.length ? expenseLines : [{ name: input.isArabic ? 'لا توجد مصروفات' : 'No expenses', quantity: 1, hidePrice: true }]),
      { kind: 'section', hidePrice: true, name: input.isArabic ? 'الطلبات' : 'Orders', quantity: 0 },
      ...(orderLines.length ? orderLines : [{ name: input.isArabic ? 'لا توجد طلبات' : 'No orders', quantity: 1, hidePrice: true }]),
    ],
    subtotal: adjustedSales,
    discountAmount: input.expenseTotal,
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
      subtotal: input.isArabic ? 'صافي المبيعات بعد الخصم والضريبة والتوصيل' : 'Net sales after discount, tax and delivery',
      discount: input.isArabic ? 'المصروفات' : 'Expenses',
      total: input.isArabic ? 'صافي الدرج بعد كل شيء' : 'Final drawer net',
    },
  }
}
