'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Eye } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Navbar } from '@/components/navbar'
import { ReceiptPreviewDialog } from '@/components/receipt-preview-dialog'
import { Sidebar } from '@/components/sidebar'
import { CURRENCY, CURRENCY_EN, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_LABELS_EN, ROUTES } from '@/lib/constants'
import { useLanguage } from '@/components/language-provider'
import { useAuthStore } from '@/lib/store'
import { getStatusIndex, statusLabels, syncTrackedOrdersForEmail, TrackedOrder, trackingSteps } from '@/lib/order-tracking'

const customerTrackingSteps = trackingSteps.filter((step) => step.status !== 'received')

export default function TrackOrderPage() {
  const params = useParams()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [order, setOrder] = useState<TrackedOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [loadingReceipt, setLoadingReceipt] = useState(false)
  const [receiptPreview, setReceiptPreview] = useState<{ url: string; title: string; name?: string } | null>(null)
  const { isLoggedIn, logout, user } = useAuthStore()
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const orderId = String(params.orderId || '')

  useEffect(() => {
    let active = true

    async function loadOrder() {
      try {
        const response = await fetch('/api/pos/orders', { cache: 'no-store' })
        const data = await response.json().catch(() => ({}))
        const apiOrders = Array.isArray(data.orders) ? data.orders as TrackedOrder[] : []
        const visibleOrders = isLoggedIn && user?.email
          ? syncTrackedOrdersForEmail(apiOrders, user.email)
          : []
        const visibleOrder = visibleOrders.find((item) => item.id.toLowerCase() === orderId.toLowerCase())

        if (active) setOrder(visibleOrder || null)
      } catch {
        if (active) setOrder(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    const timer = window.setTimeout(loadOrder, 0)
    const interval = window.setInterval(loadOrder, 30000)
    return () => {
      active = false
      window.clearTimeout(timer)
      window.clearInterval(interval)
    }
  }, [orderId, isLoggedIn, user?.email])

  const handleLogout = () => {
    logout()
    setSidebarOpen(false)
  }

  const openReceipt = async () => {
    if (!order || loadingReceipt) return
    setMessage('')
    setLoadingReceipt(true)
    try {
      const response = await fetch(`/api/pos/orders/receipt?orderId=${encodeURIComponent(order.id)}`, { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.receipt?.receiptDataUrl) {
        throw new Error(data.message || data.error || 'Could not load receipt')
      }
      setReceiptPreview({
        url: data.receipt.receiptDataUrl,
        title: `${isArabic ? 'إيصال الطلب' : 'Order receipt'} ${order.displayNumber ? `#${order.displayNumber}` : order.id}`,
        name: data.receipt.receiptName || order.payment?.receiptName,
      })
    } catch {
      setMessage(isArabic ? 'تعذر فتح الإيصال لهذا الطلب.' : 'Could not open the receipt for this order.')
    } finally {
      setLoadingReceipt(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <ReceiptPreviewDialog receipt={receiptPreview} onClose={() => setReceiptPreview(null)} isArabic={isArabic} />
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
              <CardHeader><CardTitle>{isArabic ? 'الطلب' : 'Order'} #{order.displayNumber || order.id}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Info label={isArabic ? 'الحالة' : 'Status'} value={statusLabels[order.status][language]} />
                  <Info label={isArabic ? 'التوصيل المتوقع' : 'Estimated Delivery'} value={order.estimatedDelivery} accent="text-green-600" />
                  <Info label={isArabic ? 'الإجمالي' : 'Total'} value={`${Number(order.total || 0).toFixed(2)} ${currency}`} accent="text-red-600" />
                </div>
                {order.notes && (
                  <div className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    <span className="font-semibold">{isArabic ? 'ملاحظات الطلب' : 'Order Notes'}:</span> {order.notes}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mb-8">
              <CardHeader><CardTitle>{isArabic ? 'الدفع' : 'Payment'}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {message && <p className="rounded-md bg-slate-100 p-3 text-sm dark:bg-slate-900">{message}</p>}
                <p className="font-semibold">{paymentLabel(order, isArabic)}</p>
                <p className="text-sm text-slate-500">
                  {order.payment?.method
                    ? (isArabic ? PAYMENT_METHOD_LABELS : PAYMENT_METHOD_LABELS_EN)[order.payment.method as keyof typeof PAYMENT_METHOD_LABELS] || order.payment.method
                    : '-'}
                </p>
                {order.payment?.receiptName && <p className="text-sm text-slate-600 dark:text-slate-400">{isArabic ? 'الإيصال' : 'Receipt'}: {order.payment.receiptName}</p>}
                {order.payment?.receiptName || order.payment?.receiptUploadedAt ? (
                  <Button type="button" variant="outline" disabled={loadingReceipt} onClick={openReceipt}>
                    <Eye className="me-2 h-4 w-4" />
                    {loadingReceipt ? (isArabic ? 'جاري الفتح...' : 'Opening...') : (isArabic ? 'فتح الإيصال' : 'Open Receipt')}
                  </Button>
                ) : null}
              </CardContent>
            </Card>

            <Card className="mb-8">
              <CardHeader><CardTitle>{isArabic ? 'خط سير الطلب حتى التسليم' : 'Order Timeline Until Delivery'}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-5">
                  {customerTrackingSteps.map((step, index) => {
                    const completed = order.status === 'cancelled'
                      ? step.status === 'cancelled'
                      : getStatusIndex(step.status) <= getStatusIndex(order.status) && step.status !== 'cancelled'
                    const event = order.history.find((item) => item.status === step.status)
                    const active = step.status === order.status || (order.status === 'received' && step.status === 'delivered')
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

            {['delivered', 'received'].includes(order.status) && (
              <Card className="mb-8 border-red-100 bg-red-50/60 dark:border-red-950 dark:bg-red-950/20">
                <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold">{isArabic ? 'الطلب اكتمل بعد التسليم' : 'Order completed after delivery'}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {isArabic ? 'لو عندك مشكلة في الطلب، قدم شكوى واختر طلب استرجاع عند الحاجة.' : 'If there is an issue, submit a complaint and choose refund request when needed.'}
                    </p>
                  </div>
                  <Link href={`${ROUTES.COMPLAINTS}?orderId=${encodeURIComponent(order.id)}`}>
                    <Button className="bg-red-600 hover:bg-red-700">{isArabic ? 'تقديم شكوى' : 'Submit Complaint'}</Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle>{isArabic ? 'معلومات السائق' : 'Driver Information'}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {order.driver.name === 'Pending assignment' || order.driver.phone === '-' ? (
                  <p className="text-slate-500">{isArabic ? 'لم يتم تعيين سائق بعد.' : 'Driver has not been assigned yet.'}</p>
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

