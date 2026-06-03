export type TrackingStatus =
  | 'placed'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_delivery'
  | 'out_for_delivery'
  | 'delivered'
  | 'received'
  | 'cancelled'

export interface TrackingEvent {
  status: TrackingStatus
  at: string
}

export type PaymentStatus =
  | 'cash_on_delivery'
  | 'receipt_uploaded'
  | 'paid'
  | 'pending'
  | 'rejected'

export interface OrderPayment {
  method: string
  status: PaymentStatus
  receiptName?: string
  receiptDataUrl?: string
  receiptUploadedAt?: string
}

export interface OrderDiscount {
  code: string
  type: 'percent' | 'fixed'
  value: number
  amount: number
}

export interface TrackedOrder {
  id: string
  source?: string
  externalReference?: string
  customer: string
  customerEmail?: string
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
  discount?: OrderDiscount
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
  { status: 'cancelled', ar: 'تم إلغاء الطلب', en: 'Cancelled' },
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

export function getTrackedOrdersForEmail(email?: string | null): TrackedOrder[] {
  const normalized = email?.trim().toLowerCase()
  const orders = getTrackedOrders()
  if (!normalized) return orders.filter((order) => !order.customerEmail)
  return orders.filter((order) => order.customerEmail?.toLowerCase() === normalized)
}

export function saveTrackedOrders(orders: TrackedOrder[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
}

function latestOrderTime(order: TrackedOrder) {
  const historyTime = order.history
    .map((event) => new Date(event.at).getTime())
    .filter((time) => !Number.isNaN(time))
    .sort((a, b) => b - a)[0]
  return historyTime || new Date(order.createdAt).getTime() || 0
}

export function syncTrackedOrdersFromServer(serverOrders: TrackedOrder[]) {
  if (typeof window === 'undefined') return serverOrders

  const localOrders = getTrackedOrders()
  const byId = new Map<string, TrackedOrder>()

  for (const order of localOrders) {
    byId.set(order.id.toLowerCase(), order)
  }

  for (const order of serverOrders) {
    const key = order.id.toLowerCase()
    const local = byId.get(key)
    byId.set(key, !local || latestOrderTime(order) >= latestOrderTime(local) ? order : local)
  }

  const merged = Array.from(byId.values()).sort((a, b) => latestOrderTime(b) - latestOrderTime(a))
  saveTrackedOrders(merged)
  return merged
}

export function syncTrackedOrdersForEmail(serverOrders: TrackedOrder[], email?: string | null) {
  const normalized = email?.trim().toLowerCase()
  const scopedOrders = normalized
    ? serverOrders.filter((order) => order.customerEmail?.toLowerCase() === normalized)
    : serverOrders.filter((order) => !order.customerEmail)

  return syncTrackedOrdersFromServer(scopedOrders).filter((order) =>
    normalized ? order.customerEmail?.toLowerCase() === normalized : !order.customerEmail
  )
}

export function upsertTrackedOrder(order: TrackedOrder) {
  const orders = getTrackedOrders()
  const updated = [order, ...orders.filter((item) => item.id.toLowerCase() !== order.id.toLowerCase())]
  saveTrackedOrders(updated)
  return order
}

export function deleteTrackedOrder(orderId: string) {
  const updated = getTrackedOrders().filter((order) => order.id.toLowerCase() !== orderId.toLowerCase())
  saveTrackedOrders(updated)
  return updated
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
