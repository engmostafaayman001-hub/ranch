'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Edit3, Printer, ReceiptText, Save, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/components/language-provider'
import { canManageOrders } from '@/lib/permissions'
import { CURRENCY, CURRENCY_EN, ORDER_STATUS_LABELS, ORDER_STATUS_LABELS_EN, PAYMENT_METHOD_OPTIONS } from '@/lib/constants'
import { MenuProduct, PrinterRole, useAppStore } from '@/lib/app-store'
import { fetchDashboardOrderDetails, fetchDashboardOrdersBySource } from '@/lib/dashboard-order-fetch'
import { OrderLine, TrackedOrder, TrackingStatus } from '@/lib/order-tracking'
import { printerManager, syncPrinterManagerSettings, trackedOrderToReceiptPayload } from '@/lib/printer'
import { mergeDrivers } from '@/lib/use-shared-app-data'
import { getSettledClosingIds, readAllClosings } from '@/lib/closings'

const statuses: TrackingStatus[] = ['placed', 'confirmed', 'preparing', 'ready_for_delivery', 'out_for_delivery', 'delivered', 'cancelled']

type OrderEditForm = {
  id: string
  status: TrackingStatus
  customer: string
  phone: string
  address: string
  notes: string
  total: string
  estimatedDelivery: string
  paymentMethod: string
  paymentStatus: string
  lines: OrderLine[]
  _searchProduct?: string
}

function canManageOrderRole(role: string | null) {
  return canManageOrders(role)
}

