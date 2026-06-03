import { NextRequest } from 'next/server'
import { createServerNotification, readServerNotifications } from '@/lib/server-notifications'

export const runtime = 'nodejs'

export async function GET() {
  const notifications = await readServerNotifications()
  return Response.json({ notifications })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const title = String(body.title || '').trim()
  const message = String(body.message || '').trim()
  const code = String(body.code || '').trim()

  if (!title || !message) {
    return Response.json({ error: 'Title and message are required' }, { status: 400 })
  }

  const notification = await createServerNotification({ title, message, code: code || undefined })
  return Response.json({ notification }, { status: 201 })
}
