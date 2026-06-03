import { NextRequest } from 'next/server'
import { canRequestAccessDashboard } from '@/lib/server-access'
import { readSharedAppData, updateSharedCatalog, updateSharedSettings } from '@/lib/server-app-data'

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
  const data = await readSharedAppData()
  return json(data)
}

export async function PATCH(request: NextRequest) {
  const allowed = await canRequestAccessDashboard(request)
  if (!allowed) return json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()

    if (body.type === 'catalog') {
      const data = await updateSharedCatalog({
        categories: Array.isArray(body.categories) ? body.categories : [],
        products: Array.isArray(body.products) ? body.products : [],
      })
      return json(data)
    }

    if (body.type === 'settings') {
      const data = await updateSharedSettings(body.settings || {})
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
