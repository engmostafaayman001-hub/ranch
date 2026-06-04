'use client'

import { useEffect, useState } from 'react'
import { CreditCard, ExternalLink, ReceiptText, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/components/language-provider'
import {
  CURRENCY,
  CURRENCY_EN,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_LABELS_EN,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_LABELS_EN,
} from '@/lib/constants'
import { useAppStore } from '@/lib/app-store'
import { TrackedOrder, TrackingStatus } from '@/lib/order-tracking'

const statuses: TrackingStatus[] = ['placed', 'confirmed', 'preparing', 'ready_for_delivery', 'out_for_delivery', 'delivered', 'received', 'cancelled']

export default function DashboardOrdersPage() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const drivers = useAppStore((state) => state.drivers)
  const [orders, setOrders] = useState<TrackedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [driverSelections, setDriverSelections] = useState<Record<string, string>>({})

  const loadOrders = async () => {
    try {
      const response = await fetch('/api/pos/orders', { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      setOrders(Array.isArray(data.orders) ? data.orders : [])
    } catch {
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(loadOrders, 0)
    const interval = window.setInterval(loadOrders, 10000)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(interval)
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

  const appOrders = orders.filter((order) => order.source !== 'restaurant_pos')

  return (
    <div className="space-y-6">
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
            <div className="space-y-3">
              {appOrders.map((order) => (
                <div key={order.id} className="rounded-md border p-4 dark:border-slate-800">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{order.id}</p>
                      <p className="text-sm text-slate-500">{order.customer} - {order.phone || '-'}</p>
                      <p className="text-sm text-slate-500">{order.address}</p>
                      {order.notes && (
                        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                          {isArabic ? 'ملاحظات' : 'Notes'}: {order.notes}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{Number(order.total || 0).toFixed(2)} {currency}</p>
                      <Badge className="bg-slate-700">{label(order.status)}</Badge>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {statuses.map((status) => (
                      <Button key={status} size="sm" variant={order.status === status ? 'default' : 'outline'} onClick={() => updateStatus(order.id, status)}>
                        {label(status)}
                      </Button>
                    ))}
                    <Button size="sm" variant="destructive" onClick={() => deleteOrder(order.id)}>{isArabic ? 'حذف الطلب' : 'Delete Order'}</Button>
                  </div>
                  <div className="mt-4 grid gap-3 rounded-md border bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/40 md:grid-cols-[1fr_auto]">
                    <div className="space-y-1">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <CreditCard className="h-4 w-4 text-slate-500" />
                        {isArabic ? 'الدفع والإيصال' : 'Payment and Receipt'}
                      </p>
                      <p className="text-sm text-slate-500">
                        {paymentMethodLabel(order.payment?.method)} - {paymentStatusLabel(order.payment?.status)}
                      </p>
                      {order.payment?.receiptName && (
                        <p className="flex items-center gap-2 text-xs text-slate-500">
                          <ReceiptText className="h-3.5 w-3.5" />
                          {order.payment.receiptName}
                        </p>
                      )}
                    </div>
                    {order.payment?.receiptDataUrl ? (
                      <Button asChild type="button" variant="outline">
                        <a href={order.payment.receiptDataUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="me-2 h-4 w-4" />
                          {isArabic ? 'فتح الإيصال' : 'Open Receipt'}
                        </a>
                      </Button>
                    ) : (
                      <span className="inline-flex items-center gap-2 self-center text-sm text-slate-500">
                        <XCircle className="h-4 w-4" />
                        {isArabic ? 'لا يوجد إيصال مرفوع' : 'No receipt uploaded'}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 grid gap-2 border-t pt-4 dark:border-slate-800 md:grid-cols-[1fr_auto]">
                    <select
                      value={driverSelections[order.id] || ''}
                      onChange={(event) => setDriverSelections((current) => ({ ...current, [order.id]: event.target.value }))}
                      className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                    >
                      <option value="">{isArabic ? 'اختر سائقا' : 'Choose a driver'}</option>
                      {drivers.filter((driver) => driver.status === 'active').map((driver) => (
                        <option key={driver.id} value={driver.id}>{driver.name} - {driver.phone}</option>
                      ))}
                    </select>
                    <Button type="button" variant="outline" onClick={() => assignDriver(order)}>
                      {isArabic ? 'تعيين السائق' : 'Assign Driver'}
                    </Button>
                    <p className="text-sm text-slate-500 md:col-span-2">
                      {isArabic ? 'السائق الحالي' : 'Current driver'}: {order.driver?.name || (isArabic ? 'لم يتم التعيين' : 'Not assigned')} {order.driver?.phone && order.driver.phone !== '-' ? `- ${order.driver.phone}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
