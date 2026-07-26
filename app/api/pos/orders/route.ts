import { NextRequest } from 'next/server'
import { deleteServerOrder, readServerOrders, saveNewServerOrder, ServerOrderSourceFilter, stripHeavyOrderFields, updateServerOrder, updateServerOrderStatus } from '@/lib/server-orders'
import { PaymentStatus, TrackingStatus, trackingSteps, TrackedOrder } from '@/lib/order-tracking'
import { getRequestAuthenticatedUserEmail, getRequestDashboardAccess } from '@/lib/server-access'
import { validateNotificationDiscount } from '@/lib/discounts'
import { readServerNotifications } from '@/lib/server-notifications'
import { readSharedAppData } from '@/lib/server-app-data'
import { createShift, ensureShiftExists, getCurrentOpenShift, isShiftLocked } from '@/lib/shifts'

export const runtime = 'nodejs'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
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

function isTrackingStatus(status: string): status is TrackingStatus {
  return trackingSteps.some((step) => step.status === status)
}

function isPaymentStatus(status: string): status is PaymentStatus {
  return ['cash_on_delivery', 'receipt_uploaded', 'paid', 'pending', 'rejected'].includes(status)
}

function getConfiguredApiKeys() {
  return (process.env.RANCH_POS_API_KEYS || process.env.POS_API_KEYS || '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean)
}

function getRequestApiKey(request: NextRequest) {
  const authorization = request.headers.get('authorization') || ''
  return (
    request.headers.get('x-pos-api-key') ||
    request.headers.get('x-api-key') ||
    authorization.replace(/^Bearer\s+/i, '').trim()
  )
}

function validateOptionalApiKey(request: NextRequest) {
  const configuredKeys = getConfiguredApiKeys()
  const providedKey = getRequestApiKey(request)

  if (!providedKey) return true
  return configuredKeys.length > 0 && configuredKeys.includes(providedKey)
}

function normalizeMatchValue(value?: string | null) {
  return String(value || '').trim().toLowerCase()
}

function normalizeSourceFilter(value?: string | null): ServerOrderSourceFilter | undefined {
  const normalized = String(value || '').trim().toLowerCase()
  if (['app', 'application', 'customer_app'].includes(normalized)) return 'app'
  if (['restaurant_pos', 'pos', 'restaurant'].includes(normalized)) return 'restaurant_pos'
  return undefined
}

function normalizeLimit(value?: string | null) {
  const limit = Number(value || 100)
  if (!Number.isFinite(limit)) return 100
  return Math.min(10000, Math.max(1, Math.floor(limit)))
}

function isOrderAssignedToDelivery(order: TrackedOrder, access: { email: string | null; name: string | null }) {
  const email = normalizeMatchValue(access.email)
  const name = normalizeMatchValue(access.name)
  const driverEmail = normalizeMatchValue(order.driver?.email)
  const driverName = normalizeMatchValue(order.driver?.name)

  return Boolean(
    (email && driverEmail === email) ||
      (name && driverName === name) ||
      (email && driverName === email.split('@')[0])
  )
}

function normalizeTrackingStatus(value: unknown): TrackingStatus {
  const raw = String(value || 'placed').toLowerCase()
  const aliases: Record<string, TrackingStatus> = {
    new: 'placed',
    pending: 'placed',
    accepted: 'confirmed',
    cooking: 'preparing',
    ready: 'ready_for_delivery',
    dispatched: 'out_for_delivery',
    delivering: 'out_for_delivery',
    completed: 'delivered',
    done: 'delivered',
    picked_up: 'delivered',
    cancelled: 'cancelled',
    canceled: 'cancelled',
    rejected: 'cancelled',
  }
  const normalized = aliases[raw] || raw
  return isTrackingStatus(normalized) ? normalized : 'placed'
}

function normalizePaymentStatus(value: unknown, method: string): PaymentStatus {
  const raw = String(value || '').toLowerCase()
  if (isPaymentStatus(raw)) return raw
  if (raw === 'captured' || raw === 'completed') return 'paid'
  if (method === 'cash') return 'cash_on_delivery'
  return 'pending'
}

function canManageOrders(role?: string | null) {
  return role === 'super_admin' || role === 'admin' || role === 'cashier'
}

function canDeleteOrders(role?: string | null) {
  return role === 'super_admin' || role === 'admin'
}

function hasOwn(body: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(body, key)
}

function getOrderSubtotal(body: Record<string, unknown>) {
  if (Array.isArray(body.lines)) {
    const linesTotal = body.lines.reduce((sum, line) => {
      if (!line || typeof line !== 'object') return sum
      const item = line as Record<string, unknown>
      return sum + Number(item.price || 0) * Number(item.quantity || 0)
    }, 0)
    if (linesTotal > 0) return linesTotal
  }

  return Number(body.subtotal || body.itemsTotal || body.amount || body.total || 0)
}

async function normalizeOrderLines(body: Record<string, unknown>): Promise<TrackedOrder['lines'] | undefined> {
  const source = Array.isArray(body.lines)
    ? body.lines
    : Array.isArray(body.orderLines)
      ? body.orderLines
      : Array.isArray(body.cartItems)
        ? body.cartItems
        : Array.isArray(body.items)
          ? body.items
          : undefined
  if (!source) return undefined

  const { products, categories } = await readSharedAppData()
  const productMap = new Map(products.map((p) => [p.id, p]))
  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  return source
    .map((line) => {
      if (!line || typeof line !== 'object') return null
      const item = line as Record<string, unknown>
      const productInfo = item.product && typeof item.product === 'object' ? item.product as Record<string, unknown> : {}
      const productId = String(item.productId || productInfo.id || '')
      const product = productId ? productMap.get(productId) : undefined
      const categoryId = product?.categoryId || (item.categoryId || productInfo.categoryId ? String(item.categoryId || productInfo.categoryId) : undefined)
      const category = categoryId ? categoryMap.get(categoryId) : undefined

      const additions = Array.isArray(item.additions)
        ? item.additions.map((addition) => String(addition)).filter(Boolean)
        : undefined
      const fallbackName = String(item.name || item.nameAr || item.nameEn || item.productName || productInfo.name || productInfo.nameAr || productInfo.nameEn || '').trim()
      const placeholderNames = new Set(['item', 'new item', 'منتج', 'منتج جديد'])
      const nameAr = String(item.nameAr || productInfo.nameAr || product?.nameAr || '').trim() || undefined
      const nameEn = String(item.nameEn || productInfo.nameEn || product?.nameEn || '').trim() || undefined
      const resolvedName = product
        ? (nameAr || nameEn || fallbackName || 'Item')
        : fallbackName || nameAr || nameEn || 'Item'
      return {
        productId: productId || undefined,
        name: product && (!fallbackName || placeholderNames.has(fallbackName.toLowerCase())) ? resolvedName : (fallbackName || resolvedName),
        nameAr,
        nameEn,
        product: product
          ? {
              id: product.id,
              productId: product.id,
              name: product.nameAr || product.nameEn,
              nameAr: product.nameAr,
              nameEn: product.nameEn,
            }
          : productInfo.id || productInfo.name || productInfo.nameAr || productInfo.nameEn
            ? {
                id: productInfo.id ? String(productInfo.id) : undefined,
                productId: productInfo.productId ? String(productInfo.productId) : undefined,
                name: productInfo.name ? String(productInfo.name) : undefined,
                nameAr: productInfo.nameAr ? String(productInfo.nameAr) : undefined,
                nameEn: productInfo.nameEn ? String(productInfo.nameEn) : undefined,
              }
            : undefined,
        quantity: Number(item.quantity || item.qty || 1),
        price: Number(item.price || productInfo.price || product?.price || 0),
        notes: item.notes || item.note ? String(item.notes || item.note) : undefined,
        additions,
        categoryName: category?.nameAr || (item.categoryName || item.category || productInfo.categoryName ? String(item.categoryName || item.category || productInfo.categoryName) : undefined),
        categoryId,
      }
    })
    .filter(Boolean) as TrackedOrder['lines']
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders })
}

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getRequestAuthenticatedUserEmail(request)
    const access = await getRequestDashboardAccess(request)
    const isAdmin = access.allowed
    const includeReceipts = request.nextUrl.searchParams.get('includeReceipts') === '1'
    const requestedOrderIdRaw = request.nextUrl.searchParams.get('orderId')?.trim()
    const requestedOrderId = requestedOrderIdRaw?.toLowerCase()
    const source = requestedOrderId ? undefined : normalizeSourceFilter(request.nextUrl.searchParams.get('source'))
    const requestedShiftId = request.nextUrl.searchParams.get('shiftId')?.trim() || undefined
    const limit = normalizeLimit(request.nextUrl.searchParams.get('limit'))
    const readLimit = access.role === 'delivery' && !requestedOrderIdRaw ? Math.max(limit, 500) : limit
    const allOrders = await readServerOrders({
      source,
      shiftId: requestedShiftId,
      limit: readLimit,
      orderId: requestedOrderIdRaw || undefined,
      includeReceipts,
    })
    const orders = requestedOrderId
      ? allOrders.filter((order) => order.id.toLowerCase() === requestedOrderId)
      : allOrders
    const compactOrders = orders.map((order) => stripHeavyOrderFields(order, { includeReceipts }))

    if (access.role === 'delivery') {
      return json({ orders: compactOrders.filter((order) => isOrderAssignedToDelivery(order, access)) })
    }

    if (isAdmin) return json({ orders: compactOrders })
    if (!userEmail) return json({ orders: [] })

    return json({
      orders: compactOrders.filter((order) => order.customerEmail?.toLowerCase() === userEmail),
    })
  } catch (error) {
    console.error('Failed to read POS orders:', error)
    return json({ error: 'Could not load orders', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!validateOptionalApiKey(request)) {
      return json({ error: 'Invalid POS API key' }, { status: 401 })
    }

    const body = await request.json()
    const now = new Date().toISOString()
    const id = String(body.id || body.orderId || body.posOrderId || body.externalReference || `ORD${Date.now()}`)
    const status = normalizeTrackingStatus(body.status || body.state || body.orderStatus)
    const customer = body.customer && typeof body.customer === 'object' ? body.customer : {}
    const payment = body.payment && typeof body.payment === 'object' ? body.payment : {}
    const paymentMethod = String(payment.method || body.paymentMethod || body.payMethod || 'cash')
    const customerEmail = String(customer.email || body.customerEmail || body.email || '').toLowerCase()
    const driverFromBody = body.driver && typeof body.driver === 'object' ? body.driver as Record<string, unknown> : null
    const requestEmail = await getRequestAuthenticatedUserEmail(request)
    const hasValidPosKey = getRequestApiKey(request) ? validateOptionalApiKey(request) : false
    const isAdmin = (await getRequestDashboardAccess(request)).allowed
    const orderSource = String(body.source || 'app')

    if (!hasValidPosKey && !isAdmin && (!requestEmail || requestEmail !== customerEmail)) {
      return json({ error: 'You can only create orders for your signed-in account' }, { status: 403 })
    }

    if (!hasValidPosKey && !isAdmin && orderSource !== 'restaurant_pos') {
      const appData = await readSharedAppData()
      if (appData.settings.restaurantOpen === false) {
        return json({
          error: 'Restaurant is closed',
          message: `The restaurant is currently closed. Working hours: ${appData.settings.workingHoursEn}`,
        }, { status: 423 })
      }
    }

    let resolvedShiftId = String(body.shiftId || body.shift || request.headers.get('x-shift-id') || '').trim() || undefined
    if (resolvedShiftId) {
      if (await isShiftLocked(resolvedShiftId)) {
        const currentOpenShift = await getCurrentOpenShift()
        resolvedShiftId = currentOpenShift?.id || resolvedShiftId
      }
    } else {
      const currentOpenShift = await getCurrentOpenShift()
      resolvedShiftId = currentOpenShift?.id
    }

    const subtotal = getOrderSubtotal(body)
    const tax = Math.max(0, Number(body.tax || 0))
    const deliveryFee = Math.max(0, Number(body.deliveryFee || body.delivery || 0))
    const discountCode = String(body.discountCode || body.discount?.code || '').trim()
    let discount: TrackedOrder['discount'] | undefined

    if (discountCode) {
      const notifications = await readServerNotifications()
      const result = validateNotificationDiscount(notifications, discountCode, subtotal)
      if (!result.valid) {
        return json({ error: result.reason }, { status: 400 })
      }
      discount = {
        code: result.code,
        type: result.discountType,
        value: result.discountValue,
        amount: Number(result.discountAmount.toFixed(2)),
      }
    }

    const calculatedTotal = subtotal + tax + deliveryFee - (discount?.amount || 0)
    const finalTotal = Math.max(0, Number(calculatedTotal.toFixed(2)))
    const lines = await normalizeOrderLines(body)

    const order: TrackedOrder = {
      // associate with shiftId provided by header or body when available
      shiftId: resolvedShiftId,
      displayNumber: undefined,
      id,
      source: orderSource,
      externalReference: body.externalReference || body.posOrderId ? String(body.externalReference || body.posOrderId) : undefined,
      customer: String(customer.name || body.customerName || body.customer || 'Customer'),
      customerEmail,
      phone: String(customer.phone || body.phone || ''),
      address: String(customer.address || body.address || ''),
      notes: String(customer.notes || body.notes || body.note || '').trim() || undefined,
      subtotal: Number(subtotal.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      deliveryFee: Number(deliveryFee.toFixed(2)),
      total: finalTotal,
      items: Number(body.items || body.itemsCount || body.lines?.length || 0),
      lines,
      status,
      createdAt: String(body.createdAt || now),
      estimatedDelivery: String(body.estimatedDelivery || '30 min'),
      driver: {
        name: String(driverFromBody?.name || body.driver?.name || 'Pending assignment'),
        email: String(driverFromBody?.email || body.driver?.email || ''),
        phone: String(driverFromBody?.phone || body.driver?.phone || '-'),
        rating: Number(driverFromBody?.rating || body.driver?.rating || 0),
      },
      payment: {
        method: paymentMethod,
        status: normalizePaymentStatus(payment.status || body.paymentStatus, paymentMethod),
        receiptName: payment.receiptName ? String(payment.receiptName) : undefined,
        receiptDataUrl: payment.receiptDataUrl ? String(payment.receiptDataUrl) : undefined,
        receiptUploadedAt: payment.receiptUploadedAt ? String(payment.receiptUploadedAt) : undefined,
      },
      discount,
      history: Array.isArray(body.history) && body.history.length > 0
        ? body.history
        : [{ status, at: String(body.createdAt || now) }],
    }

    // Require shift association for non-admin/non-pos-key clients
    const orderShiftId = order.shiftId
    if (!orderShiftId && !hasValidPosKey && !isAdmin) {
      return json({ error: 'shift_id_required', message: 'A shift id must be provided in x-shift-id header or body.shiftId' }, { status: 412 })
    }

    if (orderShiftId) {
      if (!(await ensureShiftExists(orderShiftId))) {
        await createShift(requestEmail || customerEmail || null, {
          id: orderShiftId,
          openedAt: String(body.shiftOpenedAt || body.openedAt || body.createdAt || now),
        })
      }
      if (await isShiftLocked(orderShiftId)) {
        return json({ error: 'shift_locked', message: 'Cannot create orders for a closed or locked shift' }, { status: 423 })
      }
    }

    const savedOrder = await saveNewServerOrder(order)
    return json({ order: savedOrder }, { status: 201 })
  } catch (error) {
    console.error('Failed to create POS order:', error)
    return json({ error: 'Could not create order', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const hasValidPosKey = getRequestApiKey(request) ? validateOptionalApiKey(request) : false
    const access = await getRequestDashboardAccess(request)
    const isAdmin = access.allowed
    if (!hasValidPosKey && !isAdmin) {
      return json({ error: 'Invalid POS API key' }, { status: 401 })
    }

    const body = await request.json() as Record<string, unknown>
    const id = String(body.id || body.orderId || body.posOrderId || '')
    const rawStatus = body.status || body.state || body.orderStatus
    const status = rawStatus ? normalizeTrackingStatus(rawStatus) : undefined

    if (!id || (rawStatus && (!status || !isTrackingStatus(status)))) {
      return json({ error: 'Invalid order id or status' }, { status: 400 })
    }

    if (access.role === 'delivery') {
      const orders = await readServerOrders({ orderId: id, includeReceipts: true })
      const existing = orders.find((order) => order.id.toLowerCase() === id.toLowerCase())
      if (!existing || !isOrderAssignedToDelivery(existing, access)) {
        return json({ error: 'Forbidden' }, { status: 403 })
      }
      if (body.driver || body.payment || body.paymentStatus) {
        return json({ error: 'Delivery users can only update assigned order status' }, { status: 403 })
      }
    }

    const hasDetailUpdates = [
      'customer',
      'customerName',
      'phone',
      'address',
      'notes',
      'total',
      'subtotal',
      'tax',
      'deliveryFee',
      'lines',
      'items',
      'estimatedDelivery',
      'paymentMethod',
      'paymentStatus',
    ].some((key) => hasOwn(body, key)) || (body.payment && typeof body.payment === 'object')

    const existingOrder = id ? (await readServerOrders({ orderId: id, includeReceipts: true }))[0] : null
    if (existingOrder?.shiftId && await isShiftLocked(existingOrder.shiftId)) {
      return json({ error: 'shift_locked', message: 'Cannot update orders from a closed or locked shift' }, { status: 423 })
    }

    if (hasDetailUpdates && !hasValidPosKey && !canManageOrders(access.role)) {
      return json({ error: 'Forbidden', message: 'You do not have permission to edit order details' }, { status: 403 })
    }

    const payment = body.payment && typeof body.payment === 'object' ? body.payment as Record<string, unknown> : {}
    const auditUser = typeof body.auditUser === 'string' && body.auditUser.trim() ? body.auditUser.trim() : access.email || 'dashboard'
    const auditNote = typeof body.auditNote === 'string' && body.auditNote.trim() ? body.auditNote.trim() : undefined
    const driverInput = body.driver && typeof body.driver === 'object' ? body.driver as Record<string, unknown> : null
    const discountInput = hasOwn(body, 'discount') ? body.discount : undefined
    let discount: TrackedOrder['discount'] | undefined
    if (discountInput !== undefined) {
      if (typeof discountInput === 'number') {
        const amount = Math.max(0, Number(discountInput || 0))
        discount = amount > 0 ? { code: '', type: 'fixed', value: amount, amount: Number(amount.toFixed(2)) } : undefined
      } else if (typeof discountInput === 'object') {
        const discountPayload = discountInput as Record<string, unknown>
        const amount = Number(discountPayload.amount || discountPayload.value || 0)
        if (Number.isFinite(amount) && amount > 0) {
          const type = String(discountPayload.type || 'fixed') === 'percent' ? 'percent' as const : 'fixed' as const
          discount = {
            code: String(discountPayload.code || ''),
            type,
            value: Number(discountPayload.value || amount),
            amount: Number(amount.toFixed(2)),
          }
        } else {
          discount = undefined
        }
      }
    }
    const driver = driverInput
      ? {
          name: String(driverInput.name || 'Pending assignment'),
          email: String(driverInput.email || ''),
          phone: String(driverInput.phone || '-'),
          rating: Number(driverInput.rating || 0),
        }
      : undefined
    const paymentStatus = body.paymentStatus || payment.status
    const lines = await normalizeOrderLines(body)
    const subtotal = hasOwn(body, 'subtotal')
      ? Math.max(0, Number(body.subtotal || 0))
      : lines
        ? lines.reduce((sum, line) => sum + Number(line.price || 0) * Number(line.quantity || 0), 0)
        : undefined
    const tax = hasOwn(body, 'tax') ? Math.max(0, Number(body.tax || 0)) : undefined
    const deliveryFee = hasOwn(body, 'deliveryFee') ? Math.max(0, Number(body.deliveryFee || 0)) : undefined
    const itemCount = hasOwn(body, 'items')
      ? Math.max(0, Number(body.items || 0))
      : lines
        ? lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0)
        : undefined

    const paymentMethod = hasOwn(body, 'paymentMethod') || payment.method
      ? String(payment.method || body.paymentMethod || 'cash')
      : undefined
    const paymentUpdates = paymentStatus || paymentMethod
      ? {
          ...(paymentMethod ? { method: paymentMethod } : {}),
          ...(paymentStatus ? { status: normalizePaymentStatus(paymentStatus, String(paymentMethod || payment.method || 'cash')) } : {}),
        }
      : undefined

    const subtotalChanged = hasOwn(body, 'subtotal') || Boolean(lines)
    const taxChanged = hasOwn(body, 'tax')
    const deliveryFeeChanged = hasOwn(body, 'deliveryFee')
    const discountChanged = discountInput !== undefined

    let updatedTotal: number | undefined
    if (subtotalChanged || taxChanged || deliveryFeeChanged || discountChanged) {
      const currentOrder = existingOrder
      const baseSubtotal = typeof subtotal === 'number' && Number.isFinite(subtotal) ? subtotal : Number(currentOrder?.subtotal || 0)
      const baseTax = typeof tax === 'number' && Number.isFinite(tax) ? tax : Number(currentOrder?.tax || 0)
      const baseDeliveryFee = typeof deliveryFee === 'number' && Number.isFinite(deliveryFee) ? deliveryFee : Number(currentOrder?.deliveryFee || 0)
      const baseDiscountAmount = discount && typeof discount.amount === 'number' ? Math.max(0, Number(discount.amount)) : (currentOrder?.discount?.amount ? Number(currentOrder.discount.amount) : 0)
      updatedTotal = Math.max(0, Number((baseSubtotal + baseTax + baseDeliveryFee - baseDiscountAmount).toFixed(2)))
    }

    const order = hasDetailUpdates || !status
      ? await updateServerOrder(id, {
          ...(status ? { status } : {}),
          ...(hasOwn(body, 'customer') || hasOwn(body, 'customerName') ? { customer: String(body.customer || body.customerName || '').trim() || 'Customer' } : {}),
          ...(hasOwn(body, 'phone') ? { phone: String(body.phone || '') } : {}),
          ...(hasOwn(body, 'address') ? { address: String(body.address || '') } : {}),
          ...(hasOwn(body, 'notes') ? { notes: String(body.notes || '').trim() || undefined } : {}),
          ...(typeof subtotal === 'number' && Number.isFinite(subtotal) ? { subtotal: Number(subtotal.toFixed(2)) } : {}),
          ...(typeof tax === 'number' && Number.isFinite(tax) ? { tax: Number(tax.toFixed(2)) } : {}),
          ...(typeof deliveryFee === 'number' && Number.isFinite(deliveryFee) ? { deliveryFee: Number(deliveryFee.toFixed(2)) } : {}),
          ...(updatedTotal !== undefined ? { total: updatedTotal } : (hasOwn(body, 'total') ? { total: Math.max(0, Number(body.total || 0)) } : {})),
          ...(typeof itemCount === 'number' && Number.isFinite(itemCount) ? { items: itemCount } : {}),
          ...(lines ? { lines } : {}),
          ...(hasOwn(body, 'estimatedDelivery') ? { estimatedDelivery: String(body.estimatedDelivery || '') } : {}),
          ...(driver ? { driver } : {}),
          ...(discountInput !== undefined ? { discount } : {}),
          ...(paymentUpdates ? { payment: paymentUpdates } : {}),
          audit: {
            user: auditUser,
            note: auditNote || (hasDetailUpdates ? 'Order details updated' : 'Order status updated'),
          },
        })
      : await updateServerOrderStatus(id, status || 'placed', {
          driver,
          payment: paymentUpdates,
        })

    if (!order) {
      return json({ error: 'Order not found' }, { status: 404 })
    }

    return json({ order })
  } catch (error) {
    console.error('Failed to update POS order:', error)
    return json({ error: 'Could not update order', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const hasValidPosKey = getRequestApiKey(request) ? validateOptionalApiKey(request) : false
    const access = await getRequestDashboardAccess(request)
    const isAdmin = access.allowed
    if (!hasValidPosKey && !isAdmin) {
      return json({ error: 'Invalid POS API key' }, { status: 401 })
    }

    if (!hasValidPosKey && !canDeleteOrders(access.role)) {
      return json({ error: 'Forbidden', message: 'You do not have permission to delete orders' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const id = String(body.id || body.orderId || body.posOrderId || '')

    if (!id) {
      return json({ error: 'Order id is required' }, { status: 400 })
    }

    const existingOrder = (await readServerOrders({ orderId: id, includeReceipts: true }))[0]
    if (existingOrder?.shiftId && await isShiftLocked(existingOrder.shiftId)) {
      return json({ error: 'shift_locked', message: 'Cannot delete orders from a closed or locked shift' }, { status: 423 })
    }

    const deleted = await deleteServerOrder(id)
    if (!deleted) {
      return json({ error: 'Order not found' }, { status: 404 })
    }

    return json({ deleted: true, id })
  } catch (error) {
    console.error('Failed to delete POS order:', error)
    return json({ error: 'Could not delete order', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
