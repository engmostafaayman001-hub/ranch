import { TrackedOrder } from '@/lib/order-tracking'

type OrderSource = 'app' | 'restaurant_pos'

function matchesSource(order: TrackedOrder, source: OrderSource) {
  return source === 'restaurant_pos'
    ? order.source === 'restaurant_pos'
    : order.source !== 'restaurant_pos'
}

async function fetchOrdersJson(url: string, timeoutMs: number) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !Array.isArray(data.orders)) {
      throw new Error(data.message || data.error || 'Could not load orders')
    }
    return data.orders as TrackedOrder[]
  } finally {
    window.clearTimeout(timer)
  }
}

export async function fetchDashboardOrdersBySource(source: OrderSource, limit = 120) {
  try {
    return await fetchOrdersJson(`/api/pos/orders?source=${source}&limit=${limit}`, 4500)
  } catch (sourceError) {
    const orders = await fetchOrdersJson(`/api/pos/orders?limit=${Math.max(limit, 200)}`, 9000)
    const filtered = orders.filter((order) => matchesSource(order, source)).slice(0, limit)
    if (filtered.length > 0) return filtered
    throw sourceError instanceof Error ? sourceError : new Error('Could not load orders')
  }
}
