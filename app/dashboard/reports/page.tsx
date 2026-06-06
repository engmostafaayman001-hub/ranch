'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, BarChart3, CalendarDays, CheckCircle2, Printer, ReceiptText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN, ORDER_STATUS_LABELS, ORDER_STATUS_LABELS_EN, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_LABELS_EN } from '@/lib/constants'
import { TrackedOrder, TrackingStatus } from '@/lib/order-tracking'
import { useAppStore } from '@/lib/app-store'
import { createClosingReceiptPayload } from '@/lib/closing-print'
import { printerManager, syncPrinterManagerSettings } from '@/lib/printer'

interface Customer {
  id?: string
  email?: string
  phone?: string
}

type Expense = {
  id: string
  name: string
  amount: number
  date: string
  note: string
}

type PeriodSummary = {
  orders: TrackedOrder[]
  expenses: Expense[]
  revenue: number
  expenseTotal: number
  net: number
}

const activeStatuses: TrackingStatus[] = ['placed', 'confirmed', 'preparing', 'ready_for_delivery', 'out_for_delivery']

function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function endOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(23, 59, 59, 999)
  return copy
}

function startOfWeek(date: Date) {
  const copy = startOfDay(date)
  const day = copy.getDay()
  const diff = day === 0 ? 6 : day - 1
  copy.setDate(copy.getDate() - diff)
  return copy
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

function isValidDate(date: Date) {
  return !Number.isNaN(date.getTime())
}

function orderDate(order: TrackedOrder) {
  const date = new Date(order.createdAt || '')
  return isValidDate(date) ? date : null
}

function expenseDate(expense: Expense) {
  const date = new Date(expense.date || expense.id || '')
  return isValidDate(date) ? date : null
}

function inRange(date: Date | null, from: Date, to: Date) {
  if (!date) return false
  const time = date.getTime()
  return time >= from.getTime() && time <= to.getTime()
}

function revenueOrders(orders: TrackedOrder[]) {
  return orders.filter((order) => order.status !== 'cancelled')
}

function summarizePeriod(orders: TrackedOrder[], expenses: Expense[], from: Date, to: Date): PeriodSummary {
  const scopedOrders = revenueOrders(orders).filter((order) => inRange(orderDate(order), from, to))
  const scopedExpenses = expenses.filter((expense) => inRange(expenseDate(expense), from, to))
  const revenue = scopedOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
  const expenseTotal = scopedExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  return { orders: scopedOrders, expenses: scopedExpenses, revenue, expenseTotal, net: revenue - expenseTotal }
}

function money(value: number, currency: string) {
  return `${Number(value || 0).toFixed(2)} ${currency}`
}

export default function DashboardReportsPage() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const locale = isArabic ? 'ar-EG' : 'en-US'
  const settings = useAppStore((state) => state.settings)
  const todayKey = new Date().toISOString().slice(0, 10)
  const [orders, setOrders] = useState<TrackedOrder[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [closingDate, setClosingDate] = useState(todayKey)
  const [closingOpen, setClosingOpen] = useState(false)
  const [printStatus, setPrintStatus] = useState('')
  const loadingReports = useRef(false)

  useEffect(() => {
    let mounted = true
    async function loadReports() {
      if (loadingReports.current) return
      loadingReports.current = true
      try {
        const [ordersResponse, customersResponse, expensesResponse] = await Promise.all([
          fetch('/api/pos/orders', { cache: 'no-store' }),
          fetch('/api/customers', { cache: 'no-store' }),
          fetch('/api/expenses', { cache: 'no-store' }),
        ])
        const ordersData = await ordersResponse.json().catch(() => ({}))
        const customersData = await customersResponse.json().catch(() => ({}))
        const expensesData = await expensesResponse.json().catch(() => ({}))
        if (!mounted) return
        setOrders(Array.isArray(ordersData.orders) ? ordersData.orders : [])
        setCustomers(Array.isArray(customersData.customers) ? customersData.customers : [])
        setExpenses(Array.isArray(expensesData.expenses) ? expensesData.expenses : [])
      } catch {
        if (!mounted) return
        setOrders([])
        setCustomers([])
        setExpenses([])
      } finally {
        loadingReports.current = false
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
    const now = new Date()
    const daily = summarizePeriod(orders, expenses, startOfDay(now), endOfDay(now))
    const weekly = summarizePeriod(orders, expenses, startOfWeek(now), endOfDay(now))
    const monthly = summarizePeriod(orders, expenses, startOfMonth(now), endOfMonth(now))
    const fullSystem = summarizePeriod(orders, expenses, new Date(0), new Date(8640000000000000))
    const validRevenueOrders = revenueOrders(orders)
    const average = validRevenueOrders.length ? fullSystem.revenue / validRevenueOrders.length : 0
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

    return { daily, weekly, monthly, fullSystem, average, delivered, cancelled, active, receipts, statusCounts, recentOrders }
  }, [orders, expenses])

  const closingSummary = useMemo(() => {
    const base = new Date(closingDate || todayKey)
    return summarizePeriod(orders, expenses, startOfDay(base), endOfDay(base))
  }, [closingDate, expenses, orders, todayKey])

  const paymentBreakdown = useMemo(() => {
    return closingSummary.orders.reduce<Record<string, number>>((totals, order) => {
      const method = order.payment?.method || 'cash'
      totals[method] = (totals[method] || 0) + Number(order.total || 0)
      return totals
    }, {})
  }, [closingSummary.orders])

  const sourceBreakdown = useMemo(() => {
    return closingSummary.orders.reduce<Record<string, number>>((totals, order) => {
      const source = order.source === 'restaurant_pos' ? 'pos' : 'app'
      totals[source] = (totals[source] || 0) + 1
      return totals
    }, {})
  }, [closingSummary.orders])

  const statusLabel = (status: string) => {
    const labels = isArabic ? ORDER_STATUS_LABELS : ORDER_STATUS_LABELS_EN
    return labels[status as keyof typeof ORDER_STATUS_LABELS] || status
  }

  const paymentLabel = (method: string) => {
    const labels = isArabic ? PAYMENT_METHOD_LABELS : PAYMENT_METHOD_LABELS_EN
    return labels[method as keyof typeof PAYMENT_METHOD_LABELS] || method
  }

  const printDailyClosing = async () => {
    setPrintStatus('')
    const cashierPrinter = settings.printers.cashier
    if (!cashierPrinter?.isEnabled) {
      setPrintStatus(isArabic ? 'فعّل طابعة الكاشير من الإعدادات قبل طباعة التقفيل.' : 'Enable the cashier printer in settings before printing the closing report.')
      return
    }

    syncPrinterManagerSettings(settings.printers)
    try {
      const result = await printerManager.printCashierReceipt(createClosingReceiptPayload({
        title: isArabic ? 'تقفيل يومي' : 'Daily Closing',
        dateLabel: closingDate,
        orders: closingSummary.orders,
        expenses: closingSummary.expenses,
        revenue: closingSummary.revenue,
        expenseTotal: closingSummary.expenseTotal,
        net: closingSummary.net,
        paymentBreakdown,
        paymentLabel,
        currency,
        isArabic,
        invoiceName: isArabic ? settings.invoiceNameAr : settings.invoiceNameEn,
        logoUrl: settings.invoiceLogo || settings.heroImage,
      })) as { skipped?: boolean; reason?: string }

      if (result?.skipped) {
        setPrintStatus(result.reason || (isArabic ? 'لم يتم إرسال التقفيل لأن الطابعة غير مكتملة الإعداد.' : 'Closing report was not sent because the printer is not fully configured.'))
        return
      }
      setPrintStatus(isArabic ? 'تم إرسال التقفيل إلى طابعة الكاشير.' : 'Closing report sent to the cashier printer.')
    } catch (error) {
      setPrintStatus(error instanceof Error ? error.message : (isArabic ? 'تعذر طباعة التقفيل.' : 'Could not print the closing report.'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold">{isArabic ? 'التقارير والتحليلات' : 'Reports and Analytics'}</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {isArabic ? 'إجماليات دقيقة للمبيعات والمصروفات، مع تقفيل يومي قابل للطباعة.' : 'Accurate sales and expense totals with printable daily closing.'}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <div>
            <Label htmlFor="closing-date">{isArabic ? 'تاريخ التقفيل' : 'Closing date'}</Label>
            <Input id="closing-date" type="date" value={closingDate} onChange={(event) => setClosingDate(event.target.value)} />
          </div>
          <Button className="gap-2 bg-red-600 hover:bg-red-700" onClick={() => setClosingOpen(true)}>
            <CalendarDays className="h-4 w-4" />
            {isArabic ? 'تقفيل يومي' : 'Daily Closing'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title={isArabic ? 'إجمالي اليوم' : 'Today Total'} value={money(report.daily.revenue, currency)} hint={`${report.daily.orders.length} ${isArabic ? 'طلب' : 'orders'} | ${isArabic ? 'صافي' : 'net'} ${money(report.daily.net, currency)}`} icon={CalendarDays} />
        <SummaryCard title={isArabic ? 'إجمالي الأسبوع' : 'Weekly Total'} value={money(report.weekly.revenue, currency)} hint={`${report.weekly.orders.length} ${isArabic ? 'طلب' : 'orders'} | ${isArabic ? 'صافي' : 'net'} ${money(report.weekly.net, currency)}`} icon={BarChart3} />
        <SummaryCard title={isArabic ? 'إجمالي الشهر' : 'Monthly Total'} value={money(report.monthly.revenue, currency)} hint={`${report.monthly.orders.length} ${isArabic ? 'طلب' : 'orders'} | ${isArabic ? 'صافي' : 'net'} ${money(report.monthly.net, currency)}`} icon={Activity} />
        <SummaryCard title={isArabic ? 'إجمالي السيستم كامل' : 'Full System Total'} value={money(report.fullSystem.revenue, currency)} hint={`${orders.length} ${isArabic ? 'طلب' : 'orders'} | ${isArabic ? 'مصروفات' : 'expenses'} ${money(report.fullSystem.expenseTotal, currency)}`} icon={ReceiptText} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MiniMetric title={isArabic ? 'متوسط الطلب' : 'Average Order'} value={money(report.average, currency)} />
        <MiniMetric title={isArabic ? 'الطلبات النشطة' : 'Active Orders'} value={String(report.active)} />
        <MiniMetric title={isArabic ? 'العملاء' : 'Customers'} value={String(customers.length)} />
        <MiniMetric title={isArabic ? 'إيصالات مرفوعة' : 'Uploaded Receipts'} value={String(report.receipts)} />
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
                  <MetricBox icon={CheckCircle2} value={report.delivered} label={isArabic ? 'تم تسليمها' : 'Delivered'} />
                  <MetricBox icon={ReceiptText} value={report.receipts} label={isArabic ? 'إيصالات' : 'Receipts'} />
                  <MetricBox icon={Activity} value={report.cancelled} label={isArabic ? 'ملغاة' : 'Cancelled'} />
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
                      <p className="font-bold">{money(Number(order.total || 0), currency)}</p>
                      <p className="text-xs text-slate-500">{statusLabel(order.status)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {closingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-md bg-white shadow-xl dark:bg-slate-950">
            <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <div>
                <h3 className="text-xl font-bold">{isArabic ? 'تقفيل يومي' : 'Daily Closing'}</h3>
                <p className="text-sm text-slate-500">{closingDate}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="gap-2" onClick={printDailyClosing}>
                  <Printer className="h-4 w-4" />
                  {isArabic ? 'طباعة' : 'Print'}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setClosingOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <div className="space-y-4 p-4">
              {printStatus && <p className="rounded-md bg-slate-100 p-3 text-sm dark:bg-slate-900">{printStatus}</p>}
              <div className="grid gap-3 md:grid-cols-3">
                <SummaryPanel label={isArabic ? 'إجمالي المبيعات' : 'Sales Total'} value={money(closingSummary.revenue, currency)} />
                <SummaryPanel label={isArabic ? 'المصروفات' : 'Expenses'} value={money(closingSummary.expenseTotal, currency)} />
                <SummaryPanel label={isArabic ? 'الصافي' : 'Net'} value={money(closingSummary.net, currency)} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>{isArabic ? 'طرق الدفع' : 'Payment Methods'}</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(paymentBreakdown).length === 0 ? (
                      <p className="text-sm text-slate-500">{isArabic ? 'لا توجد مدفوعات لهذا اليوم.' : 'No payments for this day.'}</p>
                    ) : Object.entries(paymentBreakdown).map(([method, total]) => (
                      <div key={method} className="flex justify-between rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900">
                        <span>{paymentLabel(method)}</span>
                        <strong>{money(total, currency)}</strong>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>{isArabic ? 'مصدر الطلبات' : 'Order Source'}</CardTitle></CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    <SummaryPanel label={isArabic ? 'نقطة البيع' : 'POS'} value={String(sourceBreakdown.pos || 0)} compact />
                    <SummaryPanel label={isArabic ? 'التطبيق' : 'App'} value={String(sourceBreakdown.app || 0)} compact />
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader><CardTitle>{isArabic ? 'طلبات اليوم' : 'Day Orders'}</CardTitle></CardHeader>
                <CardContent>
                  {closingSummary.orders.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-500">{isArabic ? 'لا توجد طلبات لهذا اليوم.' : 'No orders for this day.'}</p>
                  ) : (
                    <div className="space-y-2">
                      {closingSummary.orders.map((order) => (
                        <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm dark:border-slate-800">
                          <div>
                            <p className="font-semibold">{order.id}</p>
                            <p className="text-slate-500">{order.customer || '-'} - {paymentLabel(order.payment?.method || 'cash')}</p>
                          </div>
                          <strong>{money(Number(order.total || 0), currency)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ title, value, hint, icon: Icon }: { title: string; value: string; hint: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-red-600" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      </CardContent>
    </Card>
  )
}

function MiniMetric({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-slate-500">{title}</p>
        <p className="mt-2 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}

function MetricBox({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: number; label: string }) {
  return (
    <div className="rounded-md border p-3 dark:border-slate-800">
      <Icon className="mb-2 h-4 w-4 text-red-600" />
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}

function SummaryPanel({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`${compact ? 'text-2xl' : 'text-3xl'} mt-2 font-bold`}>{value}</p>
    </div>
  )
}
