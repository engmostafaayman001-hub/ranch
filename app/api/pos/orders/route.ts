import { NextRequest } from 'next/server'
import { deleteServerOrder, readServerOrders, updateServerOrderStatus, upsertServerOrder } from '@/lib/server-orders'
import { PaymentStatus, TrackingStatus, trackingSteps, TrackedOrder } from '@/lib/order-tracking'
import { getRequestDashboardAccess, getRequestUserEmail } from '@/lib/server-access'
import { validateNotificationDiscount } from '@/lib/discounts'
import { readServerNotifications } from '@/lib/server-notifications'

export const runtime = 'nodejs'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-POS-API-Key',
}

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      ...init?.headers,
    },
  })
}

function isTrackingStatus(status: string): status is TrackingStatus {
  return trackingSteps.some((step) => step.status === status)
}

function isPaymentStatus(status: string): status is PaymentStatus {
  return ['cash_on_delivery', 'receipt_uploaded', 'paid', 'pending', 'rejected'].includes(status)
}

function getConfiguredApiKeys() {
  return (process.env.RANCH_POS_API_KEYS || process.env.POS_API_KEYS || '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean)
}

function getRequestApiKey(request: NextRequest) {
  const authorization = request.headers.get('authorization') || ''
  return (
    request.headers.get('x-pos-api-key') ||
    request.headers.get('x-api-key') ||
    authorization.replace(/^Bearer\s+/i, '').trim()
  )
}

function validateOptionalApiKey(request: NextRequest) {
  const configuredKeys = getConfiguredApiKeys()
  const providedKey = getRequestApiKey(request)

  if (!providedKey) return true
  return configuredKeys.length > 0 && configuredKeys.includes(providedKey)
}

function normalizeMatchValue(value?: string | null) {
  return String(value || '').trim().toLowerCase()
}

function isOrderAssignedToDelivery(order: TrackedOrder, access: { email: string | null; name: string | null }) {
  const email = normalizeMatchValue(access.email)
  const name = normalizeMatchValue(access.name)
  const driverEmail = normalizeMatchValue(order.driver?.email)
  const driverName = normalizeMatchValue(order.driver?.name)

  return Boolean(
    (email && driverEmail === email) ||
      (name && driverName === name) ||
      (email && driverName === email.split('@')[0])
  )
}

function normalizeTrackingStatus(value: unknown): TrackingStatus {
  const raw = String(value || 'placed').toLowerCase()
  const aliases: Record<string, TrackingStatus> = {
    new: 'placed',
    pending: 'placed',
    accepted: 'confirmed',
    cooking: 'preparing',
    ready: 'ready_for_delivery',
    dispatched: 'out_for_delivery',
    delivering: 'out_for_delivery',
    completed: 'delivered',
    done: 'received',
    picked_up: 'received',
    cancelled: 'cancelled',
    canceled: 'cancelled',
    rejected: 'cancelled',
  }
  const normalized = aliases[raw] || raw
  return isTrackingStatus(normalized) ? normalized : 'placed'
}

function normalizePaymentStatus(value: unknown, method: string): PaymentStatus {
  const raw = String(value || '').toLowerCase()
  if (isPaymentStatus(raw)) return raw
  if (raw === 'captured' || raw === 'completed') return 'paid'
  if (method === 'cash') return 'cash_on_delivery'
  return 'pending'
}

function getOrderSubtotal(body: Record<string, unknown>) {
  if (Array.isArray(body.lines)) {
    const linesTotal = body.lines.reduce((sum, line) => {
      if (!line || typeof line !== 'object') return sum
      const item = line as Record<string, unknown>
      return sum + Number(item.price || 0) * Number(item.quantity || 0)
    }, 0)
    if (linesTotal > 0) return linesTotal
  }

  return Number(body.subtotal || body.itemsTotal || body.amount || body.total || 0)
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders })
}

