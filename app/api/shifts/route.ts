import { NextRequest } from 'next/server'
import { canRequestAccessDashboard, getRequestDashboardAccess } from '@/lib/server-access'
import { createShift, closeShift, lockShift, getCurrentOpenShift, getShift, readShifts } from '@/lib/shifts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-POS-API-Key',
}

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      ...init?.headers,
    },
  })
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders })
}

export async function GET(request: NextRequest) {
  if (!(await canRequestAccessDashboard(request))) {
    return json({ error: 'Unauthorized' }, { status: 401 })
  }

  const shiftId = request.nextUrl.searchParams.get('shiftId')?.trim() || undefined
  if (shiftId) {
    const shift = await getShift(shiftId)
    if (!shift) {
      return json({ error: 'Shift not found' }, { status: 404 })
    }
    return json({ shift })
  }

  const currentShift = await getCurrentOpenShift()
  const shifts = await readShifts()
  return json({ shift: currentShift, shifts })
}

export async function POST(request: NextRequest) {
  const access = await getRequestDashboardAccess(request)
  if (!access.allowed) {
    return json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const openedBy = access.email || access.name || null
  const initial = {
    id: typeof body.shiftId === 'string' ? body.shiftId : typeof body.id === 'string' ? body.id : undefined,
    openedAt: typeof body.openedAt === 'string' ? body.openedAt : typeof body.startedAt === 'string' ? body.startedAt : typeof body.opensAt === 'string' ? body.opensAt : undefined,
    openingBalance: typeof body.openingBalance === 'number' ? body.openingBalance : undefined,
    metadata: typeof body.metadata === 'object' && body.metadata !== null ? body.metadata : undefined,
  }

  const shift = await createShift(openedBy, initial)
  return json({ shift }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const access = await getRequestDashboardAccess(request)
  if (!access.allowed) {
    return json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const shiftId = String(body.shiftId || body.id || '').trim()
  if (!shiftId) {
    return json({ error: 'shift_id_required', message: 'A shift id must be provided' }, { status: 412 })
  }

  const action = String(body.action || 'close').trim().toLowerCase()
  if (action === 'close') {
    const closedAt = typeof body.closedAt === 'string' ? body.closedAt : undefined
    const shift = await closeShift(shiftId, closedAt, access.email || access.name || null)
    if (!shift) {
      return json({ error: 'Shift not found' }, { status: 404 })
    }
    return json({ shift })
  }

  if (action === 'lock') {
    const shift = await lockShift(shiftId)
    if (!shift) {
      return json({ error: 'Shift not found' }, { status: 404 })
    }
    return json({ shift })
  }

  return json({ error: 'invalid_action', message: 'Action must be close or lock' }, { status: 400 })
}
