import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { OrderPayment, TrackedOrder, TrackingStatus } from '@/lib/order-tracking'
import { createSupabaseAdminClient } from '@/lib/supabase'

const DATA_DIR = process.env.VERCEL ? '/tmp/ranch-data' : join(process.cwd(), 'data')
const ORDERS_FILE = join(DATA_DIR, 'orders.json')
const ORDERS_CACHE_MS = 7000
const SUPABASE_READ_TIMEOUT_MS = 2500
const SUPABASE_COOLDOWN_MS = 60000
const DEFAULT_ORDERS_LIMIT = 100

let ordersCache: { data: TrackedOrder[]; at: number } | null = null
let ordersReadPromise: Promise<TrackedOrder[]> | null = null
let supabaseOrdersCooldownUntil = 0

export type ServerOrderSourceFilter = 'app' | 'restaurant_pos'

export type ReadServerOrdersOptions = {
  source?: ServerOrderSourceFilter
  limit?: number
}

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

function isFreshCache() {
  return ordersCache && Date.now() - ordersCache.at < ORDERS_CACHE_MS
}

function setOrdersCache(orders: TrackedOrder[]) {
  ordersCache = { data: orders, at: Date.now() }
}

function normalizeLimit(limit?: number) {
  if (!Number.isFinite(limit)) return DEFAULT_ORDERS_LIMIT
  return Math.min(500, Math.max(1, Math.floor(Number(limit))))
}

function matchesSource(order: TrackedOrder, source?: ServerOrderSourceFilter) {
  if (!source) return true
  if (source === 'restaurant_pos') return order.source === 'restaurant_pos'
  return order.source !== 'restaurant_pos'
}

function applyReadOptions(orders: TrackedOrder[], options: ReadServerOrdersOptions = {}) {
  const limit = normalizeLimit(options.limit)
  return orders.filter((order) => matchesSource(order, options.source)).slice(0, limit)
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`Supabase orders read timed out after ${ms}ms`)), ms)
    }),
  ])
}

async function readOrdersFile() {
  await ensureDataFile()
  try {
    const raw = await readFile(ORDERS_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as TrackedOrder[] : []
  } catch {
    return []
  }
}

async function readServerOrdersFresh(options: ReadServerOrdersOptions = {}): Promise<TrackedOrder[]> {
  if (canUseSupabaseRuntimeTables() && Date.now() >= supabaseOrdersCooldownUntil) {
    const supabase = createSupabaseAdminClient()
    try {
      let query = supabase
        .from('app_orders')
        .select('data')
        .order('created_at', { ascending: false })
        .limit(normalizeLimit(options.limit))

      if (options.source === 'restaurant_pos') {
        query = query.eq('data->>source', 'restaurant_pos')
      } else if (options.source === 'app') {
        query = query.or('data->>source.is.null,data->>source.neq.restaurant_pos')
      }

      const { data, error } = await withTimeout(
        query,
        SUPABASE_READ_TIMEOUT_MS
      )

      if (!error && Array.isArray(data)) {
        const orders = data.map(normalizeOrder)
        if (!options.source) setOrdersCache(orders)
        return orders
      }
    } catch (error) {
      console.warn('[server-orders] Falling back after slow Supabase read:', error instanceof Error ? error.message : error)
      supabaseOrdersCooldownUntil = Date.now() + SUPABASE_COOLDOWN_MS
    }
  }

  if (ordersCache) return applyReadOptions(ordersCache.data, options)
  const orders = await readOrdersFile()
  setOrdersCache(orders)
  return applyReadOptions(orders, options)
}

export async function readServerOrders(options: ReadServerOrdersOptions = {}): Promise<TrackedOrder[]> {
  if (isFreshCache()) return applyReadOptions(ordersCache!.data, options)
  if (options.source || options.limit) return readServerOrdersFresh(options)
  if (ordersReadPromise) return ordersReadPromise

  ordersReadPromise = readServerOrdersFresh(options).finally(() => {
    ordersReadPromise = null
  })
  return ordersReadPromise
}

export function stripHeavyOrderFields(order: TrackedOrder, options: { includeReceipts?: boolean } = {}) {
  if (options.includeReceipts || !order.payment?.receiptDataUrl) return order
  return {
    ...order,
    payment: {
      ...order.payment,
      receiptDataUrl: undefined,
    },
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
    if (!error) {
      setOrdersCache(orders)
      return
    }
  }

  await ensureDataFile()
  await writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8')
  setOrdersCache(orders)
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

    if (!error) {
      const current = ordersCache?.data || []
      setOrdersCache([order, ...current.filter((item) => item.id !== order.id)])
      return order
    }
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
    if (!error) {
      if (ordersCache) setOrdersCache(ordersCache.data.filter((order) => order.id.toLowerCase() !== orderId.toLowerCase()))
      return true
    }
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
