import { NextRequest } from 'next/server'
import { canRequestAccessDashboard, getRequestDashboardAccess } from '@/lib/server-access'
import { createServerExpense, deleteServerExpense, readServerExpenses } from '@/lib/server-expenses'
import { createShift, ensureShiftExists, getCurrentOpenShift, isShiftLocked } from '@/lib/shifts'

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
  if (!(await canRequestAccessDashboard(request))) return json({ error: 'Unauthorized' }, { status: 401 })
  const shiftId = String(request.nextUrl.searchParams.get('shiftId') || '').trim() || undefined
  const expenses = await readServerExpenses({ shiftId })
  return json({ expenses })
}

export async function POST(request: NextRequest) {
  if (!(await canRequestAccessDashboard(request))) return json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const name = String(body.name || '').trim()
  const amount = Number(body.amount || 0)
  const date = String(body.date || new Date().toISOString().slice(0, 10))
  let shiftId = String(body.shiftId || request.headers.get('x-shift-id') || '').trim() || undefined
  if (shiftId) {
    if (await isShiftLocked(shiftId)) {
      const currentOpenShift = await getCurrentOpenShift()
      shiftId = currentOpenShift?.id || shiftId
    }
  } else {
    const currentOpenShift = await getCurrentOpenShift()
    shiftId = currentOpenShift?.id
  }
  const note = String(body.note || '').trim()
  if (!name || !Number.isFinite(amount) || amount <= 0) return json({ error: 'Invalid expense' }, { status: 400 })

  // require shift association for non-admin actions
  const access = await getRequestDashboardAccess(request)
  const isAdmin = access.allowed && access.role === 'super_admin'
  if (!shiftId && !isAdmin) {
    return json({ error: 'shift_id_required', message: 'A shift id must be provided in x-shift-id header or body.shiftId' }, { status: 412 })
  }

  if (shiftId) {
    if (await isShiftLocked(shiftId)) {
      return json({ error: 'shift_locked', message: 'Cannot create expenses for a closed or locked shift' }, { status: 423 })
    }
    if (!(await ensureShiftExists(shiftId))) {
      await createShift(access.email || access.name || null, {
        id: shiftId,
        openedAt: String(body.shiftOpenedAt || body.openedAt || body.date || new Date().toISOString()),
      })
    }
  }

  const expense = await createServerExpense({ name, amount, date, note, shiftId })
  return json({ expense }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  if (!(await canRequestAccessDashboard(request))) return json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const id = String(body.id || '')
  if (!id) return json({ error: 'Expense id is required' }, { status: 400 })
  const deleted = await deleteServerExpense(id)
  return json({ deleted, id }, { status: deleted ? 200 : 404 })
}
