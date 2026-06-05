'use client'

import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN, ORDER_STATUS_LABELS, ORDER_STATUS_LABELS_EN } from '@/lib/constants'
import { useAppStore } from '@/lib/app-store'
import { printTrackedOrderReceipt } from '@/lib/order-print'
import { TrackedOrder, TrackingStatus } from '@/lib/order-tracking'

const statuses: TrackingStatus[] = ['placed', 'confirmed', 'preparing', 'ready_for_delivery', 'out_for_delivery', 'delivered', 'received', 'cancelled']

export default function DashboardRestaurantOrdersPage() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const settings = useAppStore((state) => state.settings)
  const [orders, setOrders] = useState<TrackedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const loadOrders = async () => {
    try {
      const response = await fetch('/api/pos/orders', { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      setOrders(Array.isArray(data.orders) ? data.orders.filter((order: TrackedOrder) => order.source === 'restaurant_pos') : [])
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

  const label = (status: string) => (isArabic ? ORDER_STATUS_LABELS : ORDER_STATUS_LABELS_EN)[status as keyof typeof ORDER_STATUS_LABELS] || status

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

  const printOrder = (order: TrackedOrder) => {
    const printer = settings.printers.cashier
    const opened = printTrackedOrderReceipt(order, {
      isArabic,
      currency,
      title: isArabic ? 'فاتورة طلب مطعم' : 'Restaurant Order Receipt',
      printerMethod: printerMethodLabel(printer.method, isArabic),
      printerName: printer.name,
      paperWidth: printer.paperWidth,
      invoiceName: isArabic ? settings.invoiceNameAr : settings.invoiceNameEn,
      invoiceQrUrl: settings.invoiceQrUrl,
      invoiceMessage: isArabic ? settings.invoiceWelcomeAr : settings.invoiceWelcomeEn,
      printsMainInvoice: printer.printsMainInvoice,
      printsQr: printer.printsQr,
    })
    if (!opened) setMessage(isArabic ? 'المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى.' : 'The browser blocked the print window. Allow popups and try again.')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">{isArabic ? 'إدارة طلبات المطعم' : 'Restaurant Orders Management'}</h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">{isArabic ? 'طلبات تم إنشاؤها من نقطة بيع المطعم.' : 'Orders created from the restaurant POS.'}</p>
      </div>
      {message && <p className="rounded-md bg-slate-100 p-3 text-sm dark:bg-slate-900">{message}</p>}
      <Card>
        <CardHeader><CardTitle>{isArabic ? 'طلبات المطعم' : 'Restaurant Orders'}</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-slate-500">{isArabic ? 'جاري التحميل...' : 'Loading...'}</p>
          ) : orders.length === 0 ? (
            <p className="py-8 text-center text-slate-500">{isArabic ? 'لا توجد طلبات مطعم بعد.' : 'No restaurant orders yet.'}</p>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
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
                    <div className="text-end">
                      <p className="font-bold">{Number(order.total || 0).toFixed(2)} {currency}</p>
                      <Badge className="bg-slate-700">{label(order.status)}</Badge>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => printOrder(order)}>
                      <Printer className="h-4 w-4" />
                      {isArabic ? 'طباعة' : 'Print'}
                    </Button>
                    {statuses.map((status) => (
                      <Button key={status} size="sm" variant={order.status === status ? 'default' : 'outline'} onClick={() => updateStatus(order.id, status)}>
                        {label(status)}
                      </Button>
                    ))}
                    <Button size="sm" variant="destructive" onClick={() => deleteOrder(order.id)}>{isArabic ? 'حذف' : 'Delete'}</Button>
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

function printerMethodLabel(method: string | undefined, isArabic: boolean) {
  const labels: Record<string, { ar: string; en: string }> = {
    browser: { ar: 'طباعة المتصفح', en: 'Browser print' },
    usb: { ar: 'USB', en: 'USB' },
    bluetooth: { ar: 'Bluetooth', en: 'Bluetooth' },
    network: { ar: 'شبكة / IP', en: 'Network / IP' },
  }
  return labels[method || 'browser']?.[isArabic ? 'ar' : 'en'] || method || labels.browser[isArabic ? 'ar' : 'en']
}
