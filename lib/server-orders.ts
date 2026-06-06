import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { OrderPayment, TrackedOrder, TrackingStatus } from '@/lib/order-tracking'
import { createSupabaseAdminClient } from '@/lib/supabase'

const DATA_DIR = process.env.VERCEL ? '/tmp/ranch-data' : join(process.cwd(), 'data')
const ORDERS_FILE = join(DATA_DIR, 'orders.json')
const ORDERS_CACHE_MS = 7000
const SUPABASE_READ_TIMEOUT_MS = Number(process.env.SUPABASE_ORDERS_READ_TIMEOUT_MS || 45000)
const DEFAULT_ORDERS_LIMIT = 300

let ordersCache: { data: TrackedOrder[]; at: number } | null = null
let ordersReadPromise: Promise<TrackedOrder[]> | null = null

export type ServerOrderSourceFilter = 'app' | 'restaurant_pos'

export type ReadServerOrdersOptions = {
  source?: ServerOrderSourceFilter
  limit?: number
  orderId?: string
  includeReceipts?: boolean
}

type CompactOrderRow = {
  id: string
  customer_email: string | null
  customer_phone: string | null
  status: TrackingStatus | null
  created_at: string | null
  source?: string | null
  external_reference?: string | null
  customer?: string | null
  phone?: string | null
  address?: string | null
  notes?: string | null
  total?: string | number | null
  items?: string | number | null
  order_status?: TrackingStatus | null
  estimated_delivery?: string | null
  driver?: TrackedOrder['driver'] | null
  payment_method?: string | null
  payment_status?: OrderPayment['status'] | null
  receipt_name?: string | null
  receipt_uploaded_at?: string | null
}

function canUseSupabaseRuntimeTables() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

function shouldRequireSupabaseRuntimeTables() {
  return canUseSupabaseRuntimeTables()
}

function getSupabaseErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message || error)
  return String(error || 'Unknown Supabase error')
}

function normalizeOrder(row: { data: TrackedOrder } | TrackedOrder): TrackedOrder {
  return 'data' in row ? row.data : row
}

function normalizeCompactOrder(row: CompactOrderRow): TrackedOrder {
  const createdAt = row.created_at || new Date().toISOString()
  const status = row.order_status || row.status || 'placed'
  return {
    id: row.id,
    source: row.source || 'app',
    externalReference: row.external_reference || undefined,
    customer: row.customer || 'Customer',
    customerEmail: row.customer_email || undefined,
    phone: row.phone || row.customer_phone || '',
    address: row.address || '',
    notes: row.notes || undefined,
    total: Number(row.total || 0),
    items: Number(row.items || 0),
    status,
    createdAt,
    estimatedDelivery: row.estimated_delivery || '30 min',
    driver: row.driver || {
      name: 'Pending assignment',
      phone: '-',
      rating: 0,
    },
    payment: row.payment_method || row.payment_status || row.receipt_name || row.receipt_uploaded_at
      ? {
          method: row.payment_method || 'cash',
          status: row.payment_status || 'pending',
          receiptName: row.receipt_name || undefined,
          receiptUploadedAt: row.receipt_uploaded_at || undefined,
        }
      : undefined,
    history: [{ status, at: createdAt }],
  }
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
  return orders
    .filter((order) => !options.orderId || order.id.toLowerCase() === options.orderId.toLowerCase())
    .filter((order) => matchesSource(order, options.source))
    .slice(0, limit)
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
  if (canUseSupabaseRuntimeTables()) {
    const supabase = createSupabaseAdminClient()
    try {
      const readLimit = options.source ? Math.max(DEFAULT_ORDERS_LIMIT, normalizeLimit(options.limit)) : normalizeLimit(options.limit)
      const shouldReadFullData = options.includeReceipts || options.orderId
      const compactSelect = [
        'id',
        'customer_email',
        'customer_phone',
        'status',
        'created_at',
        'source:data->>source',
        'external_reference:data->>externalReference',
        'customer:data->>customer',
        'phone:data->>phone',
        'address:data->>address',
        'notes:data->>notes',
        'total:data->>total',
        'items:data->>items',
        'order_status:data->>status',
        'estimated_delivery:data->>estimatedDelivery',
        'payment_method:data->payment->>method',
        'payment_status:data->payment->>status',
        'receipt_name:data->payment->>receiptName',
        'receipt_uploaded_at:data->payment->>receiptUploadedAt',
      ].join(',')

      let query = supabase
        .from('app_orders')
        .select(shouldReadFullData ? 'data' : compactSelect)
        .order('created_at', { ascending: false })

      if (options.orderId) {
        query = query.eq('id', options.orderId).limit(1)
      } else {
        query = query.limit(readLimit)
      }

      const { data, error } = await withTimeout(
        query,
        SUPABASE_READ_TIMEOUT_MS
      )

      if (error) throw error

      if (Array.isArray(data)) {
        const orders = shouldReadFullData
          ? (data as unknown as Array<{ data: TrackedOrder } | TrackedOrder>).map(normalizeOrder)
          : (data as unknown as CompactOrderRow[]).map(normalizeCompactOrder)
        if (!options.orderId) setOrdersCache(orders)
        return applyReadOptions(orders, options)
      }
    } catch (error) {
      console.warn('[server-orders] Supabase read failed:', getSupabaseErrorMessage(error))
      if (ordersCache) return applyReadOptions(ordersCache.data, options)
      if (shouldRequireSupabaseRuntimeTables()) throw error
    }
  }

  if (ordersCache) return applyReadOptions(ordersCache.data, options)
  const orders = await readOrdersFile()
  setOrdersCache(orders)
  return applyReadOptions(orders, options)
}

