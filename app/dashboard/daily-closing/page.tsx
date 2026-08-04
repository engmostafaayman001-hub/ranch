'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Printer, TrendingUp, TrendingDown, Wallet, Smartphone, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN } from '@/lib/constants'
import { TrackedOrder } from '@/lib/order-tracking'
import { useAppStore } from '@/lib/app-store'
import { printerManager, syncPrinterManagerSettings } from '@/lib/printer'
import { summarizeClosingData } from '@/lib/financial-calculations'
import { createClosingReceiptPayload } from '@/lib/closing-print'
import { getShiftSessionDateRange, isItemInShiftWindow, isItemWithinDateRange, type ShiftSession } from '@/lib/pos-day-session'
import useShiftSession from '@/lib/use-shift-session'
import { getSettledClosingIds, readAllClosings } from '@/lib/closings'
import performShiftClosing from '@/lib/shift-closing'

type Expense = {
  id: string
  name: string
  amount: number
  date: string
  note: string
  shiftId?: string
}

function getDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatDuration(ms: number, isArabic: boolean) {
  if (!Number.isFinite(ms) || ms <= 0) return isArabic ? '0s' : '0s'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (isArabic) {
    return `${hours}س ${minutes}د ${seconds}ث`
  }
  return `${hours}h ${minutes}m ${seconds}s`
}
export default function DailyClosingPage() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const settings = useAppStore((state) => state.settings)
  const [orders, setOrders] = useState<TrackedOrder[]>([])
  const [allShiftOrders, setAllShiftOrders] = useState<TrackedOrder[]>([])
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [printStatus, setPrintStatus] = useState('')
  const [rangeStart, setRangeStart] = useState(() => getDateInputValue(new Date()))
  const [rangeEnd, setRangeEnd] = useState(() => getDateInputValue(new Date()))
  const [daySession, setDaySession] = useShiftSession()
  const [closingBusy, setClosingBusy] = useState(false)
  const [showPaymentsModal, setShowPaymentsModal] = useState<'app' | 'restaurant' | null>(null)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [showCancelledOrdersModal, setShowCancelledOrdersModal] = useState(false)

  const sessionRange = useMemo(() => getShiftSessionDateRange(daySession), [daySession])

  const getDateRangeFromInputs = useCallback((startValue: string, endValue: string) => {
    try {
      const startDate = new Date(`${startValue}T00:00:00`)
      const endDate = new Date(`${endValue}T23:59:59.999`)
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return sessionRange
      if (startDate.getTime() <= endDate.getTime()) {
        return { start: startDate.toISOString(), end: endDate.toISOString() }
      }
      return { start: endDate.toISOString(), end: startDate.toISOString() }
    } catch {
      return sessionRange
    }
  }, [sessionRange])

  const effectiveRange = useMemo(() => getDateRangeFromInputs(rangeStart, rangeEnd), [getDateRangeFromInputs, rangeStart, rangeEnd])

  useEffect(() => {
    let active = true

    const loadData = async () => {
      try {
        const [expensesResponse, ordersResponse] = await Promise.all([
          fetch('/api/expenses', { cache: 'no-store' }),
          fetch('/api/orders?limit=9999', { cache: 'no-store' }),
        ])

        const expensesData = await expensesResponse.json().catch(() => ({}))
        const ordersData = await ordersResponse.json().catch(() => ({}))

        if (!active) return

        const allExpenses = Array.isArray(expensesData.expenses) ? expensesData.expenses : []
        const allOrders = Array.isArray(ordersData.orders) ? ordersData.orders : []
        const previousClosings = await readAllClosings()
        const { orderIds: settledOrderIds, expenseIds: settledExpenseIds } = getSettledClosingIds(previousClosings)

        setExpenses(allExpenses.filter((expense: Expense) => {
          if (settledExpenseIds.has(expense.id)) return false
          if (!daySession.shiftId) {
            return !expense.shiftId || isItemInShiftWindow(expense.date, daySession, { includeSameDayBeforeStart: true })
          }
          // when a shiftId exists, include only expenses explicitly for the shift
          // or legacy expenses that fall within the shift window
          return expense.shiftId === daySession.shiftId || (!expense.shiftId && isItemInShiftWindow(expense.date, daySession, { includeSameDayBeforeStart: true }))
        }))
        
        const shiftOrdersUnfiltered = allOrders.filter((order: TrackedOrder) => {
          if (settledOrderIds.has(order.id)) return false
          if (!daySession.shiftId) {
            return !order.shiftId || isItemInShiftWindow(order.createdAt, daySession, { includeSameDayBeforeStart: true })
          }
          return order.shiftId === daySession.shiftId || (!order.shiftId && isItemInShiftWindow(order.createdAt, daySession, { includeSameDayBeforeStart: true }))
        });
        setAllShiftOrders(shiftOrdersUnfiltered);

        setOrders(shiftOrdersUnfiltered.filter((order: TrackedOrder) => order.status !== 'cancelled'))
      } catch {
        if (active) {
          setExpenses([])
          setOrders([])
          setAllShiftOrders([])
        }
      }
    }

    void loadData()

    return () => {
      active = false
    }
  }, [daySession])

  const sessionOrders = useMemo(() => {
    return orders.filter((order) => {
      if (order.status === 'cancelled') return false
      if (!daySession.shiftId) return isItemWithinDateRange(order.createdAt, effectiveRange.start, effectiveRange.end, { includeSameDayBeforeStart: true })
      if (order.shiftId === daySession.shiftId) return true
      if (!order.shiftId) return isItemWithinDateRange(order.createdAt, effectiveRange.start, effectiveRange.end, { includeSameDayBeforeStart: true })
      return order.createdAt && isItemWithinDateRange(order.createdAt, effectiveRange.start, effectiveRange.end, { includeSameDayBeforeStart: true })
    })
  }, [daySession.shiftId, orders, effectiveRange])

  const sessionExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      if (!daySession.shiftId) return isItemWithinDateRange(exp.date, effectiveRange.start, effectiveRange.end, { includeSameDayBeforeStart: true })
      if (exp.shiftId === daySession.shiftId) return true
      if (!exp.shiftId) return isItemWithinDateRange(exp.date, effectiveRange.start, effectiveRange.end, { includeSameDayBeforeStart: true })
      return isItemWithinDateRange(exp.date, effectiveRange.start, effectiveRange.end, { includeSameDayBeforeStart: true })
    })
  }, [daySession.shiftId, expenses, effectiveRange])

  const handleOpenShift = async () => {
    const nextSession: ShiftSession = {
      isOpen: true,
      openedAt: new Date().toISOString(),
      closedAt: null,
      shiftId: `SHIFT-${Date.now()}`,
      confirmed: true,
    }
    try {
      const response = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId: nextSession.shiftId, openedAt: nextSession.openedAt }),
      })
      const data = await response.json().catch(() => ({}))
      const shift = data.shift
      const sharedSession = shift?.id && shift?.openedAt
        ? {
            isOpen: true,
            openedAt: String(shift.openedAt),
            closedAt: null,
            shiftId: String(shift.id),
            confirmed: true,
          }
        : nextSession
      setDaySession(sharedSession)
      setPrintStatus(isArabic ? 'تم فتح وردية جديدة.' : 'A new shift has been opened.')
    } catch {
      setDaySession(nextSession)
      setPrintStatus(isArabic ? 'تم فتح وردية جديدة محليا، وسيتم مزامنتها عند توفر الاتصال.' : 'A new shift opened locally and will sync when available.')
    }
  }

  const financialSummary = useMemo(() => summarizeClosingData(sessionOrders, sessionExpenses), [sessionOrders, sessionExpenses])
  const cancelledOrders = useMemo(() => allShiftOrders.filter((order) => order.status === 'cancelled'), [allShiftOrders])
  const cancelledOrdersCount = cancelledOrders.length
  const totalCancelledOrdersAmount = useMemo(
    () => cancelledOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
    [cancelledOrders]
  )
  const totalShiftOrdersCount = allShiftOrders.length

  const collectedDrawerRevenue = financialSummary.collectedDrawerRevenue
  const sessionRevenueWithoutDelivery = financialSummary.salesExcludingDelivery
  const drawerNetAfterExpenses = Number((financialSummary.collectedDrawerRevenue - financialSummary.expenses).toFixed(2))
  const drawerPaymentBreakdown = useMemo(() => {
    return sessionOrders.reduce<Record<string, number>>((totals, order) => {
      if (!order.status || order.status === 'cancelled') return totals
      const method = String(order.payment?.method || 'cash')
      if (order.source === 'restaurant_pos' || String(order.payment?.status || '').toLowerCase() === 'paid') {
        totals[method] = (totals[method] || 0) + Number(order.total || 0)
      }
      return totals
    }, {})
  }, [sessionOrders])

  const totalRevenue = financialSummary.grossSales
  const totalExpenses = financialSummary.expenses
  const totalRemainingToCollect = financialSummary.remainingToCollect

  const totalOtherPayments = useMemo(() => {
    return sessionOrders.reduce((sum, order) => {
      const method = String(order.payment?.method || '').toLowerCase()
      return ['vodafone_cash', 'instapay'].includes(method) ? sum + Number(order.total || 0) : sum
    }, 0)
  }, [sessionOrders])

  const totalOtherPaymentsApp = useMemo(() => {
    return sessionOrders.reduce((sum, order) => {
      if (order.source === 'restaurant_pos') return sum
      const method = String(order.payment?.method || '').toLowerCase()
      return ['vodafone_cash', 'instapay'].includes(method) ? sum + Number(order.total || 0) : sum
    }, 0)
  }, [sessionOrders])

  const shiftRestaurantSales = useMemo(() => {
    return sessionOrders.reduce((sum, order) => {
      if (order.source !== 'restaurant_pos') return sum
      return sum + Number(order.total || 0)
    }, 0)
  }, [sessionOrders])

  const shiftAppSales = useMemo(() => {
    return sessionOrders.reduce((sum, order) => {
      if (order.source === 'restaurant_pos') return sum
      return sum + Number(order.total || 0)
    }, 0)
  }, [sessionOrders])

  const customStatusCounts = useMemo(() => {
    const counts = {
      delivered: 0,
      on_the_way: 0,
      cancelled: 0,
      active: 0,
    }
    const activeStatuses = new Set(['placed', 'confirmed', 'preparing', 'ready_for_delivery'])

    for (const order of allShiftOrders) {
      if (order.status === 'cancelled') {
        counts.cancelled += 1
      } else if (order.status === 'out_for_delivery') {
        counts.on_the_way += 1
      } else if (order.status === 'delivered' || order.status === 'received') {
        counts.delivered += 1
      } else if (activeStatuses.has(order.status)) {
        counts.active += 1
      }
    }
    return counts
  }, [allShiftOrders])

  const statusLabels: Record<string, string> = useMemo(() => isArabic
    ? {
        delivered: 'تم تسليمه',
        on_the_way: 'في الطريق',
        cancelled: 'تم الغاءه',
        active: 'قيد العمل',
      }
    : {
        delivered: 'Delivered',
        on_the_way: 'On the Way',
        cancelled: 'Cancelled',
        active: 'In Progress',
      }, [isArabic])

  const summaryCards = useMemo(() => [
    {
      key: 'gross-sales',
      label: isArabic ? 'إجمالي المبيعات' : 'Gross Sales',
      value: financialSummary.grossSales,
      accent: 'border-blue-200 bg-blue-50/70 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200',
      details: [
        { label: isArabic ? 'مبيعات المطعم' : 'Restaurant sales', value: shiftRestaurantSales },
        { label: isArabic ? 'مبيعات التطبيق' : 'App sales', value: shiftAppSales },
        { label: isArabic ? 'رسوم التوصيل' : 'Delivery fees', value: financialSummary.deliveryRevenue },
        { label: isArabic ? 'الخصومات' : 'Discounts', value: financialSummary.totalDiscounts },
      ],
    },
    {
      key: 'net-sales',
      label: isArabic ? 'صافي المبيعات' : 'Net Sales',
      value: financialSummary.netSales,
      accent: 'border-green-200 bg-green-50/70 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300',
      details: [
        { label: isArabic ? 'المحصل في الدرج' : 'Collected drawer', value: financialSummary.collectedDrawerRevenue },
        { label: isArabic ? 'المتبقي للتحصيل' : 'Remaining to collect', value: financialSummary.remainingToCollect },
        { label: isArabic ? 'المصروفات' : 'Expenses', value: financialSummary.expenses },
      ],
    },
    {
      key: 'discounts',
      label: isArabic ? 'الخصومات' : 'Discounts',
      value: financialSummary.totalDiscounts,
      accent: 'border-amber-200 bg-amber-50/70 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
      details: [
        { label: isArabic ? 'خصومات التطبيق' : 'App discounts', value: financialSummary.appDiscounts },
        { label: isArabic ? 'خصومات المطعم' : 'Restaurant discounts', value: financialSummary.restaurantDiscounts },
      ],
    },
    {
      key: 'expenses',
      label: isArabic ? 'المصروفات' : 'Expenses',
      value: financialSummary.expenses,
      accent: 'border-red-200 bg-red-50/70 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
      details: [
        { label: isArabic ? 'عدد البنود' : 'Expense items', value: sessionExpenses.length },
        { label: isArabic ? 'صافي الدرج بعد المصروفات' : 'Drawer net after expenses', value: drawerNetAfterExpenses },
      ],
    },
  ], [drawerNetAfterExpenses, financialSummary.appDiscounts, financialSummary.collectedDrawerRevenue, financialSummary.deliveryRevenue, financialSummary.expenses, financialSummary.grossSales, financialSummary.netSales, financialSummary.remainingToCollect, financialSummary.restaurantDiscounts, financialSummary.totalDiscounts, isArabic, sessionExpenses.length, shiftAppSales, shiftRestaurantSales])

  const statusCards = useMemo(() => [
    {
      key: 'active',
      label: statusLabels.active,
      count: customStatusCounts.active,
      accent: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200',
    },
    {
      key: 'on_the_way',
      label: statusLabels.on_the_way,
      count: customStatusCounts.on_the_way,
      accent: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
    },
    {
      key: 'delivered',
      label: statusLabels.delivered,
      count: customStatusCounts.delivered,
      accent: 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200',
    },
    {
      key: 'cancelled',
      label: statusLabels.cancelled,
      count: customStatusCounts.cancelled,
      accent: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
    },
  ], [customStatusCounts, statusLabels])

  const otherPaymentsOrdersApp = useMemo(() => {
    return sessionOrders.filter((order) => {
      if (order.source === 'restaurant_pos') return false
      const method = String(order.payment?.method || '').toLowerCase()
      return ['vodafone_cash', 'instapay'].includes(method)
    })
  }, [sessionOrders])

  const otherPaymentsOrdersRestaurant = useMemo(() => {
    return sessionOrders.filter((order) => {
      if (order.source !== 'restaurant_pos') return false
      const method = String(order.payment?.method || '').toLowerCase()
      return ['vodafone_cash', 'instapay'].includes(method)
    })
  }, [sessionOrders])

  const handlePrint = async () => {
    try {
      syncPrinterManagerSettings(settings.printers)
      const payload = createClosingReceiptPayload({
        title: isArabic ? 'تقفيل الوردية' : 'Shift Closing',
        dateLabel: `${new Date(daySession.openedAt).toLocaleString()} - ${daySession.isOpen ? new Date().toLocaleString() : new Date(daySession.closedAt || daySession.openedAt).toLocaleString()}`,
        orders: allShiftOrders,
        expenses: sessionExpenses,
        revenue: collectedDrawerRevenue,
        expenseTotal: totalExpenses,
        net: drawerNetAfterExpenses,
        paymentBreakdown: drawerPaymentBreakdown,
        paymentLabel: (method: string) => method,
        currency,
        isArabic,
      })
      await printerManager.printCashierReceipt(payload)
      setPrintStatus(isArabic ? 'تم الطباعة' : 'Printed')
    } catch (error) {
      setPrintStatus(error instanceof Error ? error.message : (isArabic ? 'فشلت الطباعة' : 'Print failed'))
    }
  }

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold">{isArabic ? 'تقفيل الوردية' : 'Shift Closing'}</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {isArabic ? 'ملخص المبيعات والمصروفات لفترة الوردية الحالية.' : 'Summary of sales and expenses for the current shift.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="text-sm">
            <div className="font-semibold">{isArabic ? 'الوردية' : 'Shift'}</div>
            <div className="text-xs text-slate-500">
              {isArabic ? 'بدأت في' : 'Started'}: {new Date(daySession.openedAt).toLocaleString()}
            </div>
            <div className="text-xs text-slate-500">
              {isArabic ? 'الحالة' : 'Status'}: {daySession.isOpen ? (isArabic ? 'مفتوحة' : 'Open') : (isArabic ? 'منتهية' : 'Closed')}
            </div>
            <div className="text-xs text-slate-500">
              {isArabic ? 'الطلبات' : 'Orders'}: {totalShiftOrdersCount}
            </div>
            <div className="text-xs text-slate-500">
              {isArabic ? 'الطلبات الملغية' : 'Cancelled'}: {cancelledOrdersCount}
            </div>
              <div className="text-xs text-slate-500">
                {isArabic ? 'مدة الوردية' : 'Duration'}: {formatDuration(new Date((daySession.isOpen ? new Date().toISOString() : (daySession.closedAt || daySession.openedAt))).getTime() - new Date(daySession.openedAt).getTime(), isArabic)}
              </div>
          </div>
          <div className="ms-2 flex gap-2">
            <Button className="gap-2 bg-slate-600 hover:bg-slate-700" onClick={() => setShowSummaryModal(true)}>
              <Printer className="h-4 w-4" />
              {isArabic ? 'عرض الملخص' : 'View Summary'}
            </Button>
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={handlePrint}>
              <Printer className="h-4 w-4" />
              {isArabic ? 'طباعة الملخص' : 'Print Summary'}
            </Button>
            {daySession.isOpen ? (
              <Button className="gap-2 bg-red-600 hover:bg-red-700" onClick={async () => {
                if (!daySession.shiftId || closingBusy) return
                setClosingBusy(true)
                try {
                  const closedAt = new Date().toISOString()
                  // close locally first so UI updates
                  setDaySession({ ...daySession, isOpen: false, closedAt })
                  // perform closing: collects orders/expenses and saves closing record
                  await performShiftClosing({ ...daySession, closedAt }, { orders: allShiftOrders, expenses: sessionExpenses, currency })
                  setOrders([])
                  setAllShiftOrders([])
                  setExpenses([])
                  setPrintStatus(isArabic ? 'تم إغلاق الورديه وحفظ التقفيل.' : 'Shift closed and closing saved.')
                } catch (err) {
                  console.error('performShiftClosing failed', err)
                  setPrintStatus(isArabic ? 'تعذر إتمام غلق الوردية.' : 'Could not complete shift closing.')
                } finally {
                  setClosingBusy(false)
                }
              }} disabled={closingBusy}>
                {isArabic ? 'غلق الوردية' : 'Close Shift'}
              </Button>
            ) : (
              <Button className="gap-2 bg-green-600 hover:bg-green-700" onClick={handleOpenShift}>
                {isArabic ? 'فتح وردية جديدة' : 'Open Shift'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 rounded-md border p-4 dark:border-slate-800 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm font-medium">{isArabic ? 'من تاريخ' : 'From Date'}</span>
          <Input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">{isArabic ? 'إلى تاريخ' : 'To Date'}</span>
          <Input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
        </label>
      </div>

      {printStatus && (
        <div className={`rounded-md p-3 text-sm ${printStatus.includes('فشل') || printStatus.includes('failed') ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'}`}>
          {printStatus}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.key} className={card.accent}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-3">
                <p className="text-2xl font-bold">{card.value.toFixed(2)}</p>
                {card.key === 'gross-sales' ? <TrendingUp className="h-5 w-5" /> : card.key === 'net-sales' ? <Wallet className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              </div>
              <p className="mt-1 text-xs text-slate-500">{currency}</p>
              <div className="mt-3 space-y-2 border-t border-slate-200/70 pt-3 dark:border-slate-700">
                {card.details.map((detail) => (
                  <div key={`${card.key}-${detail.label}`} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-600 dark:text-slate-400">{detail.label}</span>
                    <span className="font-semibold">{Number(detail.value || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {isArabic ? 'خصومات فواتير التطبيق' : 'App Bills Discounts'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{financialSummary.appDiscounts.toFixed(2)}</p>
              <TrendingDown className="h-5 w-5 text-amber-600" />
            </div>
            <p className="mt-1 text-xs text-slate-500">{currency}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {isArabic ? 'خصومات فواتير المطعم' : 'Restaurant Bills Discounts'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{financialSummary.restaurantDiscounts.toFixed(2)}</p>
              <TrendingDown className="h-5 w-5 text-amber-600" />
            </div>
            <p className="mt-1 text-xs text-slate-500">{currency}</p>
          </CardContent>
        </Card>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {isArabic ? 'طلبات التطبيق بالوردية' : 'App Orders (Shift)'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{sessionOrders.filter((o) => o.source !== 'restaurant_pos').length}</p>
              <Smartphone className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-xs text-slate-500 mt-1">{isArabic ? 'طلبات' : 'orders'}</p>
            <p className="text-xs text-slate-500 mt-1">
              {isArabic ? 'الإجمالي' : 'Total'}: {shiftAppSales.toFixed(2)} {currency}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {isArabic ? 'طلبات المطعم بالوردية' : 'Restaurant Orders (Shift)'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{sessionOrders.filter((o) => o.source === 'restaurant_pos').length}</p>
              <Store className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-xs text-slate-500 mt-1">{isArabic ? 'طلبات' : 'orders'}</p>
            <p className="text-xs text-slate-500 mt-1">
              {isArabic ? 'الإجمالي' : 'Total'}: {shiftRestaurantSales.toFixed(2)} {currency}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {isArabic ? 'المبيعات بدون توصيل' : 'Sales excl. delivery'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{sessionRevenueWithoutDelivery.toFixed(2)}</p>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-xs text-slate-500 mt-1">{currency}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {isArabic ? 'المصروفات' : 'Expenses'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{totalExpenses.toFixed(2)}</p>
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <p className="text-xs text-slate-500 mt-1">{currency}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {isArabic ? 'المتبقي للتحصيل' : 'Remaining to Collect'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{totalRemainingToCollect.toFixed(2)}</p>
              <Wallet className="h-5 w-5 text-yellow-600" />
            </div>
            <p className="text-xs text-slate-500 mt-1">{currency}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mt-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {isArabic ? 'مبيعات المطعم بالوردية' : 'Restaurant Shift Sales'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-green-700">{shiftRestaurantSales.toFixed(2)}</p>
            </div>
            <p className="text-xs text-slate-500 mt-1">{currency}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {isArabic ? 'مبيعات التطبيق بالوردية' : 'App Shift Sales'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-blue-700">{shiftAppSales.toFixed(2)}</p>
            </div>
            <p className="text-xs text-slate-500 mt-1">{currency}</p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div onClick={() => setShowPaymentsModal('restaurant')} className="cursor-pointer">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {isArabic ? 'طرق دفع أخرى داخل المطعم' : 'Other Payments Inside Restaurant'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold">{totalOtherPayments.toFixed(2)}</p>
                <Smartphone className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-xs text-slate-500 mt-1">{currency}</p>
            </CardContent>
          </Card>
        </div>

        <div onClick={() => setShowPaymentsModal('app')} className="cursor-pointer">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {isArabic ? 'طرق دفع أخرى داخل التطبيق' : 'Other Payments Inside App'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold">{totalOtherPaymentsApp.toFixed(2)}</p>
                <Smartphone className="h-5 w-5 text-purple-600" />
              </div>
              <p className="text-xs text-slate-500 mt-1">{currency}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {isArabic ? 'صافي الدرج' : 'Drawer Net'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className={`text-2xl font-bold ${drawerNetAfterExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {drawerNetAfterExpenses.toFixed(2)}
              </p>
            </div>
            <p className="text-xs text-slate-500 mt-1">{currency}</p>
          </CardContent>
        </Card>
      </div>

     <Card className="mt-4">
        <CardHeader>
          <CardTitle>{isArabic ? 'حالة الطلبات في الوردية' : 'Shift Order Status'}</CardTitle>
        </CardHeader>
        <CardContent>
          {allShiftOrders.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">{isArabic ? 'لا توجد طلبات في الوردية.' : 'No orders in this shift.'}</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {statusCards.map((card) => {
                const totalOrdersForPercent = allShiftOrders.length
                const percent = totalOrdersForPercent ? Math.round((card.count / totalOrdersForPercent) * 100) : 0
                const isClickable = card.key === 'cancelled'
                return (
                  <div
                    key={card.key}
                    className={`rounded-2xl border p-4 shadow-sm ${card.accent} ${isClickable ? 'cursor-pointer hover:ring-1 hover:ring-slate-400' : ''}`}
                    role={isClickable ? 'button' : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    onClick={isClickable ? () => setShowCancelledOrdersModal(true) : undefined}
                    onKeyDown={isClickable ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setShowCancelledOrdersModal(true)
                      }
                    } : undefined}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{card.label}</p>
                        <p className="mt-2 text-3xl font-bold">{card.count}</p>
                      </div>
                      <div className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold dark:bg-slate-950/40">
                        {percent}%
                      </div>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white/70 dark:bg-slate-950/40">
                      <div className="h-2 rounded-full bg-current" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Detailed Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Sales Summary */}
        <Card>
          <CardHeader>
            <CardTitle>{isArabic ? 'ملخص المبيعات' : 'Sales Summary'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>{isArabic ? 'عدد الطلبات' : 'Orders'}</span>
              <span className="font-semibold">{totalShiftOrdersCount}</span>
            </div>
            <div className="flex justify-between">
              <span>{isArabic ? 'الطلبات الملغية' : 'Cancelled Orders'}</span>
              <span className="font-semibold text-red-600">{cancelledOrdersCount}</span>
            </div>
            <div className="flex justify-between">
              <span>{isArabic ? 'إجمالي المبيعات' : 'Total'}</span>
              <span className="font-semibold">{financialSummary.grossSales.toFixed(2)} {currency}</span>
            </div>
            <div className="border-t pt-3 dark:border-slate-800">
              <div className="flex justify-between font-semibold text-green-600">
                <span>{isArabic ? 'متوسط الطلب' : 'Avg Order'}</span>
                <span>{sessionOrders.length > 0 ? (totalRevenue / sessionOrders.length).toFixed(2) : '0'} {currency}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expenses Summary */}
        <Card>
          <CardHeader>
            <CardTitle>{isArabic ? 'ملخص المصروفات' : 'Expenses Summary'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>{isArabic ? 'عدد البنود' : 'Items'}</span>
              <span className="font-semibold">{sessionExpenses.length}</span>
            </div>
            <div className="flex justify-between">
              <span>{isArabic ? 'إجمالي المصروفات' : 'Total Expenses'}</span>
              <span className="font-semibold">{financialSummary.expenses.toFixed(2)} {currency}</span>
            </div>
            <div className="flex justify-between">
              <span>{isArabic ? 'رسوم التوصيل' : 'Delivery Fees'}</span>
              <span className="font-semibold">{financialSummary.deliveryRevenue.toFixed(2)} {currency}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Summary */}
      <Card className="border-2 border-slate-300 dark:border-slate-700">
        <CardHeader>
          <CardTitle>{isArabic ? 'الملخص النهائي' : 'Final Summary'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">{isArabic ? 'الطلبات الملغية' : 'Cancelled Orders'}</p>
              <p className="text-2xl font-bold text-red-600">{cancelledOrdersCount}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">{isArabic ? 'المبيعات' : 'Sales'}</p>
              <p className="text-2xl font-bold text-green-600">{financialSummary.grossSales.toFixed(2)} {currency}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">{isArabic ? 'إجمالي التكاليف' : 'Total Costs'}</p>
              <p className="text-2xl font-bold text-red-600">{financialSummary.expenses.toFixed(2)} {currency}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">{isArabic ? 'الصافي النهائي' : 'Final Net'}</p>
              <p className={`text-2xl font-bold ${drawerNetAfterExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {drawerNetAfterExpenses.toFixed(2)} {currency}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white dark:bg-slate-950">
              <div>
                <CardTitle>{isArabic ? 'ملخص الوردية' : 'Shift Summary'}</CardTitle>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {isArabic ? 'راجع أرقام الوردية واطبع الملخص فقط.' : 'Review the shift figures and print the summary only.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={handlePrint}>
                  <Printer className="h-4 w-4" />
                  {isArabic ? 'طباعة الملخص' : 'Print Summary'}
                </Button>
                <button
                  onClick={() => setShowSummaryModal(false)}
                  className="text-2xl font-bold text-slate-500 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-sm text-slate-500 dark:text-slate-400">{isArabic ? 'إجمالي الطلبات' : 'Orders'}</p>
                  <p className="mt-2 text-3xl font-bold">{totalShiftOrdersCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-sm text-slate-500 dark:text-slate-400">{isArabic ? 'الطلبات الملغية' : 'Cancelled Orders'}</p>
                  <p className="mt-2 text-3xl font-bold text-red-600">{cancelledOrdersCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-sm text-slate-500 dark:text-slate-400">{isArabic ? 'إجمالي المبيعات' : 'Gross Sales'}</p>
                  <p className="mt-2 text-3xl font-bold">{financialSummary.grossSales.toFixed(2)}</p>
                  <p className="text-xs text-slate-500 mt-1">{currency}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-sm text-slate-500 dark:text-slate-400">{isArabic ? 'مبيعات التطبيق' : 'App Sales'}</p>
                  <p className="mt-2 text-3xl font-bold">{shiftAppSales.toFixed(2)}</p>
                  <p className="text-xs text-slate-500 mt-1">{currency}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-sm text-slate-500 dark:text-slate-400">{isArabic ? 'مبيعات المطعم' : 'Restaurant Sales'}</p>
                  <p className="mt-2 text-3xl font-bold">{shiftRestaurantSales.toFixed(2)}</p>
                  <p className="text-xs text-slate-500 mt-1">{currency}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-sm text-slate-500 dark:text-slate-400">{isArabic ? 'إيرادات التوصيل' : 'Delivery Revenue'}</p>
                  <p className="mt-2 text-3xl font-bold">{financialSummary.deliveryRevenue.toFixed(2)}</p>
                  <p className="text-xs text-slate-500 mt-1">{currency}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-sm text-slate-500 dark:text-slate-400">{isArabic ? 'إجمالي الخصومات' : 'Total Discounts'}</p>
                  <p className="mt-2 text-3xl font-bold">{financialSummary.totalDiscounts.toFixed(2)}</p>
                  <p className="text-xs text-slate-500 mt-1">{currency}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-sm text-slate-500 dark:text-slate-400">{isArabic ? 'صافي الدرج' : 'Drawer Net'}</p>
                  <p className="mt-2 text-3xl font-bold">{drawerNetAfterExpenses.toFixed(2)}</p>
                  <p className="text-xs text-slate-500 mt-1">{currency}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showCancelledOrdersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-950">
              <div>
                <CardTitle>{isArabic ? 'الطلبات الملغية' : 'Cancelled Orders'}</CardTitle>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {isArabic ? 'عرض الطلبات الملغية في الوردية الحالية.' : 'Review cancelled orders in the current shift.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {isArabic ? 'الإجمالي' : 'Total'}: {totalCancelledOrdersAmount.toFixed(2)} {currency}
                </div>
                <Button variant="outline" onClick={() => setShowCancelledOrdersModal(false)}>
                  {isArabic ? 'إغلاق' : 'Close'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {cancelledOrders.length === 0 ? (
                <p className="py-8 text-center text-slate-500 dark:text-slate-400">
                  {isArabic ? 'لا توجد طلبات ملغية في الوردية الحالية.' : 'There are no cancelled orders in the current shift.'}
                </p>
              ) : (
                cancelledOrders.map((order) => (
                  <div key={order.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                      <div>
                        <p className="font-semibold">#{order.displayNumber || order.id}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{order.customer || order.id}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{new Date(order.createdAt).toLocaleString()}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {isArabic ? 'طريقة الدفع:' : 'Payment Method:'} {String(order.payment?.method || 'cash')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-red-600">{Number(order.total || 0).toFixed(2)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{currency}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{isArabic ? 'السبب:' : 'Status:'} {order.status}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payments Modal */}
      {showPaymentsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white dark:bg-slate-950">
              <CardTitle>
                {showPaymentsModal === 'app'
                  ? (isArabic ? 'طرق دفع أخرى داخل التطبيق' : 'Other Payments Inside App')
                  : (isArabic ? 'طرق دفع أخرى داخل المطعم' : 'Other Payments Inside Restaurant')}
              </CardTitle>
              <button
                type="button"
                onClick={() => setShowPaymentsModal(null)}
                className="text-2xl font-bold text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              {(showPaymentsModal === 'app' ? otherPaymentsOrdersApp : otherPaymentsOrdersRestaurant).length === 0 ? (
                <p className="text-center text-slate-500 py-8">
                  {isArabic ? 'لا توجد طلبات' : 'No orders'}
                </p>
              ) : (
                (showPaymentsModal === 'app' ? otherPaymentsOrdersApp : otherPaymentsOrdersRestaurant).map((order) => (
                  <div key={order.id} className="border rounded-lg p-4 dark:border-slate-700">
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-lg">#{order.displayNumber || order.id}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {order.customer} {order.phone ? `- ${order.phone}` : ''}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                            {isArabic ? 'طريقة الدفع: ' : 'Payment Method: '}
                            <span className="font-semibold">
                              {String(order.payment?.method || '').toUpperCase()}
                            </span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{Number(order.total || 0).toFixed(2)}</p>
                          <p className="text-xs text-slate-500">{currency}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          className="gap-2 bg-blue-600 hover:bg-blue-700 text-sm flex-1"
                          onClick={async () => {
                            try {
                              syncPrinterManagerSettings(settings.printers)
                              const payload = createClosingReceiptPayload({
                                title: isArabic ? 'فاتورة طلب' : 'Order Receipt',
                                dateLabel: new Date(order.createdAt).toLocaleString(),
                                orders: [order],
                                expenses: [],
                                revenue: Number(order.total || 0),
                                expenseTotal: 0,
                                net: Number(order.total || 0),
                                paymentBreakdown: {},
                                paymentLabel: (method: string) => method,
                                currency,
                                isArabic,
                              })
                              await printerManager.printCashierReceipt(payload)
                              setPrintStatus(isArabic ? 'تم الطباعة' : 'Printed')
                            } catch (error) {
                              setPrintStatus(error instanceof Error ? error.message : (isArabic ? 'فشلت الطباعة' : 'Print failed'))
                            }
                          }}
                        >
                          <Printer className="h-4 w-4" />
                          {isArabic ? 'طباعة' : 'Print'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
