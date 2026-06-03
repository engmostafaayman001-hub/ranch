import { NextRequest } from 'next/server'
import { validateNotificationDiscount } from '@/lib/discounts'
import { readServerNotifications } from '@/lib/server-notifications'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const code = String(body.code || '')
    const subtotal = Number(body.subtotal || 0)
    const notifications = await readServerNotifications()
    const result = validateNotificationDiscount(notifications, code, subtotal)

    return Response.json(result, {
      status: result.valid ? 200 : 400,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  } catch (error) {
    return Response.json(
      { valid: false, code: '', reason: error instanceof Error ? error.message : 'Could not validate discount code' },
      { status: 500 }
    )
  }
}
