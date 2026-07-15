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

export interface OrderLine {
  name: string
  quantity: number
  price?: number
  notes?: string
  additions?: string[]
  categoryName?: string
  categoryId?: string
}

export interface TrackedOrder {
  id: string
  source?: string
  externalReference?: string
  customer: string
  customerEmail?: string
  phone: string
  address: string
  notes?: string
  subtotal?: number
  tax?: number
  deliveryFee?: number
  total: number
  items: number
  lines?: OrderLine[]
  status: TrackingStatus
  createdAt: string
  estimatedDelivery: string
  driver: {
    name: string
    email?: string
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
const MAX_LOCAL_TRACKED_ORDERS = 50

function compactTrackedOrder(order: TrackedOrder): TrackedOrder {
  return {
    ...order,
    payment: order.payment
      ? {
          ...order.payment,
          receiptDataUrl: undefined,
        }
      : order.payment,
    history: order.history.slice(-12),
  }
}

function compactTrackedOrders(orders: TrackedOrder[], limit = MAX_LOCAL_TRACKED_ORDERS) {
  return orders
    .map(compactTrackedOrder)
    .sort((a, b) => latestOrderTime(b) - latestOrderTime(a))
    .slice(0, limit)
}

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
  if (typeof window === 'undefined') return

  let compacted = compactTrackedOrders(orders)
  while (compacted.length >= 0) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(compacted))
      return
    } catch (error) {
      if (!(error instanceof DOMException) || !['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'].includes(error.name)) {
        throw error
      }
      if (compacted.length === 0) {
        localStorage.removeItem(STORAGE_KEY)
        return
      }
      compacted = compacted.slice(0, Math.max(0, Math.floor(compacted.length / 2)))
    }
  }
}

function latestOrderTime(order: TrackedOrder) {
  const historyTime = order.history
    .map((event) => new Date(event.at).getTime())
    .filter((time) => !Number.isNaN(time))
    .sort((a, b) => b - a)[0]
  return historyTime || new Date(order.createdAt).getTime() || 0
}

export function syncTrackedOrdersFromServer(serverOrders: TrackedOrder[]) {
  const serverOnly = serverOrders.slice().sort((a, b) => latestOrderTime(b) - latestOrderTime(a))
  saveTrackedOrders(serverOnly)
  return serverOnly
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
  const updated = [compactTrackedOrder(order), ...orders.filter((item) => item.id.toLowerCase() !== order.id.toLowerCase())]
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
  const updated = [compactTrackedOrder(created), ...orders.filter((item) => item.id !== created.id)]
  saveTrackedOrders(updated)
  return created
}
