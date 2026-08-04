'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  CreditCard,
  AlertTriangle,
  Printer,
  RefreshCw,
  Trash2,
  TrendingUp,
  Wallet,
  XCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN, ORDER_STATUS_LABELS, ORDER_STATUS_LABELS_EN, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_LABELS_EN } from '@/lib/constants'
import type { ClosingRecord, SavedClosingExpense } from '@/lib/closings'
import { readAllClosings } from '@/lib/closings'
import { summarizeClosingData } from '@/lib/financial-calculations'
import type { TrackedOrder } from '@/lib/order-tracking'

type Expense = SavedClosingExpense

type Customer = {
  id?: string
  email?: string
  phone?: string
}

function money(value: number, currency: string) {
  return `${Number(value || 0).toFixed(2)} ${currency}`
}

function parseDate(value?: string | null) {
  const date = new Date(value || '')
  return Number.isNaN(date.getTime()) ? null : date
}

function inRange(value: string | undefined, start: string, end: string) {
  const date = parseDate(value)
  if (!date) return false
  if (start) {
    const startDate = new Date(`${start}T00:00:00`)
    if (!Number.isNaN(startDate.getTime()) && date.getTime() < startDate.getTime()) return false
  }
  if (end) {
    const endDate = new Date(`${end}T23:59:59.999`)
    if (!Number.isNaN(endDate.getTime()) && date.getTime() > endDate.getTime()) return false
  }
  return true
}

function uniqueOrders(...groups: TrackedOrder[][]) {
  const map = new Map<string, TrackedOrder>()
  for (const orders of groups) {
    for (const order of orders) {
      if (!order?.id) continue
      const existing = map.get(order.id)
      if (!existing || (!existing.lines?.length && order.lines?.length)) map.set(order.id, order)
    }
  }
  return Array.from(map.values()).sort((first, second) => {
    const firstNumber = Number(first.displayNumber || 0)
    const secondNumber = Number(second.displayNumber || 0)
    if (firstNumber !== secondNumber) return secondNumber - firstNumber
    return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
  })
}

function uniqueExpenses(...groups: Expense[][]) {
  const map = new Map<string, Expense>()
  for (const expenses of groups) {
    for (const expense of expenses) {
      if (expense?.id) map.set(expense.id, expense)
    }
  }
  return Array.from(map.values()).sort((first, second) => new Date(second.date || '').getTime() - new Date(first.date || '').getTime())
}

function getClosingCancelledCount(closing: ClosingRecord) {
  if (typeof closing.cancelledOrdersCount === 'number') return closing.cancelledOrdersCount
  return closing.orders?.filter((order) => order.status === 'cancelled').length || 0
}

