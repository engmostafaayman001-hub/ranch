import { NextRequest } from 'next/server'
import { canRequestAccessDashboard } from '@/lib/server-access'
import { createServerExpense, deleteServerExpense, readServerExpenses } from '@/lib/server-expenses'

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
  const expenses = await readServerExpenses()
  return json({ expenses })
}

export async function POST(request: NextRequest) {
  if (!(await canRequestAccessDashboard(request))) return json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const name = String(body.name || '').trim()
  const amount = Number(body.amount || 0)
  const date = String(body.date || new Date().toISOString().slice(0, 10))
  const note = String(body.note || '').trim()
  if (!name || !Number.isFinite(amount) || amount <= 0) return json({ error: 'Invalid expense' }, { status: 400 })
  const expense = await createServerExpense({ name, amount, date, note })
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
