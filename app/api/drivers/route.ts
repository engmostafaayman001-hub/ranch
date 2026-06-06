import { NextRequest } from 'next/server'
import { getRequestDashboardAccess } from '@/lib/server-access'
import { readSharedAppData, updateSharedDrivers } from '@/lib/server-app-data'

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

function canManageDrivers(role?: string | null) {
  return ['super_admin', 'admin', 'manager'].includes(role || '')
}

export async function GET(request: NextRequest) {
  const access = await getRequestDashboardAccess(request)
  if (!access.allowed) return json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await readSharedAppData()
    return json({ drivers: data.drivers })
  } catch (error) {
    console.error('Failed to read drivers:', error)
    return json(
      { error: 'Could not load drivers', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const access = await getRequestDashboardAccess(request)
  if (!access.allowed) return json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManageDrivers(access.role)) return json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json().catch(() => ({}))
    const data = await updateSharedDrivers(Array.isArray(body.drivers) ? body.drivers : [])
    return json({ drivers: data.drivers })
  } catch (error) {
    console.error('Failed to update drivers:', error)
    return json(
      { error: 'Could not update drivers', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