export default function DashboardReportsPage() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const locale = isArabic ? 'ar-EG' : 'en-US'
  const [orders, setOrders] = useState<TrackedOrder[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [closings, setClosings] = useState<ClosingRecord[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [clearMemoryOpen, setClearMemoryOpen] = useState(false)
  const [clearingMemory, setClearingMemory] = useState(false)
  const [clearStatus, setClearStatus] = useState('')

  const loadReports = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [ordersResponse, expensesResponse, customersResponse, closingRecords] = await Promise.all([
        fetch('/api/orders?limit=9999', { cache: 'no-store' }),
        fetch('/api/expenses', { cache: 'no-store' }),
        fetch('/api/customers', { cache: 'no-store' }),
        readAllClosings(),
      ])

      const ordersData = await ordersResponse.json().catch(() => ({}))
      const expensesData = await expensesResponse.json().catch(() => ({}))
      const customersData = await customersResponse.json().catch(() => ({}))
      const currentOrders = Array.isArray(ordersData.orders) ? ordersData.orders as TrackedOrder[] : []
      const currentExpenses = Array.isArray(expensesData.expenses) ? expensesData.expenses as Expense[] : []
      setOrders(uniqueOrders(currentOrders))
      setExpenses(uniqueExpenses(currentExpenses))
      setClosings(closingRecords)
      setCustomers(Array.isArray(customersData.customers) ? customersData.customers : [])
    } catch (loadError) {
      setOrders([])
      setExpenses([])
      setClosings([])
      setCustomers([])
      setError(loadError instanceof Error ? loadError.message : (isArabic ? 'تعذر تحميل التقارير.' : 'Could not load reports.'))
    } finally {
      setLoading(false)
    }
  }, [isArabic])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReports()
    }, 0)
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadReports()
    }, 600000)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(interval)
    }
  }, [loadReports])

  const scopedOrders = useMemo(() => orders.filter((order) => inRange(order.createdAt, rangeStart, rangeEnd)), [orders, rangeEnd, rangeStart])
  const scopedExpenses = useMemo(() => expenses.filter((expense) => inRange(expense.date, rangeStart, rangeEnd)), [expenses, rangeEnd, rangeStart])
  const scopedClosings = useMemo(() => closings.filter((closing) => inRange(closing.closedAt || closing.openedAt, rangeStart, rangeEnd)), [closings, rangeEnd, rangeStart])
  const summary = useMemo(() => summarizeClosingData(scopedOrders, scopedExpenses), [scopedExpenses, scopedOrders])

  const report = useMemo(() => {
    const completedOrders = scopedOrders.filter((order) => order.status !== 'cancelled')
    const cancelledOrders = scopedOrders.filter((order) => order.status === 'cancelled')
    const appOrders = completedOrders.filter((order) => order.source !== 'restaurant_pos')
    const restaurantOrders = completedOrders.filter((order) => order.source === 'restaurant_pos')
    const closedShiftCount = scopedClosings.filter((closing) => closing.type !== 'driver').length
    const driverClosingCount = scopedClosings.filter((closing) => closing.type === 'driver').length
    const closingCancelledOrders = scopedClosings.reduce((sum, closing) => sum + getClosingCancelledCount(closing), 0)
    const closingOrdersCount = scopedClosings.reduce((sum, closing) => sum + Number(closing.ordersCount || 0), 0)
    const closingCompletedOrders = Math.max(0, closingOrdersCount - closingCancelledOrders)
    const closingNetSales = scopedClosings.reduce((sum, closing) => sum + Number(closing.salesWithoutDelivery || 0), 0)
    const closingExpenses = scopedClosings.reduce((sum, closing) => sum + Number(closing.expensesTotal || 0), 0)
    const closingDrawerNet = scopedClosings.reduce((sum, closing) => sum + Number(closing.drawerNet || 0), 0)
    const closingSavedExpensesCount = scopedClosings.reduce((sum, closing) => (
      Number(closing.expensesTotal || 0) > 0 ? sum + 1 : sum
    ), 0)
    const totalItems = completedOrders.reduce((sum, order) => sum + Number(order.items || 0), 0)
    const totalCompletedOrders = completedOrders.length + closingCompletedOrders
    const totalNetSales = summary.netSales + closingNetSales
    const averageOrder = totalCompletedOrders ? totalNetSales / totalCompletedOrders : 0

    const paymentTotals = completedOrders.reduce<Record<string, number>>((totals, order) => {
      const method = String(order.payment?.method || 'cash')
      totals[method] = (totals[method] || 0) + Number(order.total || 0)
      return totals
    }, {})

    const statusCounts = scopedOrders.reduce<Record<string, number>>((counts, order) => {
      counts[order.status] = (counts[order.status] || 0) + 1
      return counts
    }, {})

    const products = new Map<string, { name: string; quantity: number; total: number }>()
    for (const order of completedOrders) {
      for (const line of order.lines || []) {
        const name = (isArabic ? line.nameAr || line.name : line.nameEn || line.name) || line.product?.name || 'Item'
        const current = products.get(name) || { name, quantity: 0, total: 0 }
        current.quantity += Number(line.quantity || 0)
        current.total += Number(line.price || 0) * Number(line.quantity || 0)
        products.set(name, current)
      }
    }

    return {
      completedOrders,
      cancelledOrders,
      appOrders,
      restaurantOrders,
      closedShiftCount,
      driverClosingCount,
      closingCancelledOrders,
      closingOrdersCount,
      closingCompletedOrders,
      closingNetSales,
      closingExpenses,
      closingDrawerNet,
      closingSavedExpensesCount,
      totalCompletedOrders,
      totalNetSales,
      totalItems,
      averageOrder,
      paymentTotals,
      statusCounts,
      topProducts: Array.from(products.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 8),
      recentClosings: [...scopedClosings].sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime()).slice(0, 6),
      recentOrders: [...scopedOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 7),
    }
  }, [isArabic, scopedClosings, scopedOrders, summary.netSales])

  const statusLabel = (status: string) => {
    const labels = isArabic ? ORDER_STATUS_LABELS : ORDER_STATUS_LABELS_EN
    return labels[status as keyof typeof ORDER_STATUS_LABELS] || status
  }

  const paymentLabel = (method: string) => {
    const labels = isArabic ? PAYMENT_METHOD_LABELS : PAYMENT_METHOD_LABELS_EN
    return labels[method as keyof typeof PAYMENT_METHOD_LABELS] || method
  }

  const clearReportMemory = async () => {
    if (!clearMemoryOpen) {
      setClearMemoryOpen(true)
      setClearStatus('')
      return
    }

    setClearingMemory(true)
    setClearStatus('')
    setError('')
    try {
      const response = await fetch('/api/reports/memory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || data.error || 'Could not clear report memory')

      if (typeof window !== 'undefined') {
        ;[
          'baseeta-closings-v1',
          'trackedOrders',
          'baseeta-auto-printed-app-orders-v2',
        ].forEach((key) => window.localStorage.removeItem(key))
        window.dispatchEvent(new Event('storage'))
        window.dispatchEvent(new CustomEvent('closings:updated', { detail: { cleared: true } }))
      }

      setOrders([])
      setExpenses([])
      setClosings([])
      setClearMemoryOpen(false)
      setClearStatus(isArabic ? 'تم حذف ذاكرة الطلبات والمدفوعات والمصروفات والتقفيلات فقط.' : 'Orders, payments, expenses, and closings memory was cleared.')
    } catch (clearError) {
      setClearStatus(clearError instanceof Error ? clearError.message : (isArabic ? 'تعذر حذف الذاكرة.' : 'Could not clear memory.'))
    } finally {
      setClearingMemory(false)
    }
  }

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
      <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold text-red-600">{isArabic ? 'تقارير التطبيق بالكامل' : 'Full Application Reports'}</p>
            <h2 className="mt-1 text-3xl font-bold">{isArabic ? 'لوحة تقارير شاملة' : 'Executive Reports Dashboard'}</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              {isArabic ? 'الأرقام هنا تجمع الطلبات الحالية والطلبات المحفوظة داخل التقفيلات، لذلك تظل نتائج الورديات المقفولة ظاهرة بعد إغلاقها.' : 'Figures combine current orders with saved closing snapshots, so closed shift results remain visible after settlement.'}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto_auto]">
            <label className="space-y-1">
              <Label>{isArabic ? 'من تاريخ' : 'From'}</Label>
              <Input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} />
            </label>
            <label className="space-y-1">
              <Label>{isArabic ? 'إلى تاريخ' : 'To'}</Label>
              <Input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} />
            </label>
            <Button variant="outline" className="gap-2 self-end" onClick={loadReports} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {isArabic ? 'تحديث' : 'Refresh'}
            </Button>
            <Button className="gap-2 self-end bg-red-600 hover:bg-red-700" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              {isArabic ? 'طباعة' : 'Print'}
            </Button>
            <Button variant="outline" className="gap-2 self-end border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={clearReportMemory} disabled={clearingMemory}>
              <Trash2 className="h-4 w-4" />
              {isArabic ? 'حذف الذاكرة' : 'Clear Memory'}
            </Button>
          </div>
        </div>
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</div> : null}
      {clearStatus ? <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">{clearStatus}</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={TrendingUp} title={isArabic ? 'صافي المبيعات' : 'Net Sales'} value={money(summary.netSales, currency)} tone="green" />
        <MetricCard icon={Wallet} title={isArabic ? 'صافي الدرج' : 'Drawer Net'} value={money(summary.expectedDrawer, currency)} tone="blue" />
        <MetricCard icon={XCircle} title={isArabic ? 'الطلبات الملغية' : 'Cancelled Orders'} value={String(report.cancelledOrders.length)} tone="red" />
        <MetricCard icon={CalendarDays} title={isArabic ? 'الورديات المقفولة' : 'Closed Shifts'} value={String(report.closedShiftCount)} tone="slate" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SmallStat label={isArabic ? 'إجمالي الطلبات' : 'Total Orders'} value={String(scopedOrders.length)} />
        <SmallStat label={isArabic ? 'الطلبات المكتملة' : 'Completed Orders'} value={String(report.completedOrders.length)} />
        <SmallStat label={isArabic ? 'طلبات التطبيق' : 'App Orders'} value={String(report.appOrders.length)} />
        <SmallStat label={isArabic ? 'طلبات المطعم' : 'Restaurant Orders'} value={String(report.restaurantOrders.length)} />
        <SmallStat label={isArabic ? 'إجمالي المصروفات' : 'Total Expenses'} value={money(summary.expenses, currency)} />
        <SmallStat label={isArabic ? 'متوسط الطلب' : 'Average Order'} value={money(report.averageOrder, currency)} />
        <SmallStat label={isArabic ? 'المنتجات المباعة' : 'Items Sold'} value={String(report.totalItems)} />
        <SmallStat label={isArabic ? 'تقفيلات السائقين' : 'Driver Closings'} value={String(report.driverClosingCount)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>{isArabic ? 'أداء الورديات المقفولة' : 'Closed Shift Performance'}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <SmallStat label={isArabic ? 'عدد الورديات' : 'Shifts'} value={String(report.closedShiftCount)} />
            <SmallStat label={isArabic ? 'طلبات ملغية داخل التقفيلات' : 'Cancelled in Closings'} value={String(report.closingCancelledOrders)} />
            <SmallStat label={isArabic ? 'مصروفات محفوظة' : 'Saved Expenses'} value={String(scopedClosings.reduce((sum, closing) => sum + (closing.expenses?.length || 0), 0))} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isArabic ? 'مصادر الطلبات' : 'Order Sources'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ProgressRow label={isArabic ? 'التطبيق' : 'App'} value={report.appOrders.length} total={report.completedOrders.length} />
            <ProgressRow label={isArabic ? 'المطعم' : 'Restaurant'} value={report.restaurantOrders.length} total={report.completedOrders.length} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{isArabic ? 'حالات الطلبات' : 'Order Statuses'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(report.statusCounts).length === 0 ? <EmptyText text={isArabic ? 'لا توجد طلبات.' : 'No orders.'} /> : null}
            {Object.entries(report.statusCounts).map(([status, count]) => (
              <ProgressRow key={status} label={statusLabel(status)} value={count} total={scopedOrders.length} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isArabic ? 'طرق الدفع' : 'Payment Methods'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(report.paymentTotals).length === 0 ? <EmptyText text={isArabic ? 'لا توجد مدفوعات.' : 'No payments.'} /> : null}
            {Object.entries(report.paymentTotals).map(([method, total]) => (
              <div key={method} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900">
                <span className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-slate-400" />{paymentLabel(method)}</span>
                <strong>{money(total, currency)}</strong>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isArabic ? 'أفضل المنتجات' : 'Top Products'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.topProducts.length === 0 ? <EmptyText text={isArabic ? 'لا توجد بيانات منتجات.' : 'No product data.'} /> : null}
            {report.topProducts.map((product) => (
              <div key={product.name} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{product.name}</p>
                  <p className="text-xs text-slate-500">{isArabic ? 'الكمية' : 'Qty'}: {product.quantity}</p>
                </div>
                <strong>{money(product.total, currency)}</strong>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{isArabic ? 'أحدث التقفيلات' : 'Recent Closings'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.recentClosings.length === 0 ? <EmptyText text={isArabic ? 'لا توجد تقفيلات.' : 'No closings.'} /> : null}
            {report.recentClosings.map((closing) => (
              <div key={closing.id} className="grid gap-3 rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800 sm:grid-cols-[1fr_auto]">
                <div>
                  <p className="font-semibold">{closing.type === 'driver' ? (isArabic ? 'تقفيل سائقين' : 'Driver Closing') : (isArabic ? 'تقفيل وردية' : 'Shift Closing')}</p>
                  <p className="text-xs text-slate-500">{new Date(closing.closedAt).toLocaleString(locale)}</p>
                </div>
                <div className="text-end">
                  <p className="font-bold">{money(Number(closing.drawerNet || 0), closing.currency || currency)}</p>
                  <p className="text-xs text-slate-500">{isArabic ? 'ملغية' : 'Cancelled'}: {getClosingCancelledCount(closing)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isArabic ? 'أحدث الطلبات' : 'Recent Orders'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.recentOrders.length === 0 ? <EmptyText text={isArabic ? 'لا توجد طلبات.' : 'No orders.'} /> : null}
            {report.recentOrders.map((order) => (
              <div key={order.id} className="grid gap-3 rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800 sm:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <p className="font-semibold">#{order.displayNumber || order.id}</p>
                  <p className="truncate text-xs text-slate-500">{order.customer || '-'} - {new Date(order.createdAt).toLocaleString(locale)}</p>
                </div>
                <div className="text-end">
                  <p className={order.status === 'cancelled' ? 'font-bold text-red-600' : 'font-bold'}>{money(Number(order.total || 0), currency)}</p>
                  <p className="text-xs text-slate-500">{statusLabel(order.status)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
        {loading
          ? (isArabic ? 'جاري تحميل بيانات التقرير...' : 'Loading report data...')
          : (isArabic ? `تم تحميل ${orders.length} طلب و ${closings.length} تقفيل و ${customers.length} عميل.` : `Loaded ${orders.length} orders, ${closings.length} closings, and ${customers.length} customers.`)}
      </div>

      {clearMemoryOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                {isArabic ? 'تأكيد حذف الذاكرة' : 'Confirm Memory Clear'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {isArabic
                  ? 'سيتم حذف التقفيلات القديمة والطلبات والمصروفات والمدفوعات فقط. لن يتم حذف المنتجات أو الأقسام أو الإعدادات أو العملاء.'
                  : 'This clears old closings, orders, expenses, and payments only. Products, categories, settings, and customers will not be deleted.'}
              </p>
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">
                {isArabic ? 'لا يمكن التراجع عن هذه العملية.' : 'This action cannot be undone.'}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setClearMemoryOpen(false)} disabled={clearingMemory}>
                  {isArabic ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button className="flex-1 gap-2 bg-red-600 hover:bg-red-700" onClick={clearReportMemory} disabled={clearingMemory}>
                  <Trash2 className="h-4 w-4" />
                  {clearingMemory ? (isArabic ? 'جاري الحذف...' : 'Clearing...') : (isArabic ? 'حذف' : 'Clear')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}

function MetricCard({ icon: Icon, title, value, tone }: { icon: LucideIcon; title: string; value: string; tone: 'green' | 'blue' | 'red' | 'slate' }) {
  const tones = {
    green: 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200',
    blue: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200',
    red: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
    slate: 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100',
  }

  return (
    <div className={`rounded-md border p-4 shadow-sm ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
        </div>
        <Icon className="h-5 w-5 opacity-70" />
      </div>
    </div>
  )
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  )
}

function ProgressRow({ label, value, total }: { label: string; value: number; total: number }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-slate-500">{value} ({percent}%)</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-900">
        <div className="h-2 rounded-full bg-red-600" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function EmptyText({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">{text}</p>
}
