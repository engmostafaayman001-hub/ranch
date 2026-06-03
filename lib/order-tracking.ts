export type TrackingStatus =
  | 'placed'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_delivery'
  | 'out_for_delivery'
  | 'delivered'
  | 'received'

export interface TrackingEvent {
  status: TrackingStatus
  at: string
}

export type PaymentStatus =
  | 'cash_on_delivery'
  | 'receipt_uploaded'
  | 'paid'
  | 'pending'

export interface OrderPayment {
  method: string
  status: PaymentStatus
  receiptName?: string
  receiptDataUrl?: string
  receiptUploadedAt?: string
}

export interface TrackedOrder {
  id: string
  customer: string
  phone: string
  address: string
  total: number
  items: number
  status: TrackingStatus
  createdAt: string
  estimatedDelivery: string
  driver: {
    name: string
    phone: string
    rating: number
  }
  payment?: OrderPayment
  history: TrackingEvent[]
}

export const trackingSteps: { status: TrackingStatus; ar: string; en: string }[] = [
  { status: 'placed', ar: 'تم إنشاء الطلب', en: 'Order Placed' },
  { status: 'confirmed', ar: 'تم تأكيد الطلب', en: 'Order Confirmed' },
  { status: 'preparing', ar: 'جاري التحضير', en: 'Preparing' },
  { status: 'ready_for_delivery', ar: 'جاهز للتوصيل', en: 'Ready for Delivery' },
  { status: 'out_for_delivery', ar: 'في الطريق', en: 'Out for Delivery' },
  { status: 'delivered', ar: 'تم التسليم', en: 'Delivered' },
  { status: 'received', ar: 'تم الاستلام', en: 'Received' },
]

export const statusLabels = Object.fromEntries(
  trackingSteps.map((step) => [step.status, { ar: step.ar, en: step.en }])
) as Record<TrackingStatus, { ar: string; en: string }>

export const initialTrackedOrders: TrackedOrder[] = []

const STORAGE_KEY = 'trackedOrders'

export function getStatusIndex(status: TrackingStatus) {
  return trackingSteps.findIndex((step) => step.status === status)
}

export function getTrackedOrders(): TrackedOrder[] {
  if (typeof window === 'undefined') return initialTrackedOrders

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialTrackedOrders))
      return initialTrackedOrders
    }
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed : initialTrackedOrders
  } catch {
    return initialTrackedOrders
  }
}

export function saveTrackedOrders(orders: TrackedOrder[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
}

export function updateTrackedOrderStatus(orderId: string, status: TrackingStatus) {
  const orders = getTrackedOrders()
  const now = new Date().toISOString()
  const updated = orders.map((order) => {
    if (order.id !== orderId) return order

    const history = order.history.some((event) => event.status === status)
      ? order.history
      : [...order.history, { status, at: now }]

    return { ...order, status, history }
  })

  saveTrackedOrders(updated)
  return updated
}

export function findTrackedOrder(orderId: string) {
  return getTrackedOrders().find((order) => order.id.toLowerCase() === orderId.toLowerCase())
}

export function createTrackedOrder(order: Omit<TrackedOrder, 'history'>) {
  const orders = getTrackedOrders()
  const created: TrackedOrder = {
    ...order,
    history: [{ status: order.status, at: order.createdAt }],
  }
  const updated = [created, ...orders.filter((item) => item.id !== created.id)]
  saveTrackedOrders(updated)
  return created
}
