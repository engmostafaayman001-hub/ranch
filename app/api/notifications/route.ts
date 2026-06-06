import { NextRequest } from 'next/server'
import { normalizeDiscountCode } from '@/lib/discounts'
import { createServerNotification, readServerNotifications } from '@/lib/server-notifications'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const notifications = await readServerNotifications()
    return Response.json({ notifications })
  } catch (error) {
    console.error('Notifications GET failed:', error)
    return Response.json(
      { error: 'Could not load notifications', message: error instanceof Error ? error.message : 'Unknown server error', notifications: [] },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const title = String(body.title || '').trim()
    const message = String(body.message || '').trim()
    const code = normalizeDiscountCode(String(body.code || ''))
    const discountType = body.discountType === 'fixed' ? 'fixed' : 'percent'
    const discountValue = Number(body.discountValue || 0)
    const minSubtotal = Number(body.minSubtotal || 0)
    const active = body.active !== false
    const expiresAt = body.expiresAt ? String(body.expiresAt) : undefined

    if (!title || !message) {
      return Response.json({ error: 'Title and message are required' }, { status: 400 })
    }

    if (code && (!Number.isFinite(discountValue) || discountValue <= 0)) {
      return Response.json({ error: 'Discount value is required when a code is provided' }, { status: 400 })
    }

    const notification = await createServerNotification({
      title,
      message,
      code: code || undefined,
      discountType,
      discountValue: code ? discountValue : undefined,
      minSubtotal,
      active,
      expiresAt,
    })
    return Response.json({ notification }, { status: 201 })
  } catch (error) {
    console.error('Notifications POST failed:', error)
    return Response.json(
      { error: 'Notification storage failed', message: error instanceof Error ? error.message : 'Unknown server error' },
      { status: 500 }
    )
  }
}
