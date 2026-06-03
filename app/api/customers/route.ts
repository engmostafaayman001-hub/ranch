import { NextRequest } from 'next/server'
import { readServerCustomers, upsertServerCustomer } from '@/lib/server-customers'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const customers = await readServerCustomers()
    return Response.json({ customers })
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
    const email = String(body.email || '').trim()

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 })
    }

    const customer = await upsertServerCustomer({
      name: String(body.name || body.fullName || '').trim(),
      email,
      phone: String(body.phone || '').trim(),
      address: String(body.address || '').trim(),
    })

    return Response.json({ customer }, { status: 201 })
  } catch (error) {
    console.error('Failed to save customer:', error)
    return Response.json(
      { error: 'Could not save customer', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
