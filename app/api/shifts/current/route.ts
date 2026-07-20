import { NextRequest } from 'next/server'
import { getCurrentOpenShift } from '@/lib/shifts'

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

export async function GET() {
  try {
    const currentShift = await getCurrentOpenShift()
    if (!currentShift) {
      return json({ shift: null, message: 'No open shift found' }, { status: 200 })
    }

    return json({ shift: currentShift }, { status: 200 })
  } catch (error) {
    console.error('Failed to get current shift:', error)
    return json({ shift: null, error: 'Could not get current shift', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 200 })
  }
}

