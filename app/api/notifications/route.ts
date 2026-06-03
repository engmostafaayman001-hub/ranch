import { NextRequest } from 'next/server'
import { createServerNotification, readServerNotifications } from '@/lib/server-notifications'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const notifications = await readServerNotifications()
    return Response.json({ notifications })
  } catch (error) {
    console.error('Notifications GET failed:', error)
    return Response.json({ notifications: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const title = String(body.title || '').trim()
    const message = String(body.message || '').trim()
    const code = String(body.code || '').trim()

    if (!title || !message) {
      return Response.json({ error: 'Title and message are required' }, { status: 400 })
    }

    const notification = await createServerNotification({ title, message, code: code || undefined })
    return Response.json({ notification }, { status: 201 })
  } catch (error) {
    console.error('Notifications POST failed:', error)
    return Response.json(
      { error: 'Notification storage failed', message: error instanceof Error ? error.message : 'Unknown server error' },
      { status: 500 }
    )
  }
}
