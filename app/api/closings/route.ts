import { NextRequest } from 'next/server'
import { getRequestDashboardAccess } from '@/lib/server-access'
import { readServerClosings, saveServerClosing } from '@/lib/server-closings'
import { closeShift } from '@/lib/shifts'
import type { ClosingRecord } from '@/lib/closings'
import { archiveClosedShiftOrdersWithoutClosing, enrichShiftClosing, pruneSettledClosingItems, repairServerClosings } from '@/lib/server-closing-migration'

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

function isClosingRecord(value: unknown): value is ClosingRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<ClosingRecord>
  return Boolean(record.id && record.openedAt && record.closedAt)
}

function compactClosing(record: ClosingRecord): ClosingRecord {
  return {
    ...record,
    orders: undefined,
    expenses: undefined,
  }
}

export async function GET(request: NextRequest) {
  const access = await getRequestDashboardAccess(request)
  if (!access.allowed) return json({ error: 'Unauthorized' }, { status: 401 })

  const shouldRepair = request.nextUrl.searchParams.get('repair') === '1'
  const includeDetails = request.nextUrl.searchParams.get('includeDetails') === '1'
  const requestedId = request.nextUrl.searchParams.get('id')?.trim()
  let closings: ClosingRecord[]
  if (shouldRepair) {
    await archiveClosedShiftOrdersWithoutClosing({ pruneSettled: true })
    closings = await repairServerClosings({ pruneSettled: true })
  } else {
    closings = await readServerClosings()
  }
  if (requestedId) {
    closings = closings.filter((closing) => closing.id === requestedId)
  }
  return json({ closings: includeDetails ? closings : closings.map(compactClosing) })
}

export async function POST(request: NextRequest) {
  const access = await getRequestDashboardAccess(request)
  if (!access.allowed) return json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const record = body.record || body.closing || body
  if (!isClosingRecord(record)) {
    return json({ error: 'invalid_closing', message: 'Closing record requires id, openedAt, and closedAt' }, { status: 400 })
  }

  const enrichedRecord = await enrichShiftClosing(record)
  const saved = await saveServerClosing(enrichedRecord)
  if (saved.shiftId) {
    await closeShift(saved.shiftId, saved.closedAt, access.email || access.name || null)
  }
  const pruned = await pruneSettledClosingItems(saved)

  return json({ closing: saved, pruned }, { status: 201 })
}
