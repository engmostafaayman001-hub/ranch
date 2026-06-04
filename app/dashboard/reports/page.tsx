'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, BarChart3, CheckCircle2, ClipboardList, ReceiptText, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN, ORDER_STATUS_LABELS, ORDER_STATUS_LABELS_EN } from '@/lib/constants'
import { TrackedOrder, TrackingStatus } from '@/lib/order-tracking'

interface Customer {
  id?: string
  email?: string
  phone?: string
}

const activeStatuses: TrackingStatus[] = ['placed', 'confirmed', 'preparing', 'ready_for_delivery', 'out_for_delivery']

export default function DashboardReportsPage() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const locale = isArabic ? 'ar-EG' : 'en-US'
  const [orders, setOrders] = useState<TrackedOrder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function loadReports() {
      try {
        const [ordersResponse, customersResponse] = await Promise.all([
          fetch('/api/pos/orders', { cache: 'no-store' }),
          fetch('/api/customers', { cache: 'no-store' }),
        ])
        const ordersData = await ordersResponse.json().catch(() => ({}))
        const customersData = await customersResponse.json().catch(() => ({}))
        if (!mounted) return
        setOrders(Array.isArray(ordersData.orders) ? ordersData.orders : [])
        setCustomers(Array.isArray(customersData.customers) ? customersData.customers : [])
      } catch {
        if (!mounted) return
        setOrders([])
        setCustomers([])
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadReports()
    const interval = window.setInterval(loadReports, 15000)
    return () => {
      mounted = false
      window.clearInterval(interval)
    }
  }, [])

  const report = useMemo(() => {
    const revenueOrders = orders.filter((order) => !['cancelled'].includes(order.status))
    const revenue = revenueOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
    const average = revenueOrders.length ? revenue / revenueOrders.length : 0
    const delivered = orders.filter((order) => ['delivered', 'received'].includes(order.status)).length
    const cancelled = orders.filter((order) => order.status === 'cancelled').length
    const active = orders.filter((order) => activeStatuses.includes(order.status)).length
    const receipts = orders.filter((order) => order.payment?.receiptDataUrl).length
    const statusCounts = orders.reduce<Record<string, number>>((counts, order) => {
      counts[order.status] = (counts[order.status] || 0) + 1
      return counts
    }, {})
    const recentOrders = [...orders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6)

    return { revenue, average, delivered, cancelled, active, receipts, statusCounts, recentOrders }
  }, [orders])

  const statusLabel = (status: string) => {
    const labels = isArabic ? ORDER_STATUS_LABELS : ORDER_STATUS_LABELS_EN
    return labels[status as keyof typeof ORDER_STATUS_LABELS] || status
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">{isArabic ? 'التقارير والتحليلات' : 'Reports and Analytics'}</h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          {isArabic ? 'نظرة مباشرة على الطلبات، الإيرادات، العملاء، وحالة التشغيل.' : 'A live view of orders, revenue, customers, and operation status.'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{isArabic ? 'الإيرادات' : 'Revenue'}</CardTitle>
            <BarChart3 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{report.revenue.toFixed(2)} {currency}</p>
            <p className="mt-1 text-xs text-slate-500">{isArabic ? 'بدون الطلبات الملغاة' : 'Excluding cancelled orders'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{isArabic ? 'الطلبات' : 'Orders'}</CardTitle>
            <ClipboardList className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{orders.length}</p>
            <p className="mt-1 text-xs text-slate-500">{report.active} {isArabic ? 'طلب نشط' : 'active orders'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{isArabic ? 'متوسط الطلب' : 'Average Order'}</CardTitle>
            <Activity className="h-4 w-4 text-violet-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{report.average.toFixed(2)} {currency}</p>
            <p className="mt-1 text-xs text-slate-500">{isArabic ? 'قيمة الطلب الواحد' : 'Per order value'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{isArabic ? 'العملاء' : 'Customers'}</CardTitle>
            <Users className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{customers.length}</p>
            <p className="mt-1 text-xs text-slate-500">{isArabic ? 'عميل مسجل أو ظهر في الطلبات' : 'Registered or order customers'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>{isArabic ? 'حالة الطلبات' : 'Order Status'}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-8 text-center text-slate-500">{isArabic ? 'جاري تحميل التقارير...' : 'Loading reports...'}</p>
            ) : orders.length === 0 ? (
              <p className="py-8 text-center text-slate-500">{isArabic ? 'لا توجد بيانات تقارير بعد.' : 'No report data yet.'}</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(report.statusCounts).map(([status, count]) => {
                  const percent = orders.length ? Math.round((count / orders.length) * 100) : 0
                  return (
                    <div key={status}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium">{statusLabel(status)}</span>
                        <span className="text-slate-500">{count} ({percent}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-900">
                        <div className="h-2 rounded-full bg-slate-900 dark:bg-slate-100" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  )
                })}
                <div className="grid gap-3 pt-2 sm:grid-cols-3">
                  <div className="rounded-md border p-3 dark:border-slate-800">
                    <CheckCircle2 className="mb-2 h-4 w-4 text-emerald-600" />
                    <p className="text-xl font-bold">{report.delivered}</p>
                    <p className="text-xs text-slate-500">{isArabic ? 'تم تسليمها' : 'Delivered'}</p>
                  </div>
                  <div className="rounded-md border p-3 dark:border-slate-800">
                    <ReceiptText className="mb-2 h-4 w-4 text-blue-600" />
                    <p className="text-xl font-bold">{report.receipts}</p>
                    <p className="text-xs text-slate-500">{isArabic ? 'إيصالات' : 'Receipts'}</p>
                  </div>
                  <div className="rounded-md border p-3 dark:border-slate-800">
                    <Activity className="mb-2 h-4 w-4 text-red-600" />
                    <p className="text-xl font-bold">{report.cancelled}</p>
                    <p className="text-xs text-slate-500">{isArabic ? 'ملغاة' : 'Cancelled'}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isArabic ? 'آخر الطلبات' : 'Recent Orders'}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="py-8 text-center text-slate-500">{isArabic ? 'جاري تحميل الطلبات...' : 'Loading orders...'}</p>
            ) : report.recentOrders.length === 0 ? (
              <p className="py-8 text-center text-slate-500">{isArabic ? 'لا توجد طلبات بعد.' : 'No orders yet.'}</p>
            ) : (
              <div className="space-y-3">
                {report.recentOrders.map((order) => (
                  <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 dark:border-slate-800">
                    <div>
                      <p className="font-semibold">{order.id}</p>
                      <p className="text-sm text-slate-500">{order.customer || '-'} - {order.createdAt ? new Date(order.createdAt).toLocaleString(locale) : '-'}</p>
                    </div>
                    <div className="text-end">
                      <p className="font-bold">{Number(order.total || 0).toFixed(2)} {currency}</p>
                      <p className="text-xs text-slate-500">{statusLabel(order.status)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
