'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/components/language-provider'
import { getSettledClosingIds, readAllClosings, readClosings, type ClosingRecord, type SavedClosingExpense } from '@/lib/closings'
import { CURRENCY_EN } from '@/lib/constants'
import { useAppStore } from '@/lib/app-store'
import { Dialog } from '@/components/ui/dialog'
import { printerManager, syncPrinterManagerSettings, trackedOrderToReceiptPayload } from '@/lib/printer'
import { createClosingReceiptPayload } from '@/lib/closing-print'
import { summarizeClosingData } from '@/lib/financial-calculations'
import useShiftSession from '@/lib/use-shift-session'
import performShiftClosing from '@/lib/shift-closing'
import { TrackedOrder } from '@/lib/order-tracking'
import { ClosingReport } from '@/lib/closing-report'
import { isItemInShiftWindow, isItemWithinDateRange } from '@/lib/pos-day-session'

function isValidDate(date: Date) {
  return !Number.isNaN(date.getTime())
}

function StatCard({ title, value, currency, accent = false }: { title: string; value: string | number; currency?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm transition ${accent ? 'border-red-200 bg-gradient-to-br from-red-600 to-red-700 text-white shadow-red-100 dark:border-red-900 dark:shadow-red-950/30' : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100'}`}>
      <p className={`text-sm ${accent ? 'text-red-100' : 'text-slate-500 dark:text-slate-400'}`}>{title}</p>
      <p className="mt-2 text-2xl font-bold">
        {value}{currency ? ` ${currency}` : ''}
      </p>
    </div>
  )
}

function getClosingCancelledCount(closing: ClosingRecord) {
  if (typeof closing.cancelledOrdersCount === 'number') return closing.cancelledOrdersCount
  return closing.orders?.filter((order) => order.status === 'cancelled').length || 0
}

function ClosingReportDetails({ report, currency = 'EGP', isArabic }: { report: ClosingReport; currency?: string; isArabic: boolean }) {
  const [actualDrawer, setActualDrawer] = useState(report.actualDrawer)
  const drawerDifference = actualDrawer - report.expectedDrawer

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-red-700 p-5 text-white shadow-sm dark:border-slate-800">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm text-red-100">{isArabic ? 'ملخص أداء الوردية' : 'Shift performance overview'}</p>
            <h3 className="mt-2 text-2xl font-semibold">{isArabic ? 'نظرة شاملة على الإيرادات والطلبات' : 'A complete view of sales, orders, and delivery performance'}</h3>
            <p className="mt-2 text-sm text-slate-200">{isArabic ? 'تتضمن المؤشرات الأساسية التي تساعدك على تقييم الوردية بسرعة.' : 'Includes the key indicators you need to review the shift at a glance.'}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard title={isArabic ? 'إجمالي المبيعات' : 'Gross Sales'} value={report.grossSales.toFixed(2)} currency={currency} accent />
            <StatCard title={isArabic ? 'إجمالي الخصومات' : 'Total Discounts'} value={report.totalDiscounts.toFixed(2)} currency={currency} accent />
            <StatCard title={isArabic ? 'إيرادات التوصيل' : 'Delivery Revenue'} value={report.deliveryRevenue.toFixed(2)} currency={currency} accent />
            <StatCard title={isArabic ? 'الطلبات الملغاة' : 'Cancelled Orders'} value={report.cancelledOrders} accent />
            <StatCard title={isArabic ? 'الطلبات المكتملة' : 'Completed Orders'} value={report.completedOrders} accent />
            <StatCard title={isArabic ? 'صافي المبيعات' : 'Net Sales'} value={report.netSales.toFixed(2)} currency={currency} accent />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isArabic ? 'ملخص المبيعات' : 'Sales Summary'}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <StatCard title={isArabic ? 'إجمالي المبيعات' : 'Gross Sales'} value={report.grossSales.toFixed(2)} currency={currency} />
          <StatCard title={isArabic ? 'صافي المبيعات' : 'Net Sales'} value={report.netSales.toFixed(2)} currency={currency} />
          <StatCard title={isArabic ? 'مبيعات المنتجات' : 'Product Sales'} value={report.productSales.toFixed(2)} currency={currency} />
          <StatCard title={isArabic ? 'إيرادات التوصيل' : 'Delivery Revenue'} value={report.deliveryRevenue.toFixed(2)} currency={currency} />
          <StatCard title={isArabic ? 'إجمالي الخصومات' : 'Total Discounts'} value={report.totalDiscounts.toFixed(2)} currency={currency} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isArabic ? 'الطلبات' : 'Orders'}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <StatCard title={isArabic ? 'إجمالي الطلبات' : 'Total Orders'} value={report.totalOrders} />
          <StatCard title={isArabic ? 'الطلبات المكتملة' : 'Completed Orders'} value={report.completedOrders} />
          <StatCard title={isArabic ? 'الطلبات الملغاة' : 'Cancelled Orders'} value={report.cancelledOrders} />
          <StatCard title={isArabic ? 'طلبات التطبيق' : 'Application Orders'} value={report.applicationOrders} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isArabic ? 'طرق الدفع' : 'Payment Methods'}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <StatCard title={isArabic ? 'نقداً' : 'Cash'} value={report.paymentMethods.cash.toFixed(2)} currency={currency} />
          <StatCard title={isArabic ? 'بطاقة' : 'Card'} value={report.paymentMethods.card.toFixed(2)} currency={currency} />
          <StatCard title={isArabic ? 'تحويل بنكي' : 'Bank Transfer'} value={report.paymentMethods.bankTransfer.toFixed(2)} currency={currency} />
          <StatCard title={isArabic ? 'تطبيق' : 'Application'} value={report.paymentMethods.application.toFixed(2)} currency={currency} />
          <StatCard title={isArabic ? 'أخرى' : 'Other'} value={report.paymentMethods.other.toFixed(2)} currency={currency} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isArabic ? 'الدرج' : 'Cash Drawer'}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <StatCard title={isArabic ? 'نقدية الافتتاح' : 'Opening Cash'} value={report.openingCash.toFixed(2)} currency={currency} />
          <StatCard title={isArabic ? 'الدرج المتوقع' : 'Expected Drawer'} value={report.expectedDrawer.toFixed(2)} currency={currency} />
          <div>
            <label className="space-y-1">
              <span className="text-sm font-medium">{isArabic ? 'الدرج الفعلي' : 'Actual Drawer'}</span>
              <Input type="number" value={actualDrawer} onChange={(e) => setActualDrawer(Number(e.target.value))} />
            </label>
          </div>
          <StatCard title={isArabic ? 'فرق الدرج' : 'Drawer Difference'} value={drawerDifference.toFixed(2)} currency={currency} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isArabic ? 'ملخص مالي' : 'Financial Summary'}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <StatCard title={isArabic ? 'المصروفات' : 'Expenses'} value={report.expenses.toFixed(2)} currency={currency} />
          <StatCard title={isArabic ? 'صافي الربح' : 'Net Revenue'} value={report.netRevenue.toFixed(2)} currency={currency} />
          <StatCard title={isArabic ? 'رصيد الدرج النهائي' : 'Final Drawer Balance'} value={actualDrawer.toFixed(2)} currency={currency} />
        </CardContent>
      </Card>
    </div>
  )
}


