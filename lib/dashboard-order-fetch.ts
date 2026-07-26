import { TrackedOrder } from '@/lib/order-tracking'
import { fetchWithRetry } from '@/lib/fetch-with-retry'

type OrderSource = 'app' | 'restaurant_pos'

function matchesSource(order: TrackedOrder, source: OrderSource) {
  return source === 'restaurant_pos'
    ? order.source === 'restaurant_pos'
    : order.source !== 'restaurant_pos'
}

async function fetchOrdersJson(url: string) {
  const response = await fetchWithRetry(url, { cache: 'no-store' }, { retries: 3 })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !Array.isArray(data.orders)) {
    throw new Error(data.message || data.error || 'Could not load orders')
  }
  return data.orders as TrackedOrder[]
}

export async function fetchDashboardOrdersBySource(source: OrderSource, limit = 120) {
  try {
    return await fetchOrdersJson(`/api/pos/orders?source=${source}&limit=${limit}&excludeSettled=1`)
  } catch {
    const orders = await fetchOrdersJson(`/api/pos/orders?limit=${Math.max(limit, 200)}&excludeSettled=1`)
    return orders.filter((order) => matchesSource(order, source)).slice(0, limit)
  }
}

export async function fetchDashboardOrderDetails(orderId: string) {
  const orders = await fetchOrdersJson(`/api/pos/orders?orderId=${encodeURIComponent(orderId)}&includeReceipts=1`)
  return orders[0] || null
}

export async function fetchDashboardOrderReceipt(orderId: string) {
  const order = await fetchDashboardOrderDetails(orderId)
  const receiptDataUrl = order?.payment?.receiptDataUrl
  if (!receiptDataUrl) {
    throw new Error('No receipt file is saved for this order')
  }

  return {
    url: receiptDataUrl,
    name: order.payment?.receiptName,
  }
}
