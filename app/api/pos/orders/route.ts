import { NextRequest } from 'next/server'
import { readServerOrders, updateServerOrderStatus, upsertServerOrder } from '@/lib/server-orders'
import { PaymentStatus, TrackingStatus, trackingSteps, TrackedOrder } from '@/lib/order-tracking'

export const runtime = 'nodejs'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: {
      ...corsHeaders,
      ...init?.headers,
    },
  })
}

function isTrackingStatus(status: string): status is TrackingStatus {
  return trackingSteps.some((step) => step.status === status)
}

function isPaymentStatus(status: string): status is PaymentStatus {
  return ['cash_on_delivery', 'receipt_uploaded', 'paid', 'pending'].includes(status)
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
    const body = await request.json()
    const now = new Date().toISOString()
    const id = String(body.id || `ORD${Date.now()}`)
    const requestedStatus = String(body.status || 'placed')
    const status = isTrackingStatus(requestedStatus) ? requestedStatus : 'placed'

    const order: TrackedOrder = {
      id,
      customer: String(body.customer || body.customerName || 'Customer'),
      phone: String(body.phone || ''),
      address: String(body.address || ''),
      total: Number(body.total || 0),
      items: Number(body.items || body.itemsCount || 0),
      status,
      createdAt: String(body.createdAt || now),
      estimatedDelivery: String(body.estimatedDelivery || '30 min'),
      driver: {
        name: String(body.driver?.name || 'Pending assignment'),
        phone: String(body.driver?.phone || '-'),
        rating: Number(body.driver?.rating || 0),
      },
      payment: {
        method: String(body.payment?.method || body.paymentMethod || 'cash'),
        status: isPaymentStatus(String(body.payment?.status || 'pending')) ? body.payment.status : 'pending',
        receiptName: body.payment?.receiptName ? String(body.payment.receiptName) : undefined,
        receiptDataUrl: body.payment?.receiptDataUrl ? String(body.payment.receiptDataUrl) : undefined,
        receiptUploadedAt: body.payment?.receiptUploadedAt ? String(body.payment.receiptUploadedAt) : undefined,
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
    const body = await request.json()
    const id = String(body.id || '')
    const status = String(body.status || '')

    if (!id || !isTrackingStatus(status)) {
      return json({ error: 'Invalid order id or status' }, { status: 400 })
    }

    const order = await updateServerOrderStatus(id, status)

    if (!order) {
      return json({ error: 'Order not found' }, { status: 404 })
    }

    return json({ order })
  } catch (error) {
    console.error('Failed to update POS order:', error)
    return json({ error: 'Could not update order', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