export default function ClosingsPage() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const [closings, setClosings] = useState<ClosingRecord[]>([])
  const [filterStart, setFilterStart] = useState('')
  const [filterEnd, setFilterEnd] = useState('')
  const [selectedClosingId, setSelectedClosingId] = useState<string | null>(null)
  const [selectedClosingOrders, setSelectedClosingOrders] = useState<TrackedOrder[]>([])
  const [selectedClosingExpenses, setSelectedClosingExpenses] = useState<SavedClosingExpense[]>([])
  const [closingReport, setClosingReport] = useState<ClosingReport | null>(null)
  const [loadingClosingDetails, setLoadingClosingDetails] = useState(false)
  const [showClosingModal, setShowClosingModal] = useState(false)
  const [closingModalTab, setClosingModalTab] = useState<'details' | 'orders' | 'expenses'>('details')
  const [sessionOrders, setSessionOrders] = useState<TrackedOrder[]>([])
  const [sessionExpenses, setSessionExpenses] = useState<SavedClosingExpense[]>([])
  const [loadingSessionItems, setLoadingSessionItems] = useState(false)
  const [printStatus, setPrintStatus] = useState('')
  const settings = useAppStore((state) => state.settings)
  const products = useAppStore((state) => state.products)
  const [daySession, setDaySession] = useShiftSession()
  const [closingBusy, setClosingBusy] = useState(false)
  const closingsLength = closings.length
  const latestClosingId = closings[0]?.id

  const loadClosings = useCallback(async () => {
    const nextClosings = await readAllClosings()
    setClosings(nextClosings)
    return nextClosings
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadClosings()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadClosings])

  useEffect(() => {
    const handleStorageChange = () => {
      void loadClosings()
    }
    
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('closings:updated', handleStorageChange)
    
    const interval = window.setInterval(() => {
      const updated = readClosings()
      const hasChanges = updated.length !== closingsLength || (updated[0]?.id !== latestClosingId)
      if (hasChanges) {
        void loadClosings()
      }
    }, 300)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('closings:updated', handleStorageChange)
      window.clearInterval(interval)
    }
  }, [closingsLength, latestClosingId, loadClosings])

  const filteredClosings = useMemo(() => {
    const startDate = filterStart ? new Date(`${filterStart}T00:00:00`) : null
    const endDate = filterEnd ? new Date(`${filterEnd}T23:59:59.999`) : null
    if ((startDate && !isValidDate(startDate)) || (endDate && !isValidDate(endDate))) return closings
    if (!startDate && !endDate) return closings
    if (startDate && endDate) {
      const [from, to] = startDate.getTime() <= endDate.getTime() ? [startDate, endDate] : [endDate, startDate]
      return closings.filter((closing) => {
        const openedAt = new Date(closing.openedAt)
        return !Number.isNaN(openedAt.getTime()) && openedAt.getTime() >= from.getTime() && openedAt.getTime() <= to.getTime()
      })
    }
    if (startDate) {
      return closings.filter((closing) => {
        const openedAt = new Date(closing.openedAt)
        return !Number.isNaN(openedAt.getTime()) && openedAt.getTime() >= startDate.getTime()
      })
    }
    return closings.filter((closing) => {
      const openedAt = new Date(closing.openedAt)
      return !Number.isNaN(openedAt.getTime()) && openedAt.getTime() <= endDate!.getTime()
    })
  }, [closings, filterStart, filterEnd])

  const selectedClosing = closings.find((closing) => closing.id === selectedClosingId)

  const closureOrders = selectedClosing?.orders?.length ? selectedClosing.orders : selectedClosingOrders
  const closureExpenses = selectedClosing?.expenses?.length ? selectedClosing.expenses : selectedClosingExpenses

  const sessionSummary = summarizeClosingData(closureOrders, closureExpenses)
  const selectedClosingOrdersCount = selectedClosing?.ordersCount ?? closureOrders.length
  const selectedClosingCancelledCount = selectedClosing ? getClosingCancelledCount(selectedClosing) || sessionSummary.cancelledOrders : sessionSummary.cancelledOrders

  const paymentBreakdown = useMemo(() => {
    return closureOrders.reduce<Record<string, number>>((totals, order) => {
      if (order.status === 'cancelled') return totals
      const method = String(order.payment?.method || 'cash')
      totals[method] = (totals[method] || 0) + Number(order.total || 0)
      return totals
    }, {})
  }, [closureOrders])

  const createOrderPrintPayload = useCallback((order: TrackedOrder) => trackedOrderToReceiptPayload(order, {
    isArabic,
    currency: selectedClosing?.currency || CURRENCY_EN,
    productCatalog: products,
    invoiceName: isArabic ? settings.invoiceNameAr : settings.invoiceNameEn,
    invoiceAddress: isArabic ? settings.addressAr : settings.addressEn,
    invoicePhone: settings.phone,
    invoiceQrUrl: settings.printers.cashier.printsQr === false ? undefined : settings.invoiceQrUrl,
    invoiceQrUrl2: settings.printers.cashier.printsQr === false ? undefined : settings.invoiceQrUrl2,
    invoiceMessage: isArabic ? settings.invoiceWelcomeAr : settings.invoiceWelcomeEn,
    logoUrl: settings.invoiceLogo,
  }), [isArabic, products, selectedClosing?.currency, settings.addressAr, settings.addressEn, settings.invoiceLogo, settings.invoiceNameAr, settings.invoiceNameEn, settings.invoiceQrUrl, settings.invoiceQrUrl2, settings.invoiceWelcomeAr, settings.invoiceWelcomeEn, settings.phone, settings.printers.cashier.printsQr])

  const handlePrintClosingOrder = useCallback(async (order: TrackedOrder) => {
    try {
      syncPrinterManagerSettings(settings.printers)
      const result = await printerManager.printCashierReceipt(createOrderPrintPayload(order))
      if ((result as { skipped?: boolean; reason?: string } | undefined)?.skipped) {
        setPrintStatus((result as { reason?: string } | undefined)?.reason || (isArabic ? 'لم يتم إرسال الفاتورة لأن الطابعة غير مكتملة الإعداد.' : 'Receipt was not sent because the printer is not fully configured.'))
        return
      }
      setPrintStatus(isArabic ? 'تم إرسال فاتورة الطلب للطابعة.' : 'Order receipt sent to printer.')
    } catch (error) {
      setPrintStatus(error instanceof Error ? error.message : (isArabic ? 'فشلت طباعة فاتورة الطلب.' : 'Order receipt print failed.'))
    }
  }, [createOrderPrintPayload, isArabic, settings.printers])

  const handlePrintClosingSummary = useCallback(async () => {
    if (!selectedClosing) return
    try {
      syncPrinterManagerSettings(settings.printers)
      const payload = createClosingReceiptPayload({
        title: isArabic ? 'ملخص التقفيل' : 'Closing Summary',
        dateLabel: `${new Date(selectedClosing.openedAt).toLocaleString(isArabic ? 'ar-EG' : 'en-US')} - ${new Date(selectedClosing.closedAt).toLocaleString(isArabic ? 'ar-EG' : 'en-US')}`,
        orders: closureOrders,
        expenses: closureExpenses,
        revenue: sessionSummary.collectedDrawerRevenue,
        expenseTotal: sessionSummary.expenses,
        net: Number((sessionSummary.collectedDrawerRevenue - sessionSummary.expenses).toFixed(2)),
        paymentBreakdown,
        paymentLabel: (method: string) => method,
        currency: selectedClosing.currency || CURRENCY_EN,
        isArabic,
      })
      await printerManager.printCashierReceipt(payload)
      setPrintStatus(isArabic ? 'تم الطباعة' : 'Printed')
    } catch (error) {
      setPrintStatus(error instanceof Error ? error.message : (isArabic ? 'فشلت الطباعة' : 'Print failed'))
    }
  }, [closureExpenses, closureOrders, isArabic, paymentBreakdown, selectedClosing, sessionSummary, settings.printers])

  useEffect(() => {
    let active = true
    const shiftId = daySession.shiftId
    const timer = window.setTimeout(() => {
      if (!active) return

      if (!shiftId) {
        setSessionOrders([])
        setSessionExpenses([])
        return
      }

      const loadSessionData = async () => {
        setLoadingSessionItems(true)
        try {
          const [ordersResponse, expensesResponse, previousClosings] = await Promise.all([
            fetch('/api/orders?limit=9999', { cache: 'no-store' }),
            fetch('/api/expenses', { cache: 'no-store' }),
            readAllClosings(),
          ])
          const ordersData = await ordersResponse.json().catch(() => ({}))
          const expensesData = await expensesResponse.json().catch(() => ({}))
          if (!active) return
          const { orderIds: settledOrderIds, expenseIds: settledExpenseIds } = getSettledClosingIds(previousClosings)
          const allOrders = Array.isArray(ordersData.orders) ? ordersData.orders : []
          const allExpenses = Array.isArray(expensesData.expenses) ? expensesData.expenses : []
          setSessionOrders(allOrders.filter((order: TrackedOrder) => {
            if (settledOrderIds.has(order.id)) return false
            if (order.shiftId === shiftId) return true
            return !order.shiftId && isItemInShiftWindow(order.createdAt, daySession, { includeSameDayBeforeStart: true })
          }))
          setSessionExpenses(allExpenses.filter((expense: SavedClosingExpense) => {
            if (settledExpenseIds.has(expense.id)) return false
            if (expense.shiftId === shiftId) return true
            return !expense.shiftId && isItemInShiftWindow(expense.date, daySession, { includeSameDayBeforeStart: true })
          }))
        } catch {
          if (active) {
            setSessionOrders([])
            setSessionExpenses([])
          }
        } finally {
          if (active) setLoadingSessionItems(false)
        }
      }

      void loadSessionData()
    }, 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [daySession])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      if (!active) return
      if (!selectedClosing || !selectedClosing.shiftId) {
        setClosingReport(null)
        setSelectedClosingOrders([])
        setSelectedClosingExpenses([])
        return
      }

      setClosingModalTab('details')
      setLoadingClosingDetails(true)

      fetch(`/api/closings/report?shiftId=${encodeURIComponent(selectedClosing.shiftId)}`, { cache: 'no-store' })
        .then((response) => response.json())
        .then((data) => {
          if (active && data.report) {
            setClosingReport(data.report)
          }
        })
        .catch(() => {
          if (active) setClosingReport(null)
        })
        .finally(() => {
          if (active) setLoadingClosingDetails(false)
        })

      if (selectedClosing.orders?.length) {
        setSelectedClosingOrders(selectedClosing.orders)
      } else {
        fetch('/api/orders?limit=9999', { cache: 'no-store' })
          .then((response) => response.json())
          .then((data) => {
            if (active) {
              const allOrders = Array.isArray(data.orders) ? data.orders : []
              setSelectedClosingOrders(allOrders.filter((order: TrackedOrder) => (
                order.shiftId === selectedClosing.shiftId ||
                (!order.shiftId && isItemWithinDateRange(order.createdAt, selectedClosing.openedAt, selectedClosing.closedAt, { includeSameDayBeforeStart: true }))
              )))
            }
          })
          .catch(() => {
            if (active) setSelectedClosingOrders([])
          })
      }

      if (selectedClosing.expenses?.length) {
        setSelectedClosingExpenses(selectedClosing.expenses)
      } else {
        fetch('/api/expenses', { cache: 'no-store' })
          .then((response) => response.json())
          .then((data) => {
            if (active) {
              const allExpenses = Array.isArray(data.expenses) ? data.expenses : []
              setSelectedClosingExpenses(allExpenses.filter((expense: SavedClosingExpense) => (
                expense.shiftId === selectedClosing.shiftId ||
                (!expense.shiftId && isItemWithinDateRange(expense.date, selectedClosing.openedAt, selectedClosing.closedAt, { includeSameDayBeforeStart: true }))
              )))
            }
          })
          .catch(() => {
            if (active) setSelectedClosingExpenses([])
          })
      }
    }, 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [selectedClosing])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">{isArabic ? 'التقفيلات' : 'Closings'}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{isArabic ? 'عرض التقفيلات السابقة بالبحث في كل وردية.' : 'Browse saved closings and inspect individual shift summaries.'}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 sm:w-[32rem]">
            <label className="space-y-1">
              <span className="text-sm font-medium">{isArabic ? 'من تاريخ' : 'From Date'}</span>
              <Input type="date" value={filterStart} onChange={(event) => setFilterStart(event.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">{isArabic ? 'إلى تاريخ' : 'To Date'}</span>
              <Input type="date" value={filterEnd} onChange={(event) => setFilterEnd(event.target.value)} />
            </label>
          </div>
          <div className="flex items-center gap-2">
            {daySession.isOpen ? (
              <Button className="gap-2 bg-red-600 hover:bg-red-700" onClick={async () => {
                if (!daySession.shiftId || closingBusy || loadingSessionItems) return
                setClosingBusy(true)
                try {
                  const closedAt = new Date().toISOString()
                  setDaySession({ ...daySession, isOpen: false, closedAt })
                  const record = await performShiftClosing(
                    { ...daySession, closedAt },
                    { orders: sessionOrders, expenses: sessionExpenses, currency: CURRENCY_EN }
                  )
                  await loadClosings()
                  setSelectedClosingId(record.id)
                  setShowClosingModal(true)
                } catch (err) {
                  console.error('Could not perform shift closing', err)
                } finally {
                  setClosingBusy(false)
                }
              }} disabled={closingBusy || loadingSessionItems}>
                {isArabic ? 'غلق الوردية' : 'Close Shift'}
              </Button>
            ) : null}
          </div>
        </div>
        {filteredClosings.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            {isArabic ? 'لا توجد تقفيلات مطابقة.' : 'No matching closings found.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm text-slate-700 dark:text-slate-200">
              <thead>
                <tr className="bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <th className="border-b border-slate-200 px-4 py-3">{isArabic ? 'الوردية' : 'Shift'}</th>
                  <th className="border-b border-slate-200 px-4 py-3">{isArabic ? 'الطلبات' : 'Orders'}</th>
                  <th className="border-b border-slate-200 px-4 py-3">{isArabic ? 'الملغية' : 'Cancelled'}</th>
                  <th className="border-b border-slate-200 px-4 py-3">{isArabic ? 'النوع' : 'Type'}</th>
                  <th className="border-b border-slate-200 px-4 py-3">{isArabic ? 'صافي الدرج' : 'Drawer Net'}</th>
                  <th className="border-b border-slate-200 px-4 py-3">{isArabic ? 'الملاحظات' : 'Notes'}</th>
                  <th className="border-b border-slate-200 px-4 py-3">{isArabic ? 'عرض' : 'View'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredClosings.map((closing) => (
                  <tr key={closing.id} className="border-b border-slate-200 dark:border-slate-800">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{new Date(closing.openedAt).toLocaleDateString(isArabic ? 'ar-EG' : 'en-US')}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{new Date(closing.openedAt).toLocaleTimeString(isArabic ? 'ar-EG' : 'en-US')}</div>
                    </td>
                    <td className="px-4 py-3">{closing.ordersCount}</td>
                    <td className="px-4 py-3">{getClosingCancelledCount(closing)}</td>
                    <td className="px-4 py-3">{closing.type === 'driver' ? (isArabic ? 'تقفيل السائقين' : 'Driver') : (isArabic ? 'الوردية' : 'Shift')}</td>
                    <td className="px-4 py-3">{(closing.drawerNet ?? 0).toFixed(2)} {closing.currency || 'EGP'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{new Date(closing.closedAt).toLocaleTimeString(isArabic ? 'ar-EG' : 'en-US')}</td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="outline" onClick={() => {
                        setSelectedClosingId(closing.id)
                        setClosingModalTab('details')
                        setShowClosingModal(true)
                      }}>
                        {isArabic ? 'عرض' : 'View'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showClosingModal && selectedClosing ? (
        <Dialog role="dialog" aria-modal="true" className="flex items-center justify-center overflow-hidden p-4">
          <div className="relative flex max-h-[92vh] min-h-0 w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="shrink-0 border-b border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold">{isArabic ? 'تفاصيل التقفيل' : 'Closing Details'}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {new Date(selectedClosing.openedAt).toLocaleString(isArabic ? 'ar-EG' : 'en-US')} → {new Date(selectedClosing.closedAt).toLocaleString(isArabic ? 'ar-EG' : 'en-US')}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={handlePrintClosingSummary}>
                    {isArabic ? 'طباعة الملخص' : 'Print Summary'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowClosingModal(false)}>{isArabic ? 'إغلاق' : 'Close'}</Button>
                </div>
              </div>
              {printStatus ? (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{printStatus}</p>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5">
              <div className="flex flex-wrap gap-2">
                <Button variant={closingModalTab === 'details' ? 'secondary' : 'outline'} onClick={() => setClosingModalTab('details')}>
                  {isArabic ? 'التفاصيل' : 'Details'}
                </Button>
                <Button variant={closingModalTab === 'orders' ? 'secondary' : 'outline'} onClick={() => setClosingModalTab('orders')}>
                  {isArabic ? 'عرض الطلبات' : 'View Orders'}
                </Button>
                <Button variant={closingModalTab === 'expenses' ? 'secondary' : 'outline'} onClick={() => setClosingModalTab('expenses')}>
                  {isArabic ? 'عرض المصروفات' : 'View Expenses'}
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <StatCard title={isArabic ? 'إجمالي طلبات الوردية' : 'Shift Orders'} value={selectedClosingOrdersCount} />
                <StatCard title={isArabic ? 'الطلبات المكتملة' : 'Completed Orders'} value={Math.max(0, selectedClosingOrdersCount - selectedClosingCancelledCount)} />
                <StatCard title={isArabic ? 'الطلبات الملغية' : 'Cancelled Orders'} value={selectedClosingCancelledCount} />
              </div>

              {loadingClosingDetails && <p>{isArabic ? 'جاري تحميل التفاصيل...' : 'Loading details...'}</p>}

              {closingModalTab === 'details' && closingReport && (
                <ClosingReportDetails report={closingReport} currency={selectedClosing.currency} isArabic={isArabic} />
              )}

              {closingModalTab === 'orders' && (
                closureOrders.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                    {isArabic ? 'لا توجد طلبات محفوظة لهذا التقفيل.' : 'No saved orders for this closing.'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {closureOrders.map((order) => (
                      <div key={order.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                          <div>
                            <p className="font-semibold">#{order.displayNumber || order.id}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{order.customer || order.id}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{isArabic ? 'طريقة الدفع:' : 'Payment Method:'} {String(order.payment?.method || 'cash')}</p>
                          </div>
                          <div className="space-y-2 text-right">
                            <p className="text-lg font-semibold">{Number(order.total || 0).toFixed(2)} {selectedClosing.currency || 'EGP'}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{isArabic ? 'الحالة:' : 'Status:'} {String(order.status || 'unknown')}</p>
                            <Button size="sm" variant="outline" className="gap-2" onClick={() => handlePrintClosingOrder(order)}>
                              <Printer className="h-4 w-4" />
                              {isArabic ? 'طباعة الفاتورة' : 'Print Receipt'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {closingModalTab === 'expenses' && (
                closureExpenses.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                    {isArabic ? 'لا توجد مصروفات محفوظة لهذا التقفيل.' : 'No saved expenses for this closing.'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {closureExpenses.map((expense) => (
                      <div key={expense.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                          <div>
                            <p className="font-semibold">{expense.name}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{expense.date ? new Date(expense.date).toLocaleString(isArabic ? 'ar-EG' : 'en-US') : ''}</p>
                            {expense.note ? <p className="text-sm text-slate-500 dark:text-slate-400">{expense.note}</p> : null}
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold">{Number(expense.amount || 0).toFixed(2)} {selectedClosing.currency || 'EGP'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </Dialog>
      ) : null}
    </div>
  )
}