export async function GET(request: NextRequest) {
  try {
    const userEmail = getRequestUserEmail(request)
    const access = await getRequestDashboardAccess(request)
    const isAdmin = access.allowed
    const orders = await readServerOrders()

    if (access.role === 'delivery') {
      return json({ orders: orders.filter((order) => order.source !== 'restaurant_pos' && isOrderAssignedToDelivery(order, access)) })
    }

    if (isAdmin) return json({ orders })
    if (!userEmail) return json({ orders: [] })

    return json({
      orders: orders.filter((order) => order.customerEmail?.toLowerCase() === userEmail),
    })
  } catch (error) {
    console.error('Failed to read POS orders:', error)
    return json({ error: 'Could not load orders', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!validateOptionalApiKey(request)) {
      return json({ error: 'Invalid POS API key' }, { status: 401 })
    }

    const body = await request.json()
    const now = new Date().toISOString()
    const id = String(body.id || body.orderId || body.posOrderId || body.externalReference || `ORD${Date.now()}`)
    const status = normalizeTrackingStatus(body.status || body.state || body.orderStatus)
    const customer = body.customer && typeof body.customer === 'object' ? body.customer : {}
    const payment = body.payment && typeof body.payment === 'object' ? body.payment : {}
    const paymentMethod = String(payment.method || body.paymentMethod || body.payMethod || 'cash')
    const customerEmail = String(customer.email || body.customerEmail || body.email || '').toLowerCase()
    const requestEmail = getRequestUserEmail(request)
    const hasValidPosKey = getRequestApiKey(request) ? validateOptionalApiKey(request) : false
    const isAdmin = (await getRequestDashboardAccess(request)).allowed

    if (!hasValidPosKey && !isAdmin && (!requestEmail || requestEmail !== customerEmail)) {
      return json({ error: 'You can only create orders for your signed-in account' }, { status: 403 })
    }

    const subtotal = getOrderSubtotal(body)
    const tax = Math.max(0, Number(body.tax || 0))
    const deliveryFee = Math.max(0, Number(body.deliveryFee || body.delivery || 0))
    const discountCode = String(body.discountCode || body.discount?.code || '').trim()
    let discount: TrackedOrder['discount'] | undefined

    if (discountCode) {
      const notifications = await readServerNotifications()
      const result = validateNotificationDiscount(notifications, discountCode, subtotal)
      if (!result.valid) {
        return json({ error: result.reason }, { status: 400 })
      }
      discount = {
        code: result.code,
        type: result.discountType,
        value: result.discountValue,
        amount: Number(result.discountAmount.toFixed(2)),
      }
    }

    const calculatedTotal = subtotal + tax + deliveryFee - (discount?.amount || 0)
    const finalTotal = Math.max(0, Number(calculatedTotal.toFixed(2)))

    const order: TrackedOrder = {
      id,
      source: String(body.source || 'app'),
      externalReference: body.externalReference || body.posOrderId ? String(body.externalReference || body.posOrderId) : undefined,
      customer: String(customer.name || body.customerName || body.customer || 'Customer'),
      customerEmail,
      phone: String(customer.phone || body.phone || ''),
      address: String(customer.address || body.address || ''),
      notes: String(customer.notes || body.notes || body.note || '').trim() || undefined,
      total: finalTotal,
      items: Number(body.items || body.itemsCount || body.lines?.length || 0),
      status,
      createdAt: String(body.createdAt || now),
      estimatedDelivery: String(body.estimatedDelivery || '30 min'),
      driver: {
        name: String(body.driver?.name || 'Pending assignment'),
        phone: String(body.driver?.phone || '-'),
        rating: Number(body.driver?.rating || 0),
      },
      payment: {
        method: paymentMethod,
        status: normalizePaymentStatus(payment.status || body.paymentStatus, paymentMethod),
        receiptName: payment.receiptName ? String(payment.receiptName) : undefined,
        receiptDataUrl: payment.receiptDataUrl ? String(payment.receiptDataUrl) : undefined,
        receiptUploadedAt: payment.receiptUploadedAt ? String(payment.receiptUploadedAt) : undefined,
      },
      discount,
      history: Array.isArray(body.history) && body.history.length > 0
        ? body.history
        : [{ status, at: String(body.createdAt || now) }],
    }

    await upsertServerOrder(order)
    return json({ order }, { status: 201 })
  } catch (error) {
    console.error('Failed to create POS order:', error)
    return json({ error: 'Could not create order', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const hasValidPosKey = getRequestApiKey(request) ? validateOptionalApiKey(request) : false
    const access = await getRequestDashboardAccess(request)
    const isAdmin = access.allowed
    if (!hasValidPosKey && !isAdmin) {
      return json({ error: 'Invalid POS API key' }, { status: 401 })
    }

    const body = await request.json()
    const id = String(body.id || body.orderId || body.posOrderId || '')
    const status = normalizeTrackingStatus(body.status || body.state || body.orderStatus)

    if (!id || !isTrackingStatus(status)) {
      return json({ error: 'Invalid order id or status' }, { status: 400 })
    }

    if (access.role === 'delivery') {
      const orders = await readServerOrders()
      const existing = orders.find((order) => order.id.toLowerCase() === id.toLowerCase())
      if (!existing || existing.source === 'restaurant_pos' || !isOrderAssignedToDelivery(existing, access)) {
        return json({ error: 'Forbidden' }, { status: 403 })
      }
      if (body.driver || body.payment || body.paymentStatus) {
        return json({ error: 'Delivery users can only update assigned order status' }, { status: 403 })
      }
    }

    const payment = body.payment && typeof body.payment === 'object' ? body.payment : {}
    const driver = body.driver && typeof body.driver === 'object'
      ? {
          name: String(body.driver.name || 'Pending assignment'),
          email: String(body.driver.email || ''),
          phone: String(body.driver.phone || '-'),
          rating: Number(body.driver.rating || 0),
        }
      : undefined
    const paymentStatus = body.paymentStatus || payment.status

    const order = await updateServerOrderStatus(id, status, {
      driver,
      payment: paymentStatus ? { status: normalizePaymentStatus(paymentStatus, String(payment.method || 'cash')) } : undefined,
    })

    if (!order) {
      return json({ error: 'Order not found' }, { status: 404 })
    }

    return json({ order })
  } catch (error) {
    console.error('Failed to update POS order:', error)
    return json({ error: 'Could not update order', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const hasValidPosKey = getRequestApiKey(request) ? validateOptionalApiKey(request) : false
    const access = await getRequestDashboardAccess(request)
    const isAdmin = access.allowed
    if (!hasValidPosKey && !isAdmin) {
      return json({ error: 'Invalid POS API key' }, { status: 401 })
    }

    if (access.role === 'delivery' && !hasValidPosKey) {
      return json({ error: 'Delivery users cannot delete orders' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const id = String(body.id || body.orderId || body.posOrderId || '')

    if (!id) {
      return json({ error: 'Order id is required' }, { status: 400 })
    }

    const deleted = await deleteServerOrder(id)
    if (!deleted) {
      return json({ error: 'Order not found' }, { status: 404 })
    }

    return json({ deleted: true, id })
  } catch (error) {
    console.error('Failed to delete POS order:', error)
    return json({ error: 'Could not delete order', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