export async function readServerOrders(options: ReadServerOrdersOptions = {}): Promise<TrackedOrder[]> {
  if (options.orderId) return readServerOrdersFresh(options)
  if (options.source) return readServerOrdersFresh(options)
  if (isFreshCache()) return applyReadOptions(ordersCache!.data, options)
  if (options.limit) return readServerOrdersFresh(options)
  if (ordersReadPromise) return ordersReadPromise

  ordersReadPromise = readServerOrdersFresh().finally(() => {
    ordersReadPromise = null
  })
  return ordersReadPromise.then((orders) => applyReadOptions(orders, options))
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

type ReceiptRow = {
  customer_email?: string | null
  receipt_name?: string | null
  receipt_data_url?: string | null
  receipt_uploaded_at?: string | null
}

export async function readServerOrderReceipt(orderId: string) {
  const normalizedOrderId = orderId.trim()
  if (!normalizedOrderId) return null

  if (canUseSupabaseRuntimeTables()) {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await withTimeout(
      supabase
        .from('app_orders')
        .select([
          'customer_email',
          'receipt_name:data->payment->>receiptName',
          'receipt_data_url:data->payment->>receiptDataUrl',
          'receipt_uploaded_at:data->payment->>receiptUploadedAt',
        ].join(','))
        .eq('id', normalizedOrderId)
        .maybeSingle(),
      SUPABASE_READ_TIMEOUT_MS
    )

    if (error) throw error
    if (!data) return null

    const row = data as unknown as ReceiptRow
    return {
      customerEmail: row.customer_email || undefined,
      receiptName: row.receipt_name || undefined,
      receiptDataUrl: row.receipt_data_url || undefined,
      receiptUploadedAt: row.receipt_uploaded_at || undefined,
    }
  }

  const order = (await readServerOrders({ orderId: normalizedOrderId, includeReceipts: true }))[0]
  return order?.payment
    ? {
        receiptName: order.payment.receiptName,
        receiptDataUrl: order.payment.receiptDataUrl,
        receiptUploadedAt: order.payment.receiptUploadedAt,
        customerEmail: order.customerEmail,
      }
    : null
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

    if (shouldRequireSupabaseRuntimeTables()) throw new Error(`Could not save orders to Supabase: ${getSupabaseErrorMessage(error)}`)
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

    if (shouldRequireSupabaseRuntimeTables()) throw new Error(`Could not save order to Supabase: ${getSupabaseErrorMessage(error)}`)
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

    if (shouldRequireSupabaseRuntimeTables()) throw new Error(`Could not delete order from Supabase: ${getSupabaseErrorMessage(error)}`)
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
  const existing = (await readServerOrders({ orderId, includeReceipts: true }))[0]
  if (!existing) return null

  const now = new Date().toISOString()
  const payment = updates?.payment
    ? { ...(existing.payment || { method: 'cash', status: 'pending' as const }), ...updates.payment }
    : existing.payment
  const history = Array.isArray(existing.history) ? existing.history : []
  const updated = {
    ...existing,
    status,
    driver: updates?.driver || existing.driver,
    payment,
    history: history.some((event) => event.status === status)
      ? history
      : [...history, { status, at: now }],
  }

  await upsertServerOrder(updated)
  return updated
}