export default function DashboardRestaurantOrdersPage() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const settings = useAppStore((state) => state.settings)
  const drivers = useAppStore((state) => state.drivers)
  const setDrivers = useAppStore((state) => state.setDrivers)
  const products = useAppStore((state) => state.products)
  const categories = useAppStore((state) => state.categories)
  const [orders, setOrders] = useState<TrackedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [driverSelections, setDriverSelections] = useState<Record<string, string>>({})
  const [dashboardRole, setDashboardRole] = useState<string | null>(null)
  const [editingOrder, setEditingOrder] = useState<TrackedOrder | null>(null)
  const [editForm, setEditForm] = useState<OrderEditForm | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [, setLoadingEdit] = useState(false)
  const loadingOrders = useRef(false)
  const canEditOrders = canManageOrderRole(dashboardRole)
  const canModifyPrices = dashboardRole === 'super_admin' || dashboardRole === 'admin'
  const isCashier = dashboardRole === 'cashier'

  const loadOrders = useCallback(async () => {
    if (loadingOrders.current) return
    loadingOrders.current = true
    try {
      const [appOrders, restaurantOrders] = await Promise.all([
        fetchDashboardOrdersBySource('app', 180),
        fetchDashboardOrdersBySource('restaurant_pos', 180),
      ])
      const previousClosings = await readAllClosings()
      const settledOrderIds = getSettledClosingIds(previousClosings).orderIds
      const mergedOrders = [...appOrders, ...restaurantOrders]
      const uniqueOrders = mergedOrders.filter((order, index, array) => !settledOrderIds.has(order.id) && array.findIndex((entry) => entry.id === order.id) === index)
      setOrders(uniqueOrders)
      const inferredDrivers = uniqueOrders.flatMap((order) => {
        if (!order.driver?.name || order.driver.name === 'Pending assignment') return []
        return [{ id: order.driver.email || order.driver.phone || order.driver.name, name: order.driver.name, email: order.driver.email || '', phone: order.driver.phone || '', area: '', status: 'active' as const }]
      })
      if (inferredDrivers.length > 0) {
        setDrivers(mergeDrivers(drivers, inferredDrivers))
      }
      setMessage('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not refresh orders. Showing the last loaded list.')
    } finally {
      loadingOrders.current = false
      setLoading(false)
    }
  }, [drivers, setDrivers])
  useEffect(() => {
    const timer = window.setTimeout(loadOrders, 0)
    const interval = window.setInterval(loadOrders, 30000)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(interval)
    }
  }, [loadOrders])

  useEffect(() => {
    let active = true
    fetch('/api/auth/dashboard-access', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (active) setDashboardRole(typeof data.role === 'string' ? data.role : null)
      })
      .catch(() => {
        if (active) setDashboardRole(null)
      })

    return () => {
      active = false
    }
  }, [])

  const label = (status: string) => (isArabic ? ORDER_STATUS_LABELS : ORDER_STATUS_LABELS_EN)[status as keyof typeof ORDER_STATUS_LABELS] || status

  const normalizeOrderLine = (line: OrderLine): OrderLine => {
    const source = line as OrderLine & {
      productName?: string
      category?: string
      product?: OrderLine['product'] & {
        categoryName?: string
        category?: { name?: string }
      }
    }
    const productSource = source.product && typeof source.product === 'object' ? source.product : null
    const rawName = source.name || source.productName || source.nameEn || source.nameAr || productSource?.name || productSource?.nameEn || productSource?.nameAr || ''
    const rawCategory = source.categoryName || source.category || productSource?.categoryName || productSource?.category?.name || ''
    const productId = source.productId || productSource?.id || ''
    return {
      ...source,
      productId: productId ? String(productId) : undefined,
      name: typeof rawName === 'string' ? rawName.trim() : '',
      categoryName: typeof rawCategory === 'string' ? rawCategory.trim() : undefined,
      price: Number(source.price || 0),
      quantity: Math.max(1, Number(source.quantity || 1)),
      notes: source.notes ? String(source.notes) : undefined,
    }
  }

  const getOrderLineProduct = (line: OrderLine) => {
    const productId = String(line.productId || '')
    const normalizedLineName = line.name?.toString().trim().toLowerCase() || ''
    const searchName = normalizedLineName
    let product = productId ? products.find((item) => String(item.id) === productId) : undefined
    if (!product && searchName) {
      product = products.find((item) => {
        const nameAr = item.nameAr?.toString().trim().toLowerCase() || ''
        const nameEn = item.nameEn?.toString().trim().toLowerCase() || ''
        return nameAr === searchName || nameEn === searchName || nameAr.includes(searchName) || nameEn.includes(searchName)
      })
    }
    return product
  }

  const getOrderLineDisplayName = (line: OrderLine) => {
    const productId = String(line.productId || line.product?.id || line.product?.productId || '').trim()
    const product = productId
      ? products.find((item) => String(item.id) === productId)
      : getOrderLineProduct(line)

    const trimmedName = line.name?.toString().trim() || ''
    const placeholderNames = new Set([isArabic ? 'منتج' : 'Item', isArabic ? 'منتج جديد' : 'New item'])

    if (product) return isArabic ? product.nameAr || product.nameEn || product.nameEn : product.nameEn || product.nameAr || product.nameEn
    if (trimmedName && !placeholderNames.has(trimmedName)) return trimmedName
    return isArabic ? 'منتج' : 'Item'
  }

  const isDeliveryOrder = (order: TrackedOrder) => {
    const text = `${order.estimatedDelivery || ''} ${order.address || ''}`.toLowerCase()
    return text.includes('delivery') || text.includes('دليف') || text.includes('توصيل')
  }

  const updateStatus = async (orderId: string, status: TrackingStatus) => {
    const response = await fetch('/api/pos/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, status }),
    })
    const data = await response.json().catch(() => ({}))
    setMessage(response.ok ? (isArabic ? 'تم تحديث طلب المطعم.' : 'Restaurant order updated.') : data.message || data.error || (isArabic ? 'تعذر تحديث الطلب.' : 'Could not update order.'))
    if (response.ok) loadOrders()
  }

  const openEditOrder = async (order: TrackedOrder) => {
    setLoadingEdit(true)
    try {
      const response = await fetch(`/api/pos/orders?orderId=${encodeURIComponent(order.id)}&includeReceipts=1`, { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      const detailedOrder = response.ok && Array.isArray(data.orders) && data.orders[0] ? data.orders[0] as TrackedOrder : order
      setEditingOrder(detailedOrder)
      setEditForm({
        id: detailedOrder.id,
        status: detailedOrder.status,
        customer: detailedOrder.customer || '',
        phone: detailedOrder.phone || '',
        address: detailedOrder.address || '',
        notes: detailedOrder.notes || '',
        total: String(Number(detailedOrder.total || 0)),
        estimatedDelivery: detailedOrder.estimatedDelivery || '',
        paymentMethod: detailedOrder.payment?.method || 'cash',
        paymentStatus: detailedOrder.payment?.status || 'pending',
        lines: detailedOrder.lines?.length
          ? detailedOrder.lines.map((line) => normalizeOrderLine(line))
          : [{ name: '', quantity: Math.max(1, Number(detailedOrder.items || 1)), price: Number(detailedOrder.total || 0), notes: detailedOrder.notes }],
      })
    } finally {
      setLoadingEdit(false)
    }
  }

  const closeEditOrder = () => {
    setEditingOrder(null)
    setEditForm(null)
  }


  const saveEditedOrder = async () => {
    if (!editForm || savingEdit) return
    const linesSubtotal = editForm.lines.reduce((sum, line) => sum + Number(line.price || 0) * Number(line.quantity || 0), 0)
    setSavingEdit(true)
    setMessage('')
    try {
      const response = await fetch('/api/pos/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: editForm.id,
          status: editForm.status,
          customer: editForm.customer,
          phone: editForm.phone,
          address: editForm.address,
          notes: editForm.notes,
          total: linesSubtotal,
          estimatedDelivery: editForm.estimatedDelivery,
          paymentMethod: editForm.paymentMethod,
          paymentStatus: editForm.paymentStatus,
          lines: editForm.lines,
          items: editForm.lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0),
          subtotal: linesSubtotal,
          audit: {
            user: 'dashboard-editor',
            note: 'Restaurant order edited from dashboard',
          },
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(data.message || data.error || (isArabic ? 'تعذر تعديل الطلب.' : 'Could not edit order.'))
        return
      }
      setMessage(isArabic ? 'تم تعديل الطلب بنجاح.' : 'Order updated.')
      closeEditOrder()
      loadOrders()
    } finally {
      setSavingEdit(false)
    }
  }

  const assignDriver = async (order: TrackedOrder) => {
    const driverId = driverSelections[order.id]
    const driver = drivers.find((item) => item.id === driverId)
    if (!driver) {
      setMessage(isArabic ? 'اختر السائق قبل حفظ التعيين.' : 'Choose a driver before saving the assignment.')
      return
    }

    const response = await fetch('/api/pos/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.id,
        status: order.status,
        driver: {
          name: driver.name,
          email: driver.email || '',
          phone: driver.phone,
          rating: 0,
        },
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setMessage(data.message || data.error || (isArabic ? 'تعذر تغيير السائق.' : 'Could not change driver.'))
      return
    }
    setDriverSelections((current) => ({ ...current, [order.id]: '' }))
    setMessage(isArabic ? 'تم تغيير السائق المسؤول عن الطلب.' : 'Assigned driver updated.')
    loadOrders()
  }

  const addEditLine = (product?: MenuProduct) => {
    if (!editForm) return
    const category = product ? categories.find((item) => item.id === product.categoryId) : undefined
    setEditForm({
      ...editForm,
      lines: [
        ...editForm.lines,
        product
          ? {
              name: isArabic ? product.nameAr : product.nameEn,
              quantity: 1,
              price: Number(product.price || 0),
              categoryName: category ? (isArabic ? category.nameAr : category.nameEn) : undefined,
              categoryId: product.categoryId,
              productId: product.id,
            }
          : { name: isArabic ? 'منتج جديد' : 'New item', quantity: 1, price: 0 },
      ],
    })
  }

  const updateEditLine = (index: number, updates: Partial<OrderLine>) => {
    if (!editForm) return
    setEditForm({
      ...editForm,
      lines: editForm.lines.map((line, lineIndex) => lineIndex === index ? { ...line, ...updates } : line),
    })
  }

  const removeEditLine = (index: number) => {
    if (!editForm) return
    const nextLines = editForm.lines.filter((_, lineIndex) => lineIndex !== index)
    setEditForm({ ...editForm, lines: nextLines.length ? nextLines : [{ name: isArabic ? 'منتج' : 'Item', quantity: 1, price: 0 }] })
  }

  const createPrintPayload = (order: TrackedOrder) => trackedOrderToReceiptPayload(order, {
    isArabic,
    currency,
    productCatalog: products,
    invoiceName: isArabic ? settings.invoiceNameAr : settings.invoiceNameEn,
    invoiceAddress: isArabic ? settings.addressAr : settings.addressEn,
    invoicePhone: settings.phone,
    invoiceQrUrl: settings.printers.cashier.printsQr === false ? undefined : settings.invoiceQrUrl,
    invoiceQrUrl2: settings.printers.cashier.printsQr === false ? undefined : settings.invoiceQrUrl2,
    invoiceMessage: isArabic ? settings.invoiceWelcomeAr : settings.invoiceWelcomeEn,
    logoUrl: settings.invoiceLogo,
  })

  const sortedOrders = useMemo(() => {
    return [...orders].sort((first, second) => {
      const firstNumber = Number.isFinite(first.displayNumber) ? first.displayNumber as number : NaN
      const secondNumber = Number.isFinite(second.displayNumber) ? second.displayNumber as number : NaN
      if (Number.isFinite(firstNumber) && Number.isFinite(secondNumber)) {
        return secondNumber - firstNumber
      }
      if (Number.isFinite(firstNumber)) return -1
      if (Number.isFinite(secondNumber)) return 1
      return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
    })
  }, [orders])

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return sortedOrders
    return sortedOrders.filter((order) => {
      const haystack = [order.displayNumber?.toString(), order.customer, order.phone, order.address, order.notes, order.id]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [search, sortedOrders])

  const isPrinterAvailable = (role: PrinterRole) => {
    const printer = settings.printers[role]
    return printer?.isEnabled === true
  }

  const printOrder = async (order: TrackedOrder, role: PrinterRole) => {
    syncPrinterManagerSettings(settings.printers)
    try {
      const fullOrder = await fetchDashboardOrderDetails(order.id)
      const payload = createPrintPayload(fullOrder || order)
      const result = role === 'cashier'
        ? await printerManager.printCashierReceipt(payload)
        : role === 'kitchen'
          ? await printerManager.printKitchenTicket(payload)
          : await printerManager.printHallTicket(payload)
      if ((result as { skipped?: boolean; reason?: string } | undefined)?.skipped) {
        setMessage((result as { reason?: string } | undefined)?.reason || (isArabic ? 'Ù„Ù… ÙŠØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø£Ù…Ø± Ø§Ù„Ø·Ø¨Ø§Ø¹Ø© Ù„Ø£Ù† Ø¥Ø¹Ø¯Ø§Ø¯ Ø§Ù„Ø·Ø§Ø¨Ø¹Ø© ØºÙŠØ± Ù…ÙƒØªÙ…Ù„.' : 'Print job was not sent because the printer is not fully configured.'))
        return
      }
      const label = role === 'cashier'
        ? (isArabic ? 'فاتورة الكاشير' : 'cashier receipt')
        : role === 'kitchen'
          ? (isArabic ? 'فاتورة المطبخ' : 'kitchen ticket')
          : (isArabic ? 'فاتورة الصالة' : 'hall ticket')
      setMessage(isArabic ? `تم إرسال ${label} للطابعة.` : `${label} sent to printer.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (isArabic ? 'تعذر إرسال أمر الطباعة للطابعة.' : 'Could not send print job to printer.'))
    }
  }
  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
      {editingOrder && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-lg bg-white p-4 shadow-xl dark:bg-slate-950">
            <div className="flex items-start justify-between gap-3 border-b pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold">{isArabic ? 'تعديل الطلب' : 'Edit Order'}</h3>
                <p className="break-all text-sm text-slate-500">{editingOrder.id}</p>
              </div>
              <Button type="button" size="icon" variant="ghost" onClick={closeEditOrder}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Input value={editForm.customer} onChange={(event) => setEditForm({ ...editForm, customer: event.target.value })} placeholder={isArabic ? 'اسم العميل' : 'Customer name'} />
                <Input value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} placeholder={isArabic ? 'رقم الهاتف' : 'Phone'} />
                <Input className="sm:col-span-2" value={editForm.address} onChange={(event) => setEditForm({ ...editForm, address: event.target.value })} placeholder={isArabic ? 'العنوان' : 'Address'} />
                <Input type="number" min="0" step="0.01" value={editForm.total} onChange={(event) => setEditForm({ ...editForm, total: event.target.value })} placeholder={isArabic ? 'الإجمالي' : 'Total'} />
                <Input value={editForm.estimatedDelivery} onChange={(event) => setEditForm({ ...editForm, estimatedDelivery: event.target.value })} placeholder={isArabic ? 'نوع/وقت الطلب' : 'Order type/time'} />
                <select value={editForm.paymentMethod} onChange={(event) => setEditForm({ ...editForm, paymentMethod: event.target.value })} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950">
                  {PAYMENT_METHOD_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{isArabic ? option.ar : option.en}</option>
                  ))}
                </select>
                <select value={editForm.paymentStatus} onChange={(event) => setEditForm({ ...editForm, paymentStatus: event.target.value })} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950">
                  <option value="cash_on_delivery">{isArabic ? 'الدفع عند الاستلام' : 'Cash on delivery'}</option>
                  <option value="paid">{isArabic ? 'مدفوع' : 'Paid'}</option>
                  <option value="pending">{isArabic ? 'قيد المراجعة' : 'Pending'}</option>
                  <option value="receipt_uploaded">{isArabic ? 'إيصال مرفوع' : 'Receipt uploaded'}</option>
                  <option value="rejected">{isArabic ? 'مرفوض' : 'Rejected'}</option>
                </select>
                <Textarea className="sm:col-span-2" value={editForm.notes} onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })} placeholder={isArabic ? 'ملاحظات' : 'Notes'} />
              </div>
              <div className="mt-4 space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{isArabic ? 'أصناف الطلب' : 'Order Items'}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{isArabic ? 'اختر المنتج واضبط الكمية والسعر والملاحظات لكل سطر.' : 'Select products and adjust quantity, price, and notes for each line.'}</p>
                  </div>
                  <div className="w-full sm:w-[30rem]">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={editForm._searchProduct || ''}
                          onChange={(event) => setEditForm({ ...editForm, _searchProduct: event.target.value })}
                          placeholder={isArabic ? 'ابحث عن منتج' : 'Search product'}
                          className="h-10 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-500/30"
                        />
                        {editForm._searchProduct ? (
                          <div className="absolute left-0 right-0 z-20 mt-2 max-h-52 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-950">
                            {products.filter((product) => (isArabic ? product.nameAr : product.nameEn).toLowerCase().includes(editForm._searchProduct!.toLowerCase())).slice(0, 40).map((product) => (
                              <button
                                key={product.id}
                                type="button"
                                onClick={() => setEditForm({
                                  ...editForm,
                                  _searchProduct: '',
                                  lines: [
                                    ...editForm.lines,
                                    {
                                      name: isArabic ? product.nameAr : product.nameEn,
                                      quantity: 1,
                                      price: Number(product.price || 0),
                                      categoryName: categories.find((category) => category.id === product.categoryId)?.[isArabic ? 'nameAr' : 'nameEn'],
                                      categoryId: product.categoryId,
                                      productId: product.id,
                                    },
                                  ],
                                })}
                                className="w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                {isArabic ? product.nameAr : product.nameEn}
                              </button>
                            ))}
                            {products.filter((product) => (isArabic ? product.nameAr : product.nameEn).toLowerCase().includes(editForm._searchProduct!.toLowerCase())).length === 0 && (
                              <div className="p-4 text-sm text-slate-500 dark:text-slate-400">{isArabic ? 'لا يوجد منتج مطابق' : 'No matching product found'}</div>
                            )}
                          </div>
                        ) : null}
                      </div>
                      <Button type="button" size="sm" variant="outline" className="whitespace-nowrap" onClick={() => addEditLine()}>
                        {isArabic ? 'سطر جديد' : 'New line'}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <div className="grid min-w-full gap-2 border-b border-slate-200 px-2 pb-2 text-xs uppercase tracking-[0.15em] text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:grid-cols-[1.6fr_70px_90px_90px_90px]">
                    <span>{isArabic ? 'المنتج' : 'Product'}</span>
                    <span>{isArabic ? 'الكمية' : 'Qty'}</span>
                    <span>{isArabic ? 'السعر' : 'Price'}</span>
                    <span>{isArabic ? 'الإجمالي' : 'Total'}</span>
                    <span>{isArabic ? 'حذف' : 'Remove'}</span>
                  </div>
                  <div className="space-y-3 pt-3">
                    {editForm.lines.map((line, index) => {
                      const lineName = getOrderLineDisplayName(line)
                      const lineCategory = line.categoryName || (isArabic ? 'بدون تصنيف' : 'Uncategorized')
                      const lineTotal = (Number(line.price || 0) * Number(line.quantity || 0)).toFixed(2)
                      return (
                        <div key={index} className="grid min-w-full gap-2 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-[1.6fr_70px_90px_90px_90px]">
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{lineName}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{lineCategory}</p>
                          </div>
                          <Input
                            type="number"
                            min="1"
                            value={String(line.quantity || 1)}
                            onChange={(event) => updateEditLine(index, { quantity: Math.max(1, Number(event.target.value || 1)) })}
                            className="h-10 text-center"
                          />
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={String(line.price || 0)}
                            onChange={(event) => updateEditLine(index, { price: Math.max(0, Number(event.target.value || 0)) })}
                            disabled={!canModifyPrices}
                            className="h-10 text-center"
                          />
                          <div className="flex items-center justify-center rounded-2xl bg-slate-50 text-sm font-semibold text-slate-900 dark:bg-slate-950 dark:text-slate-100">{lineTotal}</div>
                          <Button type="button" variant="destructive" size="sm" onClick={() => removeEditLine(index)}>{isArabic ? 'حذف' : 'Delete'}</Button>
                          <Textarea
                            className="sm:col-span-full"
                            value={line.notes || ''}
                            onChange={(event) => updateEditLine(index, { notes: event.target.value })}
                            placeholder={isArabic ? 'ملاحظات الصنف' : 'Item notes'}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="grid gap-2 rounded-3xl border border-slate-200 bg-slate-100 p-4 text-sm dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-[1fr_auto]">
                  <p className="text-slate-700 dark:text-slate-300">{isArabic ? 'إجمالي سطر الأوامر' : 'Order lines total'}</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{editForm.lines.reduce((sum, line) => sum + Number(line.price || 0) * Number(line.quantity || 0), 0).toFixed(2)} {currency}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeEditOrder}>{isArabic ? 'إلغاء' : 'Cancel'}</Button>
              <Button type="button" className="gap-2" disabled={savingEdit} onClick={saveEditedOrder}>
                <Save className="h-4 w-4" />
                {savingEdit ? (isArabic ? 'جار الحفظ...' : 'Saving...') : (isArabic ? 'حفظ التعديل' : 'Save Changes')}
              </Button>
            </div>
          </div>
        </div>
      )}
      <div>
        <h2 className="text-3xl font-bold">{isArabic ? 'إدارة طلبات المطعم' : 'Restaurant Orders Management'}</h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">{isArabic ? 'طلبات تم إنشاؤها من نقطة بيع المطعم.' : 'Orders created from the restaurant POS.'}</p>
      </div>
      {message && <p className="rounded-md bg-slate-100 p-3 text-sm dark:bg-slate-900">{message}</p>}
      <Card>
        <CardHeader><CardTitle>{isArabic ? 'طلبات المطعم' : 'Restaurant Orders'}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={isArabic ? 'ابحث برقم الطلب أو الاسم أو الهاتف أو العنوان' : 'Search by order number, name, phone or address'}
          />
          {loading ? (
            <p className="py-8 text-center text-slate-500">{isArabic ? 'جاري التحميل...' : 'Loading...'}</p>
          ) : filteredOrders.length === 0 ? (
            <p className="py-8 text-center text-slate-500">{isArabic ? 'لا توجد نتائج مطابقة للبحث.' : 'No matching orders found.'}</p>
          ) : (
            <div className="min-w-0 space-y-3">
              {filteredOrders.map((order) => {
                const isOrderCompleted = ['delivered', 'received'].includes(order.status)
                return (
                <div key={order.id} className="min-w-0 max-w-full overflow-hidden rounded-md border p-4 dark:border-slate-800">
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-all font-semibold">#{order.displayNumber || order.id}</p>
                      <p className="text-sm text-slate-500">
                        {order.customer} - {order.phone || '-'}
                        {order.createdAt && <span className="block pt-1 text-xs">{new Date(order.createdAt).toLocaleString(isArabic ? 'ar-EG' : 'en-US')}</span>}
                      </p>
                      <p className="text-sm text-slate-500">{order.address}</p>
                      {order.notes && (
                        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                          {isArabic ? 'ملاحظات' : 'Notes'}: {order.notes}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-end">
                      {!isCashier && <p className="font-bold">{Number(order.total || 0).toFixed(2)} {currency}</p>}
                      <Badge className="bg-slate-700">{label(order.status)}</Badge>
                    </div>
                  </div>
                  <div className="mt-4 flex min-w-0 flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="gap-2" disabled={!isPrinterAvailable('cashier')} title={!isPrinterAvailable('cashier') ? (isArabic ? 'فعّل طابعة الكاشير من الإعدادات' : 'Enable cashier printer in settings') : undefined} onClick={() => printOrder(order, 'cashier')}>
                      <Printer className="h-4 w-4" />
                      {isArabic ? 'فاتورة الكاشير' : 'Cashier'}
                    </Button>
                    <Button size="sm" variant="outline" className="gap-2" disabled={!isPrinterAvailable('kitchen')} title={!isPrinterAvailable('kitchen') ? (isArabic ? 'فعّل طابعة المطبخ من الإعدادات' : 'Enable kitchen printer in settings') : undefined} onClick={() => printOrder(order, 'kitchen')}>
                      <ReceiptText className="h-4 w-4" />
                      {isArabic ? 'فاتورة المطبخ' : 'Kitchen'}
                    </Button>
                    <Button size="sm" variant="outline" className="gap-2" disabled={!isPrinterAvailable('hall')} title={!isPrinterAvailable('hall') ? (isArabic ? 'فعّل طابعة الصالة من الإعدادات' : 'Enable hall printer in settings') : undefined} onClick={() => printOrder(order, 'hall')}>
                      <ReceiptText className="h-4 w-4" />
                      {isArabic ? 'فاتورة الصالة' : 'Hall'}
                    </Button>
                    {statuses.map((status) => (
                      <Button key={status} size="sm" variant={order.status === status ? 'default' : 'outline'} onClick={() => updateStatus(order.id, status)} disabled={isOrderCompleted && status !== order.status}>
                        {label(status)}
                      </Button>
                    ))}
                    {canEditOrders && <Button size="sm" variant="outline" className="gap-2" onClick={() => openEditOrder(order)} disabled={isOrderCompleted}>
                      <Edit3 className="h-4 w-4" />
                      {isArabic ? 'تعديل' : 'Edit'}
                    </Button>}
                  </div>
                  {isDeliveryOrder(order) && (
                    <div className="mt-4 grid min-w-0 gap-2 rounded-md border bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/40 md:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{isArabic ? 'السائق المسؤول عن الدليفري' : 'Delivery driver'}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {order.driver?.name && order.driver.name !== 'Pending assignment'
                            ? `${order.driver.name}${order.driver.phone && order.driver.phone !== '-' ? ` - ${order.driver.phone}` : ''}`
                            : (isArabic ? 'لم يتم تعيين سائق بعد.' : 'No driver assigned yet.')}
                        </p>
                        <select
                          value={driverSelections[order.id] || ''}
                          onChange={(event) => setDriverSelections((current) => ({ ...current, [order.id]: event.target.value }))}
                          className="mt-3 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                        >
                          <option value="">{isArabic ? 'اختر سائقا جديدا' : 'Choose a new driver'}</option>
                          {drivers.filter((driver) => driver.status === 'active').map((driver) => (
                            <option key={driver.id} value={driver.id}>{driver.name} - {driver.phone || '-'}</option>
                          ))}
                        </select>
                      </div>
                      <Button type="button" variant="outline" className="self-end" onClick={() => assignDriver(order)}>
                        {isArabic ? 'تغيير السائق' : 'Change Driver'}
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
