'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Edit3, Printer, ReceiptText, Save, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN, ORDER_STATUS_LABELS, ORDER_STATUS_LABELS_EN } from '@/lib/constants'
import { MenuProduct, PrinterRole, useAppStore } from '@/lib/app-store'
import { fetchDashboardOrderDetails, fetchDashboardOrdersBySource } from '@/lib/dashboard-order-fetch'
import { OrderLine, TrackedOrder, TrackingStatus } from '@/lib/order-tracking'
import { printerManager, syncPrinterManagerSettings, trackedOrderToReceiptPayload } from '@/lib/printer'
import { mergeDrivers } from '@/lib/use-shared-app-data'

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
}

function canManageOrderRole(role: string | null) {
  return role === 'super_admin' || role === 'admin' || role === 'cashier'
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
  const loadingOrders = useRef(false)
  const canEditOrders = canManageOrderRole(dashboardRole)
  const canDeleteOrders = canEditOrders
  const canModifyPrices = dashboardRole === 'super_admin' || dashboardRole === 'admin'
  const isCashier = dashboardRole === 'cashier'

  const loadOrders = useCallback(async () => {
    if (loadingOrders.current) return
    loadingOrders.current = true
    try {
      const nextOrders = await fetchDashboardOrdersBySource('restaurant_pos', 120)
      setOrders(nextOrders)
      const inferredDrivers = nextOrders.flatMap((order) => {
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
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(loadOrders, 0)
    const interval = window.setInterval(loadOrders, 10000)
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

  const deleteOrder = async (orderId: string) => {
    const response = await fetch('/api/pos/orders', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    })
    const data = await response.json().catch(() => ({}))
    setMessage(response.ok ? (isArabic ? 'تم حذف طلب المطعم.' : 'Restaurant order deleted.') : data.message || data.error || (isArabic ? 'تعذر حذف الطلب.' : 'Could not delete order.'))
    if (response.ok) loadOrders()
  }

  const openEditOrder = (order: TrackedOrder) => {
    setEditingOrder(order)
    setEditForm({
      id: order.id,
      status: order.status,
      customer: order.customer || '',
      phone: order.phone || '',
      address: order.address || '',
      notes: order.notes || '',
      total: String(Number(order.total || 0)),
      estimatedDelivery: order.estimatedDelivery || '',
      paymentMethod: order.payment?.method || 'cash',
      paymentStatus: order.payment?.status || 'pending',
      lines: order.lines?.length
        ? order.lines.map((line) => ({ ...line }))
        : [{ name: isArabic ? 'منتج' : 'Item', quantity: Math.max(1, Number(order.items || 1)), price: Number(order.total || 0), notes: order.notes }],
    })
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
    invoiceName: isArabic ? settings.invoiceNameAr : settings.invoiceNameEn,
    invoiceAddress: isArabic ? settings.addressAr : settings.addressEn,
    invoicePhone: settings.phone,
    invoiceQrUrl: settings.printers.cashier.printsQr === false ? undefined : settings.invoiceQrUrl,
    invoiceQrUrl2: settings.printers.cashier.printsQr === false ? undefined : settings.invoiceQrUrl2,
    invoiceMessage: isArabic ? settings.invoiceWelcomeAr : settings.invoiceWelcomeEn,
    logoUrl: settings.invoiceLogo,
  })

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return orders
    return orders.filter((order) => {
      const haystack = [order.customer, order.phone, order.address, order.notes, order.id]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [orders, search])

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
          <div className="w-full max-w-2xl rounded-lg bg-white p-4 shadow-xl dark:bg-slate-950">
            <div className="flex items-start justify-between gap-3 border-b pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold">{isArabic ? 'تعديل الطلب' : 'Edit Order'}</h3>
                <p className="break-all text-sm text-slate-500">{editingOrder.id}</p>
              </div>
              <Button type="button" size="icon" variant="ghost" onClick={closeEditOrder}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Input value={editForm.customer} onChange={(event) => setEditForm({ ...editForm, customer: event.target.value })} placeholder={isArabic ? 'اسم العميل' : 'Customer name'} />
              <Input value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} placeholder={isArabic ? 'رقم الهاتف' : 'Phone'} />
              <Input className="sm:col-span-2" value={editForm.address} onChange={(event) => setEditForm({ ...editForm, address: event.target.value })} placeholder={isArabic ? 'العنوان' : 'Address'} />
              <Input type="number" min="0" step="0.01" value={editForm.total} onChange={(event) => setEditForm({ ...editForm, total: event.target.value })} placeholder={isArabic ? 'الإجمالي' : 'Total'} />
              <Input value={editForm.estimatedDelivery} onChange={(event) => setEditForm({ ...editForm, estimatedDelivery: event.target.value })} placeholder={isArabic ? 'نوع/وقت الطلب' : 'Order type/time'} />
              <select value={editForm.paymentMethod} onChange={(event) => setEditForm({ ...editForm, paymentMethod: event.target.value })} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950">
                <option value="cash">{isArabic ? 'نقدي' : 'Cash'}</option>
                <option value="card">{isArabic ? 'بطاقة' : 'Card'}</option>
                <option value="vodafone_cash">Vodafone Cash</option>
                <option value="instapay">InstaPay</option>
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
            <div className="mt-4 space-y-3 rounded-md border p-3 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{isArabic ? 'أصناف الطلب' : 'Order Items'}</p>
                <div className="flex flex-wrap gap-2">
                  <select
                    value=""
                    onChange={(event) => {
                      const product = products.find((item) => item.id === event.target.value)
                      if (product) addEditLine(product)
                    }}
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                  >
                    <option value="">{isArabic ? 'إضافة منتج' : 'Add product'}</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>{isArabic ? product.nameAr : product.nameEn}</option>
                    ))}
                  </select>
                  <Button type="button" size="sm" variant="outline" onClick={() => addEditLine()}>
                    {isArabic ? 'سطر جديد' : 'New line'}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {editForm.lines.map((line, index) => (
                  <div key={index} className="grid gap-2 rounded-md bg-slate-50 p-2 dark:bg-slate-900 sm:grid-cols-[minmax(0,1fr)_90px_110px_auto]">
                    <Input value={line.name} onChange={(event) => updateEditLine(index, { name: event.target.value })} placeholder={isArabic ? 'اسم المنتج' : 'Item name'} />
                    <Input type="number" min="1" value={String(line.quantity || 1)} onChange={(event) => updateEditLine(index, { quantity: Math.max(1, Number(event.target.value || 1)) })} placeholder={isArabic ? 'العدد' : 'Qty'} />
                    <Input type="number" min="0" step="0.01" value={String(line.price || 0)} onChange={(event) => updateEditLine(index, { price: Math.max(0, Number(event.target.value || 0)) })} placeholder={isArabic ? 'السعر' : 'Price'} disabled={!canModifyPrices} />
                    <Button type="button" variant="destructive" size="sm" onClick={() => removeEditLine(index)}>{isArabic ? 'حذف' : 'Delete'}</Button>
                    <Textarea className="sm:col-span-4" value={line.notes || ''} onChange={(event) => updateEditLine(index, { notes: event.target.value })} placeholder={isArabic ? 'ملاحظات الصنف' : 'Item notes'} />
                  </div>
                ))}
              </div>
              <p className="text-end text-sm font-bold">
                {isArabic ? 'إجمالي الأصناف' : 'Items Total'}: {editForm.lines.reduce((sum, line) => sum + Number(line.price || 0) * Number(line.quantity || 0), 0).toFixed(2)} {currency}
              </p>
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
            placeholder={isArabic ? 'ابحث بالاسم أو الهاتف أو العنوان' : 'Search by name, phone or address'}
          />
          {loading ? (
            <p className="py-8 text-center text-slate-500">{isArabic ? 'جاري التحميل...' : 'Loading...'}</p>
          ) : filteredOrders.length === 0 ? (
            <p className="py-8 text-center text-slate-500">{isArabic ? 'لا توجد نتائج مطابقة للبحث.' : 'No matching orders found.'}</p>
          ) : (
            <div className="min-w-0 space-y-3">
              {filteredOrders.map((order) => (
                <div key={order.id} className="min-w-0 max-w-full overflow-hidden rounded-md border p-4 dark:border-slate-800">
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-all font-semibold">{order.id}</p>
                      <p className="text-sm text-slate-500">{order.customer} - {order.phone || '-'}</p>
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
                      <Button key={status} size="sm" variant={order.status === status ? 'default' : 'outline'} onClick={() => updateStatus(order.id, status)}>
                        {label(status)}
                      </Button>
                    ))}
                    {canEditOrders && <Button size="sm" variant="outline" className="gap-2" onClick={() => openEditOrder(order)}>
                      <Edit3 className="h-4 w-4" />
                      {isArabic ? 'تعديل' : 'Edit'}
                    </Button>}
                    {canDeleteOrders && <Button size="sm" variant="destructive" onClick={() => deleteOrder(order.id)}>{isArabic ? 'حذف' : 'Delete'}</Button>}
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
