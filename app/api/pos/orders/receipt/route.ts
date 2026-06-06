import { NextRequest } from 'next/server'
import { readServerOrderReceipt } from '@/lib/server-orders'
import { getRequestAuthenticatedUserEmail, getRequestDashboardAccess } from '@/lib/server-access'

export const runtime = 'nodejs'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-POS-API-Key',
}

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      ...init?.headers,
    },
  })
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders })
}

export async function GET(request: NextRequest) {
  try {
    const orderId = request.nextUrl.searchParams.get('orderId')?.trim()
    if (!orderId) return json({ error: 'Order id is required' }, { status: 400 })

    const access = await getRequestDashboardAccess(request)
    const userEmail = await getRequestAuthenticatedUserEmail(request)
    if (!access.allowed && !userEmail) return json({ error: 'Unauthorized' }, { status: 401 })

    const receipt = await readServerOrderReceipt(orderId)
    if (!receipt) return json({ error: 'Order not found' }, { status: 404 })
    if (!access.allowed && receipt.customerEmail?.toLowerCase() !== userEmail?.toLowerCase()) {
      return json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!receipt.receiptDataUrl) {
      return json({
        error: 'Receipt file is not saved',
        receiptName: receipt.receiptName,
        receiptUploadedAt: receipt.receiptUploadedAt,
      }, { status: 404 })
    }

    return json({ receipt })
  } catch (error) {
    console.error('Failed to read order receipt:', error)
    return json(
      { error: 'Could not load receipt', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
