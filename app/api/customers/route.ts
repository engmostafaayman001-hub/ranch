import { NextRequest } from 'next/server'
import { normalizeEmail } from '@/lib/access'
import { canRequestAccessDashboard, getRequestAuthenticatedUserEmail } from '@/lib/server-access'
import { deleteServerCustomer, readServerCustomers, upsertServerCustomer } from '@/lib/server-customers'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getRequestAuthenticatedUserEmail(request)
    const isAdmin = await canRequestAccessDashboard(request)
    const customers = await readServerCustomers()
    return Response.json(
      {
        customers: isAdmin
          ? customers
          : customers.filter((customer) => customer.email.toLowerCase() === userEmail),
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  } catch (error) {
    console.error('Failed to read customers:', error)
    return Response.json(
      { error: 'Could not load customers', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const rawEmail = normalizeEmail(String(body.email || ''))
    const phone = String(body.phone || '').trim()
    const isAdmin = await canRequestAccessDashboard(request)
    const email = rawEmail || (isAdmin && phone ? `pos-${phone.replace(/\D/g, '') || Date.now()}@local.ranch` : '')

    if (!email) {
      return Response.json({ error: 'Email or phone is required' }, { status: 400 })
    }

    const requestEmail = await getRequestAuthenticatedUserEmail(request)
    if (!isAdmin && (!requestEmail || requestEmail !== email)) {
      return Response.json({ error: 'You can only update your own customer profile' }, { status: 403 })
    }

    const customer = await upsertServerCustomer({
      name: String(body.name || body.fullName || '').trim(),
      email,
      phone,
      address: String(body.address || '').trim(),
    })

    return Response.json(
      { customer },
      { status: 201, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
    )
  } catch (error) {
    console.error('Failed to save customer:', error)
    return Response.json(
      { error: 'Could not save customer', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const isAdmin = await canRequestAccessDashboard(request)
    if (!isAdmin) {
      return Response.json({ error: 'Dashboard access is required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const result = await deleteServerCustomer({
      id: searchParams.get('id') || undefined,
      email: searchParams.get('email') || undefined,
      phone: searchParams.get('phone') || undefined,
    })

    return Response.json(
      { ok: true, ...result },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
    )
  } catch (error) {
    console.error('Failed to delete customer:', error)
    return Response.json(
      { error: 'Could not delete customer', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
