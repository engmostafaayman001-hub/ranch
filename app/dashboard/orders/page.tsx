'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CreditCard, Edit3, Eye, Power, Printer, ReceiptText, Save, Store, X, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ReceiptPreviewDialog } from '@/components/receipt-preview-dialog'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/components/language-provider'
import {
  CURRENCY,
  CURRENCY_EN,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_LABELS_EN,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_LABELS_EN,
} from '@/lib/constants'
import { PrinterRole, useAppStore } from '@/lib/app-store'
import { fetchDashboardOrderDetails, fetchDashboardOrderReceipt, fetchDashboardOrdersBySource } from '@/lib/dashboard-order-fetch'
import { TrackedOrder, TrackingStatus } from '@/lib/order-tracking'
import { printerManager, syncPrinterManagerSettings, trackedOrderToReceiptPayload } from '@/lib/printer'
import { saveSharedSettings } from '@/lib/use-shared-app-data'

const statuses: TrackingStatus[] = ['placed', 'confirmed', 'preparing', 'ready_for_delivery', 'out_for_delivery', 'delivered', 'received', 'cancelled']

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
}

function canManageOrderRole(role: string | null) {
  return role === 'super_admin' || role === 'admin' || role === 'manager'
}

export default function DashboardOrdersPage() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const drivers = useAppStore((state) => state.drivers)
  const settings = useAppStore((state) => state.settings)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const [orders, setOrders] = useState<TrackedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [savingRestaurantStatus, setSavingRestaurantStatus] = useState(false)
  const [driverSelections, setDriverSelections] = useState<Record<string, string>>({})
  const [dashboardRole, setDashboardRole] = useState<string | null>(null)
  const [editingOrder, setEditingOrder] = useState<TrackedOrder | null>(null)
  const [editForm, setEditForm] = useState<OrderEditForm | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [receiptPreview, setReceiptPreview] = useState<{ url: string; title: string; name?: string } | null>(null)
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null)
  const loadingOrders = useRef(false)
  const isDeliveryUser = dashboardRole === 'delivery'
  const canEditOrders = canManageOrderRole(dashboardRole)
  const canDeleteOrders = canEditOrders
  const restaurantOpen = settings.restaurantOpen !== false

  const loadOrders = useCallback(async () => {
    if (loadingOrders.current) return
    loadingOrders.current = true
    try {
      setOrders(await fetchDashboardOrdersBySource('app', 120))
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

  const updateStatus = async (orderId: string, status: TrackingStatus) => {
    setMessage('')
    const response = await fetch('/api/pos/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, status }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setMessage(data.message || data.error || (isArabic ? 'تعذر تحديث الطلب.' : 'Could not update order.'))
      return
    }
    setMessage(isArabic ? 'تم تحديث حالة الطلب بنجاح.' : 'Order status updated.')
    loadOrders()
  }

  const deleteOrder = async (orderId: string) => {
    setMessage('')
    const response = await fetch('/api/pos/orders', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setMessage(data.message || data.error || (isArabic ? 'تعذر حذف الطلب.' : 'Could not delete order.'))
      return
    }
    setMessage(isArabic ? 'تم حذف الطلب نهائيا من لوحة التحكم.' : 'Order deleted from dashboard.')
    loadOrders()
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
    })
  }

  const closeEditOrder = () => {
    setEditingOrder(null)
    setEditForm(null)
  }

  const saveEditedOrder = async () => {
    if (!editForm || savingEdit) return
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
          total: Number(editForm.total || 0),
          estimatedDelivery: editForm.estimatedDelivery,
          paymentMethod: editForm.paymentMethod,
          paymentStatus: editForm.paymentStatus,
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

    setMessage('')
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
      setMessage(data.message || data.error || (isArabic ? 'تعذر تعيين السائق.' : 'Could not assign driver.'))
      return
    }
    setMessage(isArabic ? 'تم تعيين السائق وظهرت بياناته للعميل.' : 'Driver assigned and visible to the customer.')
    loadOrders()
  }

  const toggleRestaurantStatus = async () => {
    if (savingRestaurantStatus) return
    const nextOpen = !restaurantOpen
    const nextSettings = { ...settings, restaurantOpen: nextOpen }
    setSavingRestaurantStatus(true)
    setMessage('')
    updateSettings({ restaurantOpen: nextOpen })
    try {
      const data = await saveSharedSettings(nextSettings)
      if (data.settings) updateSettings(data.settings)
      setMessage(nextOpen ? (isArabic ? 'تم تشغيل المطعم وفتح استقبال الطلبات.' : 'Restaurant is open and accepting orders.') : (isArabic ? 'تم إغلاق المطعم وظهور التنبيه للمستخدمين.' : 'Restaurant is closed and the customer warning is visible.'))
    } catch (error) {
      updateSettings({ restaurantOpen })
      setMessage(error instanceof Error ? error.message : (isArabic ? 'تعذر حفظ حالة المطعم.' : 'Could not save restaurant status.'))
    } finally {
      setSavingRestaurantStatus(false)
    }
  }

  const label = (status: string) => (isArabic ? ORDER_STATUS_LABELS : ORDER_STATUS_LABELS_EN)[status as keyof typeof ORDER_STATUS_LABELS] || status

  const paymentMethodLabel = (method?: string) => {
    const labels = isArabic ? PAYMENT_METHOD_LABELS : PAYMENT_METHOD_LABELS_EN
    return labels[method as keyof typeof PAYMENT_METHOD_LABELS] || method || (isArabic ? 'غير محدد' : 'Not specified')
  }

  const paymentStatusLabel = (status?: string) => {
    const labels: Record<string, string> = isArabic
      ? {
          cash_on_delivery: 'الدفع عند الاستلام',
          receipt_uploaded: 'إيصال مرفوع',
          paid: 'مدفوع',
          pending: 'قيد المراجعة',
          rejected: 'مرفوض',
        }
      : {
          cash_on_delivery: 'Cash on delivery',
          receipt_uploaded: 'Receipt uploaded',
          paid: 'Paid',
          pending: 'Pending review',
          rejected: 'Rejected',
        }
    return labels[status || ''] || status || (isArabic ? 'غير محدد' : 'Not specified')
  }

  const createPrintPayload = useCallback((order: TrackedOrder) => trackedOrderToReceiptPayload(order, {
    isArabic,
    currency,
    invoiceName: isArabic ? settings.invoiceNameAr : settings.invoiceNameEn,
    invoiceAddress: isArabic ? settings.addressAr : settings.addressEn,
    invoicePhone: settings.phone,
    invoiceQrUrl: settings.printers.cashier.printsQr === false ? undefined : settings.invoiceQrUrl,
    invoiceQrUrl2: settings.printers.cashier.printsQr === false ? undefined : settings.invoiceQrUrl2,
    invoiceMessage: isArabic ? settings.invoiceWelcomeAr : settings.invoiceWelcomeEn,
    logoUrl: settings.invoiceLogo,
  }), [currency, isArabic, settings.addressAr, settings.addressEn, settings.invoiceLogo, settings.invoiceNameAr, settings.invoiceNameEn, settings.invoiceQrUrl, settings.invoiceQrUrl2, settings.invoiceWelcomeAr, settings.invoiceWelcomeEn, settings.phone, settings.printers.cashier.printsQr])

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

  const openOrderReceipt = async (order: TrackedOrder) => {
    const title = `${isArabic ? 'إيصال الطلب' : 'Order receipt'} ${order.id}`

    if (order.payment?.receiptDataUrl) {
      setReceiptPreview({ url: order.payment.receiptDataUrl, title, name: order.payment.receiptName })
      return
    }

    setMessage('')
    setLoadingReceiptId(order.id)
    try {
      const receipt = await fetchDashboardOrderReceipt(order.id)
      setReceiptPreview({ url: receipt.url, title, name: receipt.name || order.payment?.receiptName })
    } catch {
      setMessage(isArabic ? 'تعذر تحميل الإيصال.' : 'Could not load the receipt.')
    } finally {
      setLoadingReceiptId(null)
    }
  }
  const appOrders = useMemo(() => orders, [orders])

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
      <ReceiptPreviewDialog receipt={receiptPreview} onClose={() => setReceiptPreview(null)} isArabic={isArabic} />
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
                <option value="wallet">{isArabic ? 'محفظة' : 'Wallet'}</option>
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
      {!isDeliveryUser && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={savingRestaurantStatus}
            onClick={toggleRestaurantStatus}
          className={`flex min-h-16 w-full min-w-0 max-w-full items-center justify-between gap-4 rounded-lg border px-4 py-3 text-start shadow-sm transition disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:min-w-72 ${
              restaurantOpen
                ? 'border-green-200 bg-green-50 text-green-900 hover:bg-green-100 dark:border-green-900 dark:bg-green-950/40 dark:text-green-100'
                : 'border-red-200 bg-red-50 text-red-900 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100'
            }`}
          >
            <span className="flex items-center gap-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-full ${restaurantOpen ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                <Store className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-bold">{restaurantOpen ? (isArabic ? 'تشغيل المطعم' : 'Restaurant open') : (isArabic ? 'المطعم مغلق' : 'Restaurant closed')}</span>
                <span className="block text-xs opacity-80">{savingRestaurantStatus ? (isArabic ? 'جاري الحفظ...' : 'Saving...') : (isArabic ? 'اضغط لتغيير حالة استقبال الطلبات' : 'Tap to change ordering status')}</span>
              </span>
            </span>
            <Power className="h-5 w-5 shrink-0" />
          </button>
        </div>
      )}
      <div>
        <h2 className="text-3xl font-bold">{isArabic ? 'إدارة طلبات التطبيق' : 'App Orders Management'}</h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">{isArabic ? 'طلبات العملاء من التطبيق، وكل تغيير هنا يظهر للعميل في صفحة التتبع.' : 'Customer app orders. Changes here appear to customers on the tracking page.'}</p>
      </div>
      {message && <p className="rounded-md bg-slate-100 p-3 text-sm dark:bg-slate-900">{message}</p>}
      <Card>
        <CardHeader><CardTitle>{isArabic ? 'طلبات التطبيق' : 'App Orders'}</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-slate-500">{isArabic ? 'جاري تحميل الطلبات...' : 'Loading orders...'}</p>
          ) : appOrders.length === 0 ? (
            <p className="py-8 text-center text-slate-500">{isArabic ? 'لا توجد طلبات بعد.' : 'No orders yet.'}</p>
          ) : (
            <div className="min-w-0 space-y-3">
              {appOrders.map((order) => (
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
                    <div className="shrink-0 text-right">
                      <p className="font-bold">{Number(order.total || 0).toFixed(2)} {currency}</p>
                      <Badge className="bg-slate-700">{label(order.status)}</Badge>
                    </div>
                  </div>
                  <div className="mt-4 flex min-w-0 flex-wrap gap-2">
                    {!isDeliveryUser && <Button size="sm" variant="outline" className="gap-2" disabled={!isPrinterAvailable('cashier')} title={!isPrinterAvailable('cashier') ? (isArabic ? 'فعّل طابعة الكاشير من الإعدادات' : 'Enable cashier printer in settings') : undefined} onClick={() => printOrder(order, 'cashier')}>
                      <Printer className="h-4 w-4" />
                      {isArabic ? 'فاتورة الكاشير' : 'Cashier'}
                    </Button>}
                    {!isDeliveryUser && <Button size="sm" variant="outline" className="gap-2" disabled={!isPrinterAvailable('kitchen')} title={!isPrinterAvailable('kitchen') ? (isArabic ? 'فعّل طابعة المطبخ من الإعدادات' : 'Enable kitchen printer in settings') : undefined} onClick={() => printOrder(order, 'kitchen')}>
                      <ReceiptText className="h-4 w-4" />
                      {isArabic ? 'فاتورة المطبخ' : 'Kitchen'}
                    </Button>}
                    {!isDeliveryUser && <Button size="sm" variant="outline" className="gap-2" disabled={!isPrinterAvailable('hall')} title={!isPrinterAvailable('hall') ? (isArabic ? 'فعّل طابعة الصالة من الإعدادات' : 'Enable hall printer in settings') : undefined} onClick={() => printOrder(order, 'hall')}>
                      <ReceiptText className="h-4 w-4" />
                      {isArabic ? 'فاتورة الصالة' : 'Hall'}
                    </Button>}
                    {statuses.map((status) => (
                      <Button key={status} size="sm" variant={order.status === status ? 'default' : 'outline'} onClick={() => updateStatus(order.id, status)}>
                        {label(status)}
                      </Button>
                    ))}
                    {canEditOrders && <Button size="sm" variant="outline" className="gap-2" onClick={() => openEditOrder(order)}>
                      <Edit3 className="h-4 w-4" />
                      {isArabic ? 'تعديل الطلب' : 'Edit Order'}
                    </Button>}
                    {canDeleteOrders && <Button size="sm" variant="destructive" onClick={() => deleteOrder(order.id)}>{isArabic ? 'حذف الطلب' : 'Delete Order'}</Button>}
                  </div>
                  <div className="mt-4 grid min-w-0 gap-3 overflow-hidden rounded-md border bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/40 md:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0 space-y-1">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <CreditCard className="h-4 w-4 text-slate-500" />
                        {isArabic ? 'الدفع والإيصال' : 'Payment and Receipt'}
                      </p>
                      <p className="text-sm text-slate-500">
                        {paymentMethodLabel(order.payment?.method)} - {paymentStatusLabel(order.payment?.status)}
                      </p>
                      {order.payment?.receiptName && (
                        <p className="flex min-w-0 items-center gap-2 text-xs text-slate-500">
                          <ReceiptText className="h-3.5 w-3.5" />
                          <span className="min-w-0 truncate">{order.payment.receiptName}</span>
                        </p>
                      )}
                    </div>
                    {order.payment?.receiptDataUrl || order.payment?.receiptName || order.payment?.receiptUploadedAt ? (
                      <Button type="button" variant="outline" disabled={loadingReceiptId === order.id} onClick={() => openOrderReceipt(order)}>
                        <Eye className="me-2 h-4 w-4" />
                        {loadingReceiptId === order.id ? (isArabic ? 'جاري الفتح...' : 'Opening...') : (isArabic ? 'فتح الإيصال' : 'Open Receipt')}
                      </Button>
                    ) : (
                      <span className="inline-flex items-center gap-2 self-center text-sm text-slate-500">
                        <XCircle className="h-4 w-4" />
                        {isArabic ? 'لا يوجد إيصال مرفوع' : 'No receipt uploaded'}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 min-w-0 overflow-hidden rounded-md border bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-950">
                    <p className="font-semibold">{isArabic ? 'بيانات السائق المكلف' : 'Assigned driver'}</p>
                    {order.driver?.name && order.driver.name !== 'Pending assignment' ? (
                      <p className="mt-1 text-slate-600 dark:text-slate-300">
                        {order.driver.name} - {order.driver.phone && order.driver.phone !== '-' ? order.driver.phone : (isArabic ? 'لا يوجد رقم' : 'No phone')}
                      </p>
                    ) : (
                      <p className="mt-1 text-slate-500">{isArabic ? 'لم يتم تعيين سائق لهذا الطلب بعد.' : 'No driver has been assigned to this order yet.'}</p>
                    )}
                  </div>
                  {!isDeliveryUser && <div className="mt-4 grid min-w-0 gap-2 border-t pt-4 dark:border-slate-800 md:grid-cols-[minmax(0,1fr)_auto]">
                    <select
                      value={driverSelections[order.id] || ''}
                      onChange={(event) => setDriverSelections((current) => ({ ...current, [order.id]: event.target.value }))}
                      className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                    >
                      <option value="">{isArabic ? 'اختر سائقا' : 'Choose a driver'}</option>
                      {drivers.filter((driver) => driver.status === 'active').map((driver) => (
                        <option key={driver.id} value={driver.id}>{driver.name} - {driver.phone || '-'}</option>
                      ))}
                    </select>
                    <Button type="button" variant="outline" onClick={() => assignDriver(order)}>
                      {isArabic ? 'تعيين السائق' : 'Assign Driver'}
                    </Button>
                    <p className="text-sm text-slate-500 md:col-span-2">
                      {isArabic ? 'السائق الحالي' : 'Current driver'}: {order.driver?.name || (isArabic ? 'لم يتم التعيين' : 'Not assigned')} {order.driver?.phone && order.driver.phone !== '-' ? `- ${order.driver.phone}` : ''}
                    </p>
                  </div>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
