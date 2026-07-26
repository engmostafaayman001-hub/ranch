import { NextRequest } from 'next/server'
import { readServerOrders, stripHeavyOrderFields } from '@/lib/server-orders'
import { getRequestDashboardAccess } from '@/lib/server-access'
import { getSettledClosingIds } from '@/lib/closings'
import { repairServerClosings } from '@/lib/server-closing-migration'

export const runtime = 'nodejs'

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      ...init?.headers,
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    const access = await getRequestDashboardAccess(request)
    if (!access.allowed) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limit = Number(request.nextUrl.searchParams.get('limit') || '1000')
    const shiftId = request.nextUrl.searchParams.get('shiftId')?.trim() || undefined
    const excludeSettled = request.nextUrl.searchParams.get('excludeSettled') === '1'
    const allOrders = await readServerOrders({ limit, shiftId })
    let compactOrders = allOrders.map((order) => stripHeavyOrderFields(order, { includeReceipts: false }))
    if (excludeSettled) {
      const { orderIds: settledOrderIds } = getSettledClosingIds(await repairServerClosings({ pruneSettled: true }))
      compactOrders = compactOrders.filter((order) => !settledOrderIds.has(order.id))
    }

    return json({ orders: compactOrders })
  } catch (error) {
    console.error('Failed to read all orders:', error)
    return json({ error: 'Could not load orders', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
