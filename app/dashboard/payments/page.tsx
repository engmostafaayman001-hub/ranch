'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Clock3, CreditCard, Eye, ReceiptText, Search, Trash2, Wallet, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ReceiptPreviewDialog } from '@/components/receipt-preview-dialog'
import { useLanguage } from '@/components/language-provider'
import { canDeleteOrders } from '@/lib/permissions'
import { CURRENCY, CURRENCY_EN, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_LABELS_EN } from '@/lib/constants'
import { fetchDashboardOrderReceipt } from '@/lib/dashboard-order-fetch'
import { PaymentStatus, TrackedOrder } from '@/lib/order-tracking'

function canDeleteRole(role: string | null) {
  return canDeleteOrders(role)
}

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
  const [receiptPreview, setReceiptPreview] = useState<{ url: string; title: string; name?: string } | null>(null)
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [dashboardRole, setDashboardRole] = useState<string | null>(null)
  const loadingPayments = useRef(false)
  const canDelete = canDeleteRole(dashboardRole)

  useEffect(() => {
    let active = true
    fetch('/api/auth/dashboard-access', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (active) setDashboardRole(typeof data.role === 'string' ? data.role : null)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    async function loadPayments() {
      if (loadingPayments.current) return
      loadingPayments.current = true
      try {
        const response = await fetch('/api/pos/orders?limit=200&excludeSettled=1', { cache: 'no-store' })
        const data = await response.json().catch(() => ({}))
        if (mounted) {
          setOrders(Array.isArray(data.orders) ? data.orders : [])
          setMessage('')
        }
      } catch {
        if (mounted) {
          setOrders([])
          setMessage(isArabic ? 'تعذر تحميل المدفوعات.' : 'Could not load payments.')
        }
      } finally {
        loadingPayments.current = false
        if (mounted) setLoading(false)
      }
    }

    loadPayments()
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadPayments()
    }, 120000)
    return () => {
      mounted = false
      window.clearInterval(interval)
    }
  }, [isArabic, orders])

  const paymentOrders = useMemo(() => orders.filter((order) => order.payment), [orders])
  const filteredPaymentOrders = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return paymentOrders
    return paymentOrders.filter((order) => `${order.id} ${order.customer} ${order.phone} ${order.payment?.method || ''} ${order.payment?.status || ''}`.toLowerCase().includes(term))
  }, [paymentOrders, search])
  const paidOrders = paymentOrders.filter((order) => order.payment?.status === 'paid')
  const receiptOrders = paymentOrders.filter((order) => order.payment?.receiptDataUrl || order.payment?.receiptName || order.payment?.receiptUploadedAt)
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

  const openReceipt = async (order: TrackedOrder) => {
    const title = `${isArabic ? 'إيصال الطلب' : 'Order receipt'} ${order.id}`
    setMessage('')

    if (order.payment?.receiptDataUrl) {
      setReceiptPreview({ url: order.payment.receiptDataUrl, title, name: order.payment.receiptName })
      return
    }

    setLoadingReceiptId(order.id)
    try {
      const receipt = await fetchDashboardOrderReceipt(order.id)
      setReceiptPreview({ url: receipt.url, title, name: receipt.name || order.payment?.receiptName })
    } catch {
      setMessage(isArabic ? 'تعذر فتح الإيصال لهذا الطلب.' : 'Could not open the receipt for this order.')
    } finally {
      setLoadingReceiptId(null)
    }
  }

  const deleteOrder = async (orderId: string) => {
    const confirmed = window.confirm(isArabic ? 'هل أنت متأكد من رغبتك في حذف هذا الطلب نهائياً؟' : 'Are you sure you want to permanently delete this order?')
    if (!confirmed) return

    setMessage('')
    const response = await fetch('/api/pos/orders', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setMessage(data.message || data.error || (isArabic ? 'تعذر حذف الطلب.' : 'Could not delete order.'))
    } else {
      setMessage(isArabic ? 'تم حذف الطلب نهائياً.' : 'Order permanently deleted.')
      setOrders(current => current.filter(o => o.id !== orderId))
    }
  }

  return (
    <div className="space-y-6">
      <ReceiptPreviewDialog receipt={receiptPreview} onClose={() => setReceiptPreview(null)} isArabic={isArabic} />
      <div>
        <h2 className="text-3xl font-bold">{isArabic ? 'المدفوعات والإيصالات' : 'Payments and Receipts'}</h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          {isArabic ? 'متابعة طرق الدفع، حالة التحصيل، والإيصالات المرفوعة مع الطلبات.' : 'Track payment methods, collection status, and uploaded order receipts.'}
        </p>
      </div>
      {message && <p className="rounded-md bg-slate-100 p-3 text-sm dark:bg-slate-900">{message}</p>}

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
          <div className="mb-4 flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isArabic ? 'بحث في المدفوعات' : 'Search payments'} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </div>
          {loading ? (
            <p className="py-8 text-center text-slate-500">{isArabic ? 'جاري تحميل المدفوعات...' : 'Loading payments...'}</p>
          ) : paymentOrders.length === 0 ? (
            <p className="py-8 text-center text-slate-500">{isArabic ? 'لا توجد مدفوعات بعد.' : 'No payments yet.'}</p>
          ) : filteredPaymentOrders.length === 0 ? (
            <p className="py-8 text-center text-slate-500">{isArabic ? 'لا توجد مدفوعات مطابقة.' : 'No matching payments.'}</p>
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
                    {canDelete && <th className="py-3 font-medium">{isArabic ? 'إجراء' : 'Action'}</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredPaymentOrders.map((order) => (
                    <tr key={order.id} className="border-b last:border-0 dark:border-slate-800">
                      <td className="py-3 font-medium">#{order.displayNumber || order.id}</td>
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
                        {order.payment?.receiptDataUrl || order.payment?.receiptName || order.payment?.receiptUploadedAt ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={loadingReceiptId === order.id}
                            onClick={() => openReceipt(order)}
                          >
                            <Eye className="me-2 h-4 w-4" />
                            {loadingReceiptId === order.id ? (isArabic ? 'جاري الفتح...' : 'Opening...') : (isArabic ? 'فتح الإيصال' : 'Open Receipt')}
                          </Button>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-slate-500">
                            <XCircle className="h-4 w-4" />
                            {isArabic ? 'لا يوجد إيصال' : 'No receipt'}
                          </span>
                        )}
                      </td>
                      {canDelete && (
                        <td className="py-3">
                          <Button size="sm" variant="destructive" onClick={() => deleteOrder(order.id)}><Trash2 className="h-4 w-4" /></Button>
                        </td>
                      )}
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
