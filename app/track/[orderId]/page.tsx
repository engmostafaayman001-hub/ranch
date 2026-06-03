'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Navbar } from '@/components/navbar'
import { Sidebar } from '@/components/sidebar'
import { CURRENCY, PAYMENT_METHOD_LABELS, ROUTES } from '@/lib/constants'
import { useLanguage } from '@/components/language-provider'
import { useAuthStore } from '@/lib/store'
import { findTrackedOrder, getStatusIndex, statusLabels, syncTrackedOrdersFromServer, TrackedOrder, trackingSteps, upsertTrackedOrder } from '@/lib/order-tracking'

export default function TrackOrderPage() {
  const params = useParams()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [order, setOrder] = useState<TrackedOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const { isLoggedIn, logout } = useAuthStore()
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const orderId = String(params.orderId || '')

  useEffect(() => {
    let active = true

    async function loadOrder() {
      try {
        const response = await fetch('/api/pos/orders', { cache: 'no-store' })
        const data = await response.json().catch(() => ({}))
        const apiOrders = Array.isArray(data.orders) ? data.orders as TrackedOrder[] : []
        const apiOrder = apiOrders.find((item) => item.id.toLowerCase() === orderId.toLowerCase())

        if (apiOrders.length > 0) {
          syncTrackedOrdersFromServer(apiOrders)
          if (active) setOrder(apiOrder || null)
        } else if (active) {
          setOrder(findTrackedOrder(orderId) || null)
        }

        if (apiOrder) upsertTrackedOrder(apiOrder)
      } catch {
        if (active) setOrder(findTrackedOrder(orderId) || null)
      } finally {
        if (active) setLoading(false)
      }
    }

    const timer = window.setTimeout(loadOrder, 0)
    const interval = window.setInterval(loadOrder, 10000)
    return () => {
      active = false
      window.clearTimeout(timer)
      window.clearInterval(interval)
    }
  }, [orderId])

  const handleLogout = () => {
    logout()
    setSidebarOpen(false)
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isLoggedIn={isLoggedIn} onLogout={handleLogout} />
      <Navbar onMenuOpen={() => setSidebarOpen(true)} isLoggedIn={isLoggedIn} onLogout={handleLogout} />

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold">{isArabic ? 'تتبع الطلب' : 'Track Order'}</h1>
          <Link href={ROUTES.ORDERS}><Button variant="outline">{isArabic ? 'العودة للطلبات' : 'Back to Orders'}</Button></Link>
        </div>

        {loading ? (
          <Card><CardContent className="py-10 text-center text-slate-500">{isArabic ? 'جاري تحميل حالة الطلب...' : 'Loading order status...'}</CardContent></Card>
        ) : !order ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="mb-4 text-slate-600 dark:text-slate-400">{isArabic ? 'لم يتم العثور على هذا الطلب أو تم حذفه من لوحة التحكم.' : 'This order could not be found or was deleted from the dashboard.'}</p>
              <Link href="/track"><Button className="bg-red-600 hover:bg-red-700">{isArabic ? 'البحث عن طلب آخر' : 'Search Another Order'}</Button></Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-8">
              <CardHeader><CardTitle>{isArabic ? 'الطلب' : 'Order'} {order.id}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Info label={isArabic ? 'الحالة' : 'Status'} value={statusLabels[order.status][language]} />
                  <Info label={isArabic ? 'التوصيل المتوقع' : 'Estimated Delivery'} value={order.estimatedDelivery} accent="text-green-600" />
                  <Info label={isArabic ? 'الإجمالي' : 'Total'} value={`${Number(order.total || 0).toFixed(2)} ${CURRENCY}`} accent="text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="mb-8">
              <CardHeader><CardTitle>{isArabic ? 'الدفع' : 'Payment'}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="font-semibold">{paymentLabel(order, isArabic)}</p>
                <p className="text-sm text-slate-500">
                  {order.payment?.method ? PAYMENT_METHOD_LABELS[order.payment.method as keyof typeof PAYMENT_METHOD_LABELS] || order.payment.method : '-'}
                </p>
                {order.payment?.receiptName && <p className="text-sm text-slate-600 dark:text-slate-400">{isArabic ? 'الإيصال' : 'Receipt'}: {order.payment.receiptName}</p>}
              </CardContent>
            </Card>

            <Card className="mb-8">
              <CardHeader><CardTitle>{isArabic ? 'خط سير الطلب حتى الاستلام' : 'Order Timeline Until Receipt'}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-5">
                  {trackingSteps.map((step, index) => {
                    const completed = order.status === 'cancelled'
                      ? step.status === 'cancelled'
                      : getStatusIndex(step.status) <= getStatusIndex(order.status) && step.status !== 'cancelled'
                    const event = order.history.find((item) => item.status === step.status)
                    const active = step.status === order.status
                    return (
                      <div key={step.status} className="flex items-start gap-4">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-white ${completed ? 'bg-red-600' : 'bg-slate-300'}`}>
                          {completed ? '✓' : index + 1}
                        </div>
                        <div className="flex-1 border-b border-slate-200 pb-4 dark:border-slate-800">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={`font-semibold ${completed ? 'text-red-600' : 'text-slate-500'}`}>{step[language]}</p>
                            {active && <Badge className="bg-green-600">{isArabic ? 'الحالة الحالية' : 'Current'}</Badge>}
                          </div>
                          <p className="text-sm text-slate-500">{event ? new Date(event.at).toLocaleString(isArabic ? 'ar-EG' : 'en-US') : (isArabic ? 'بانتظار التحديث' : 'Waiting for update')}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{isArabic ? 'معلومات السائق' : 'Driver Information'}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {order.driver.name === 'Pending assignment' || order.driver.phone === '-' ? (
                  <p className="text-slate-500">{isArabic ? 'لم يتم تعيين السائق بعد.' : 'Driver has not been assigned yet.'}</p>
                ) : (
                  <>
                    <p className="font-bold">{order.driver.name}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{isArabic ? 'رقم التواصل' : 'Contact'}: {order.driver.phone}</p>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  )
}

function paymentLabel(order: TrackedOrder, isArabic: boolean) {
  if (!order.payment) return isArabic ? 'حالة الدفع غير محددة' : 'Payment status is not set'
  if (order.payment.status === 'cash_on_delivery') return isArabic ? 'الدفع عند الاستلام' : 'Cash on delivery'
  if (order.payment.status === 'receipt_uploaded') return isArabic ? 'تم رفع الإيصال وبانتظار المراجعة' : 'Receipt uploaded and awaiting review'
  if (order.payment.status === 'paid') return isArabic ? 'تم الدفع' : 'Paid'
  if (order.payment.status === 'rejected') return isArabic ? 'تم رفض الإيصال' : 'Receipt rejected'
  return isArabic ? 'قيد الانتظار' : 'Pending'
}

function Info({ label, value, accent = '' }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className="text-sm text-slate-600 dark:text-slate-400">{label}</p>
      <p className={`text-lg font-bold ${accent}`}>{value}</p>
    </div>
  )
}
