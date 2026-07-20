import { NextRequest } from 'next/server'
import { generateClosingReport } from '@/lib/closing-report'
import { getRequestDashboardAccess } from '@/lib/server-access'

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

    const shiftId = request.nextUrl.searchParams.get('shiftId')
    if (!shiftId) {
      return json({ error: 'shiftId is required' }, { status: 400 })
    }

    const report = await generateClosingReport(shiftId)
    return json({ report })
  } catch (error) {
    console.error('Failed to generate closing report:', error)
    return json({ error: 'Could not generate closing report', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
