import { NextRequest } from 'next/server'
import { readServerOrders, updateServerOrderStatus, upsertServerOrder } from '@/lib/server-orders'
import { TrackingStatus, trackingSteps, TrackedOrder } from '@/lib/order-tracking'

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

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders })
}

export async function GET() {
  const orders = await readServerOrders()
  return json({ orders })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const now = new Date().toISOString()
  const id = String(body.id || `ORD${Date.now()}`)
  const status = isTrackingStatus(String(body.status || 'placed')) ? body.status : 'placed'

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
    history: Array.isArray(body.history) && body.history.length > 0
      ? body.history
      : [{ status, at: String(body.createdAt || now) }],
  }

  await upsertServerOrder(order)
  return json({ order }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
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
}
