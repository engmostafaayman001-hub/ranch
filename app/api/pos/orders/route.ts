import { NextRequest } from 'next/server'
import { deleteServerOrder, readServerOrders, updateServerOrderStatus, upsertServerOrder } from '@/lib/server-orders'
import { PaymentStatus, TrackingStatus, trackingSteps, TrackedOrder } from '@/lib/order-tracking'

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

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders })
}

export async function GET() {
  try {
    const orders = await readServerOrders()
    return json({ orders })
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

    const order: TrackedOrder = {
      id,
      source: String(body.source || 'app'),
      externalReference: body.externalReference || body.posOrderId ? String(body.externalReference || body.posOrderId) : undefined,
      customer: String(customer.name || body.customerName || body.customer || 'Customer'),
      phone: String(customer.phone || body.phone || ''),
      address: String(customer.address || body.address || ''),
      total: Number(body.total || body.amount || body.grandTotal || 0),
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
    if (!validateOptionalApiKey(request)) {
      return json({ error: 'Invalid POS API key' }, { status: 401 })
    }

    const body = await request.json()
    const id = String(body.id || body.orderId || body.posOrderId || '')
    const status = normalizeTrackingStatus(body.status || body.state || body.orderStatus)

    if (!id || !isTrackingStatus(status)) {
      return json({ error: 'Invalid order id or status' }, { status: 400 })
    }

    const payment = body.payment && typeof body.payment === 'object' ? body.payment : {}
    const driver = body.driver && typeof body.driver === 'object'
      ? {
          name: String(body.driver.name || 'Pending assignment'),
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
    if (!validateOptionalApiKey(request)) {
      return json({ error: 'Invalid POS API key' }, { status: 401 })
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
