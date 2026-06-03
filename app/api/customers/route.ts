import { NextRequest } from 'next/server'
import { readServerCustomers, upsertServerCustomer } from '@/lib/server-customers'

export const runtime = 'nodejs'

export async function GET() {
  const customers = await readServerCustomers()
  return Response.json({ customers })
}

export async function POST(request: NextRequest) {
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
}
