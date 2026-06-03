import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { OrderPayment, TrackedOrder, TrackingStatus } from '@/lib/order-tracking'
import { createSupabaseAdminClient } from '@/lib/supabase'

const DATA_DIR = process.env.VERCEL ? '/tmp/ranch-data' : join(process.cwd(), 'data')
const ORDERS_FILE = join(DATA_DIR, 'orders.json')

function canUseSupabaseRuntimeTables() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

function normalizeOrder(row: { data: TrackedOrder } | TrackedOrder): TrackedOrder {
  return 'data' in row ? row.data : row
}

async function ensureDataFile() {
  await mkdir(DATA_DIR, { recursive: true })
  try {
    await readFile(ORDERS_FILE, 'utf8')
  } catch {
    await writeFile(ORDERS_FILE, '[]', 'utf8')
  }
}

export async function readServerOrders(): Promise<TrackedOrder[]> {
  if (canUseSupabaseRuntimeTables()) {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from('app_orders')
      .select('data')
      .order('created_at', { ascending: false })

    if (!error && Array.isArray(data)) {
      return data.map(normalizeOrder)
    }
  }

  await ensureDataFile()
  try {
    const raw = await readFile(ORDERS_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function writeServerOrders(orders: TrackedOrder[]) {
  if (canUseSupabaseRuntimeTables()) {
    const supabase = createSupabaseAdminClient()
    const rows = orders.map((order) => ({
      id: order.id,
      data: order,
      customer_email: order.customerEmail || null,
      customer_phone: order.phone || null,
      status: order.status,
      created_at: order.createdAt,
      updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase.from('app_orders').upsert(rows, { onConflict: 'id' })
    if (!error) return
  }

  await ensureDataFile()
  await writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8')
}

export async function upsertServerOrder(order: TrackedOrder) {
  if (canUseSupabaseRuntimeTables()) {
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from('app_orders').upsert({
      id: order.id,
      data: order,
      customer_email: order.customerEmail || null,
      customer_phone: order.phone || null,
      status: order.status,
      created_at: order.createdAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })

    if (!error) return order
  }

  const orders = await readServerOrders()
  const updated = [order, ...orders.filter((item) => item.id !== order.id)]
  await writeServerOrders(updated)
  return order
}

export async function deleteServerOrder(orderId: string) {
  if (canUseSupabaseRuntimeTables()) {
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from('app_orders').delete().eq('id', orderId)
    if (!error) return true
  }

  const orders = await readServerOrders()
  const updated = orders.filter((order) => order.id.toLowerCase() !== orderId.toLowerCase())
  await writeServerOrders(updated)
  return updated.length !== orders.length
}

export async function updateServerOrderStatus(
  orderId: string,
  status: TrackingStatus,
  updates?: {
    driver?: TrackedOrder['driver']
    payment?: Partial<OrderPayment>
  }
) {
  const orders = await readServerOrders()
  const now = new Date().toISOString()
  const updated = orders.map((order) => {
    if (order.id.toLowerCase() !== orderId.toLowerCase()) return order

    const payment = updates?.payment
      ? { ...(order.payment || { method: 'cash', status: 'pending' as const }), ...updates.payment }
      : order.payment

    return {
      ...order,
      status,
      driver: updates?.driver || order.driver,
      payment,
      history: order.history.some((event) => event.status === status)
        ? order.history
        : [...order.history, { status, at: now }],
    }
  })

  await writeServerOrders(updated)
  return updated.find((order) => order.id.toLowerCase() === orderId.toLowerCase()) || null
}
