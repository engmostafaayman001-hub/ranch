import { NextRequest } from 'next/server'
import { getRequestDashboardAccess } from '@/lib/server-access'
import { readSharedAppData, updateSharedCatalog, updateSharedDrivers, updateSharedSettings } from '@/lib/server-app-data'

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

export async function GET() {
  try {
    const data = await readSharedAppData()
    return json(data)
  } catch (error) {
    console.error('Failed to read shared app data:', error)
    return json(
      { error: 'Could not load shared app data', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const access = await getRequestDashboardAccess(request)
  if (!access.allowed) return json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()

    if (body.type === 'catalog') {
      if (!['super_admin', 'admin', 'manager'].includes(access.role || '')) {
        return json({ error: 'Forbidden' }, { status: 403 })
      }

      const data = await updateSharedCatalog({
        categories: Array.isArray(body.categories) ? body.categories : [],
        products: Array.isArray(body.products) ? body.products : [],
      })
      return json(data)
    }

    if (body.type === 'settings') {
      if (!['super_admin', 'admin'].includes(access.role || '')) {
        return json({ error: 'Forbidden' }, { status: 403 })
      }

      const data = await updateSharedSettings(body.settings || {})
      return json(data)
    }

    if (body.type === 'drivers') {
      if (!['super_admin', 'admin', 'manager'].includes(access.role || '')) {
        return json({ error: 'Forbidden' }, { status: 403 })
      }

      const data = await updateSharedDrivers(Array.isArray(body.drivers) ? body.drivers : [])
      return json(data)
    }

    return json({ error: 'Invalid app data update type' }, { status: 400 })
  } catch (error) {
    return json(
      { error: 'Could not update shared app data', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
