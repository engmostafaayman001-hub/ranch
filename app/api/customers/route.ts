import { NextRequest } from 'next/server'
import { normalizeEmail } from '@/lib/access'
import { canRequestAccessDashboard, getRequestUserEmail } from '@/lib/server-access'
import { readServerCustomers, upsertServerCustomer } from '@/lib/server-customers'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const userEmail = getRequestUserEmail(request)
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
    const email = normalizeEmail(String(body.email || ''))

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 })
    }

    const requestEmail = getRequestUserEmail(request)
    const isAdmin = await canRequestAccessDashboard(request)
    if (!isAdmin && (!requestEmail || requestEmail !== email)) {
      return Response.json({ error: 'You can only update your own customer profile' }, { status: 403 })
    }

    const customer = await upsertServerCustomer({
      name: String(body.name || body.fullName || '').trim(),
      email,
      phone: String(body.phone || '').trim(),
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
