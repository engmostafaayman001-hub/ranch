import { NextRequest } from 'next/server'
import { getRequestDashboardAccess } from '@/lib/server-access'
import { clearServerClosings } from '@/lib/server-closings'
import { clearServerExpenses } from '@/lib/server-expenses'
import { clearServerOrders } from '@/lib/server-orders'

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

export async function DELETE(request: NextRequest) {
  const access = await getRequestDashboardAccess(request)
  if (!access.allowed) return json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [ordersDeleted, expensesDeleted, closingsDeleted] = await Promise.all([
      clearServerOrders(),
      clearServerExpenses(),
      clearServerClosings(),
    ])

    return json({
      ok: true,
      deleted: {
        orders: ordersDeleted,
        payments: ordersDeleted,
        expenses: expensesDeleted,
        closings: closingsDeleted,
      },
    })
  } catch (error) {
    console.error('Failed to clear report memory:', error)
    return json(
      {
        error: 'clear_failed',
        message: error instanceof Error ? error.message : 'Could not clear report memory',
      },
      { status: 500 }
    )
  }
}
