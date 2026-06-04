'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, CreditCard, ExternalLink, ReceiptText, Wallet, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_LABELS_EN } from '@/lib/constants'
import { PaymentStatus, TrackedOrder } from '@/lib/order-tracking'

const statusStyles: Record<PaymentStatus, string> = {
  cash_on_delivery: 'bg-amber-600 text-white hover:bg-amber-600',
  receipt_uploaded: 'bg-blue-600 text-white hover:bg-blue-600',
  paid: 'bg-emerald-600 text-white hover:bg-emerald-600',
  pending: 'bg-slate-600 text-white hover:bg-slate-600',
  rejected: 'bg-red-600 text-white hover:bg-red-600',
}

export default function DashboardPaymentsPage() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const locale = isArabic ? 'ar-EG' : 'en-US'
  const [orders, setOrders] = useState<TrackedOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function loadPayments() {
      try {
        const response = await fetch('/api/pos/orders', { cache: 'no-store' })
        const data = await response.json().catch(() => ({}))
        if (mounted) setOrders(Array.isArray(data.orders) ? data.orders : [])
      } catch {
        if (mounted) setOrders([])
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadPayments()
    const interval = window.setInterval(loadPayments, 10000)
    return () => {
      mounted = false
      window.clearInterval(interval)
    }
  }, [])

  const paymentOrders = useMemo(() => orders.filter((order) => order.payment), [orders])
  const paidOrders = paymentOrders.filter((order) => order.payment?.status === 'paid')
  const receiptOrders = paymentOrders.filter((order) => order.payment?.receiptDataUrl)
  const pendingOrders = paymentOrders.filter((order) => ['pending', 'receipt_uploaded'].includes(order.payment?.status || ''))
  const rejectedOrders = paymentOrders.filter((order) => order.payment?.status === 'rejected')
  const totalPaid = paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
  const totalExpected = paymentOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)

  const methodLabel = (method?: string) => {
    const labels = isArabic ? PAYMENT_METHOD_LABELS : PAYMENT_METHOD_LABELS_EN
    return labels[method as keyof typeof PAYMENT_METHOD_LABELS] || method || (isArabic ? 'غير محدد' : 'Not specified')
  }

  const statusLabel = (status?: string) => {
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">{isArabic ? 'المدفوعات والإيصالات' : 'Payments and Receipts'}</h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          {isArabic ? 'متابعة طرق الدفع، حالة التحصيل، والإيصالات المرفوعة مع الطلبات.' : 'Track payment methods, collection status, and uploaded order receipts.'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{isArabic ? 'إجمالي المدفوع' : 'Total Paid'}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalPaid.toFixed(2)} {currency}</p>
            <p className="mt-1 text-xs text-slate-500">{isArabic ? 'طلبات تم تأكيد دفعها' : 'Confirmed paid orders'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{isArabic ? 'إجمالي الطلبات' : 'Expected Total'}</CardTitle>
            <Wallet className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalExpected.toFixed(2)} {currency}</p>
            <p className="mt-1 text-xs text-slate-500">{isArabic ? 'كل الطلبات التي تحتوي بيانات دفع' : 'Orders with payment data'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{isArabic ? 'إيصالات مرفوعة' : 'Uploaded Receipts'}</CardTitle>
            <ReceiptText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{receiptOrders.length}</p>
            <p className="mt-1 text-xs text-slate-500">{isArabic ? 'يمكن فتحها من هنا أو من الطلبات' : 'Open from here or from orders'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{isArabic ? 'قيد المراجعة / مرفوض' : 'Review / Rejected'}</CardTitle>
            <Clock3 className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingOrders.length} / {rejectedOrders.length}</p>
            <p className="mt-1 text-xs text-slate-500">{isArabic ? 'تحتاج متابعة من الفريق' : 'Needs team follow-up'}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isArabic ? 'سجل المدفوعات' : 'Payment Ledger'}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-slate-500">{isArabic ? 'جاري تحميل المدفوعات...' : 'Loading payments...'}</p>
          ) : paymentOrders.length === 0 ? (
            <p className="py-8 text-center text-slate-500">{isArabic ? 'لا توجد مدفوعات بعد.' : 'No payments yet.'}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500 dark:border-slate-800">
                    <th className="py-3 font-medium">{isArabic ? 'الطلب' : 'Order'}</th>
                    <th className="py-3 font-medium">{isArabic ? 'العميل' : 'Customer'}</th>
                    <th className="py-3 font-medium">{isArabic ? 'الطريقة' : 'Method'}</th>
                    <th className="py-3 font-medium">{isArabic ? 'الحالة' : 'Status'}</th>
                    <th className="py-3 font-medium">{isArabic ? 'المبلغ' : 'Amount'}</th>
                    <th className="py-3 font-medium">{isArabic ? 'الإيصال' : 'Receipt'}</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentOrders.map((order) => (
                    <tr key={order.id} className="border-b last:border-0 dark:border-slate-800">
                      <td className="py-3 font-medium">{order.id}</td>
                      <td className="py-3">
                        <p>{order.customer || '-'}</p>
                        <p className="text-xs text-slate-500">{order.createdAt ? new Date(order.createdAt).toLocaleString(locale) : '-'}</p>
                      </td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-slate-500" />
                          {methodLabel(order.payment?.method)}
                        </span>
                      </td>
                      <td className="py-3">
                        <Badge className={statusStyles[order.payment?.status || 'pending'] || statusStyles.pending}>
                          {statusLabel(order.payment?.status)}
                        </Badge>
                      </td>
                      <td className="py-3 font-semibold">{Number(order.total || 0).toFixed(2)} {currency}</td>
                      <td className="py-3">
                        {order.payment?.receiptDataUrl ? (
                          <Button asChild size="sm" variant="outline">
                            <a href={order.payment.receiptDataUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="me-2 h-4 w-4" />
                              {isArabic ? 'فتح الإيصال' : 'Open Receipt'}
                            </a>
                          </Button>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-slate-500">
                            <XCircle className="h-4 w-4" />
                            {isArabic ? 'لا يوجد إيصال' : 'No receipt'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
