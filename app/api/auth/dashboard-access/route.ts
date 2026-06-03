import { NextRequest } from 'next/server'
import { getRequestDashboardAccess } from '@/lib/server-access'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const access = await getRequestDashboardAccess(request)
  return Response.json(
    access,
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  )
}
