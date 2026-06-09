import type { ReceiptLine, ReceiptPayload } from '@/lib/printer'
import type { TrackedOrder } from '@/lib/order-tracking'

export type DriverClosingGroup = {
  key: string
  name: string
  phone: string
  orders: TrackedOrder[]
  total: number
}

type DriverClosingPrintInput = {
  title: string
  dateLabel: string
  orders: TrackedOrder[]
  currency: string
  isArabic: boolean
  invoiceName?: string
  invoiceAddress?: string
  invoicePhone?: string
  logoUrl?: string
}

function driverAssigned(order: TrackedOrder) {
  const name = (order.driver?.name || '').trim()
  const phone = (order.driver?.phone || '').trim()
  return Boolean(name && name !== 'Pending assignment' && name !== '-' && (phone || order.driver?.email))
}

function isCashOnDelivery(order: TrackedOrder) {
  return order.payment?.status === 'cash_on_delivery' || (order.payment?.method || '').toLowerCase() === 'cash'
}

function driverKey(order: TrackedOrder) {
  return (order.driver?.email || order.driver?.phone || order.driver?.name || 'driver').trim().toLowerCase()
}

export function getDriverClosingGroups(orders: TrackedOrder[]): DriverClosingGroup[] {
  const groups = new Map<string, DriverClosingGroup>()
  for (const order of orders) {
    if (order.status === 'cancelled' || !driverAssigned(order) || !isCashOnDelivery(order)) continue
    const key = driverKey(order)
    const current = groups.get(key) || {
      key,
      name: order.driver.name,
      phone: order.driver.phone || '-',
      orders: [],
      total: 0,
    }
    current.orders.push(order)
    current.total += Number(order.total || 0)
    groups.set(key, current)
  }

  return Array.from(groups.values()).sort((first, second) => second.total - first.total)
}

export function createDriverClosingReceiptPayload(input: DriverClosingPrintInput): ReceiptPayload {
  const groups = getDriverClosingGroups(input.orders)
  const grandTotal = groups.reduce((sum, group) => sum + group.total, 0)
  const orderCount = groups.reduce((sum, group) => sum + group.orders.length, 0)
  const lines: ReceiptLine[] = [
    { kind: 'section', hidePrice: true, name: input.isArabic ? 'ملخص تحصيل السائقين' : 'Driver Collection Summary', quantity: 0 },
    { name: input.isArabic ? 'عدد السائقين' : 'Drivers count', quantity: groups.length, hidePrice: true },
    { name: input.isArabic ? 'عدد طلبات عند الاستلام' : 'COD orders count', quantity: orderCount, hidePrice: true },
  ]

  for (const group of groups) {
    lines.push({ kind: 'section', hidePrice: true, name: `${group.name} - ${group.phone}`, quantity: 0 })
    for (const order of group.orders) {
      lines.push({
        name: `${input.isArabic ? 'طلب' : 'Order'} ${order.id} - ${order.customer || '-'}`,
        quantity: 1,
        price: Number(order.total || 0),
        notes: order.phone || order.address ? [order.phone, order.address].filter(Boolean).join(' - ') : undefined,
      })
    }
    lines.push({
      name: `${input.isArabic ? 'إجمالي' : 'Total'} ${group.name}`,
      quantity: 1,
      price: group.total,
    })
  }

  if (!groups.length) {
    lines.push({
      name: input.isArabic ? 'لا توجد طلبات دفع عند الاستلام معيّنة لسائقين في هذا اليوم' : 'No assigned cash-on-delivery orders for this day',
      quantity: 1,
      hidePrice: true,
    })
  }

  return {
    orderId: `DRIVERS-${input.dateLabel}`,
    orderType: input.title,
    createdAt: new Date().toISOString(),
    customer: {
      name: input.title,
      address: input.dateLabel,
      notes: `${input.isArabic ? 'السائقين' : 'Drivers'}: ${groups.length} | ${input.isArabic ? 'الطلبات' : 'Orders'}: ${orderCount}`,
    },
    lines,
    subtotal: grandTotal,
    tax: 0,
    discountAmount: 0,
    total: grandTotal,
    paymentMethod: input.isArabic ? 'الدفع عند الاستلام' : 'Cash on delivery',
    currency: input.currency,
    invoiceName: input.invoiceName || input.title,
    invoiceAddress: input.invoiceAddress,
    invoicePhone: input.invoicePhone,
    invoiceMessage: input.isArabic ? 'تقرير تحصيل السائقين' : 'Driver collection report',
    logoUrl: input.logoUrl,
    isArabic: input.isArabic,
    summaryLabels: {
      subtotal: input.isArabic ? 'إجمالي التحصيل' : 'Collection total',
      tax: input.isArabic ? 'إضافات' : 'Extras',
      discount: input.isArabic ? 'خصومات' : 'Discounts',
      total: input.isArabic ? 'إجمالي السائقين' : 'Drivers total',
    },
  }
}
