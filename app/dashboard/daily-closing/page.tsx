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
import { createClosingReceiptPayload } from '@/lib/closing-print'
import { getShiftSessionDateRange, isItemInShiftWindow, isItemWithinDateRange, type ShiftSession } from '@/lib/pos-day-session'
import useShiftSession from '@/lib/use-shift-session'
import { readClosings, type ClosingRecord } from '@/lib/closings'
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

function isCollectedDrawerOrder(order: TrackedOrder) {
  return String(order.payment?.method || '').toLowerCase() === 'cash' && String(order.payment?.status || '').toLowerCase() === 'paid'
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
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [printStatus, setPrintStatus] = useState('')
  const [rangeStart, setRangeStart] = useState(() => getDateInputValue(new Date()))
  const [rangeEnd, setRangeEnd] = useState(() => getDateInputValue(new Date()))
  const [daySession, setDaySession] = useShiftSession()
  const [closingBusy, setClosingBusy] = useState(false)
  const [showPaymentsModal, setShowPaymentsModal] = useState<'app' | 'restaurant' | null>(null)

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
          fetch('/api/pos/orders?limit=9999', { cache: 'no-store' }),
        ])

        const expensesData = await expensesResponse.json().catch(() => ({}))
        const ordersData = await ordersResponse.json().catch(() => ({}))

        if (!active) return

        const allExpenses = Array.isArray(expensesData.expenses) ? expensesData.expenses : []
        const allOrders = Array.isArray(ordersData.orders) ? ordersData.orders : []
        const previousClosings = readClosings()
        const settledOrderIds = new Set(previousClosings.flatMap((closing) => closing.orders?.map((order) => order.id) || []))
        const settledExpenseIds = new Set(previousClosings.flatMap((closing) => closing.expenses?.map((expense) => expense.id) || []))

        setExpenses(allExpenses.filter((expense: Expense) => {
          if (settledExpenseIds.has(expense.id)) return false
          if (!daySession.shiftId) {
            return !expense.shiftId || isItemInShiftWindow(expense.date, daySession, { includeSameDayBeforeStart: true })
          }
          // when a shiftId exists, include only expenses explicitly for the shift
          // or legacy expenses that fall within the shift window
          return expense.shiftId === daySession.shiftId || (!expense.shiftId && isItemInShiftWindow(expense.date, daySession, { includeSameDayBeforeStart: true }))
        }))

        setOrders(allOrders.filter((order: TrackedOrder) => {
          if (settledOrderIds.has(order.id) || order.status === 'cancelled') return false
          if (!daySession.shiftId) {
            return !order.shiftId || isItemInShiftWindow(order.createdAt, daySession, { includeSameDayBeforeStart: true })
          }
          // when a shiftId exists, include only orders explicitly for the shift
          // or legacy orders that fall within the shift window
          return order.shiftId === daySession.shiftId || (!order.shiftId && isItemInShiftWindow(order.createdAt, daySession, { includeSameDayBeforeStart: true }))
        }))
      } catch {
        if (active) {
          setExpenses([])
          setOrders([])
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

  const handleOpenShift = () => {
    const nextSession: ShiftSession = {
      isOpen: true,
      openedAt: new Date().toISOString(),
      closedAt: null,
      shiftId: `SHIFT-${Date.now()}`,
      confirmed: true,
    }
    setDaySession(nextSession)
    setPrintStatus(isArabic ? 'تم فتح وردية جديدة.' : 'A new shift has been opened.')
  }

  const handleCloseShift = () => {
    if (!daySession.shiftId) return
    const closedAt = new Date().toISOString()
    const nextSession: ShiftSession = { ...daySession, isOpen: false, closedAt }
    setDaySession(nextSession)
    setPrintStatus(isArabic ? 'تم إغلاق الورديه.' : 'The shift has been closed.')
  }

  const driverSettlements = useMemo(() => {
    return sessionOrders.reduce((sum, order) => sum + Number(order.deliveryFee || 0), 0)
  }, [sessionOrders])

  const collectedDrawerRevenue = useMemo(() => {
    return sessionOrders.reduce((sum, order) => isCollectedDrawerOrder(order) ? sum + Number(order.total || 0) : sum, 0)
  }, [sessionOrders])

  const sessionRevenueWithoutDelivery = useMemo(() => {
    return sessionOrders.reduce((sum, order) => {
      // Prefer explicit subtotal minus discount (net sales after discounts, before tax/delivery)
      if (typeof order.subtotal === 'number' && Number.isFinite(order.subtotal)) {
        const discountAmount = Number(order.discount?.amount || 0)
        return sum + Math.max(0, Number(order.subtotal) - discountAmount)
      }
      // Fallback for legacy orders: derive base sales from total by removing delivery and tax, then add back discount amount
      // (keeps compatibility with existing stored shapes)
      const fallbackBase = Math.max(0, Number(order.total || 0) - Number(order.deliveryFee || 0) - Number(order.tax || 0) + Number(order.discount?.amount || 0))
      return sum + fallbackBase
    }, 0)
  }, [sessionOrders])

  const drawerPaymentBreakdown = useMemo(() => {
    return sessionOrders.reduce<Record<string, number>>((totals, order) => {
      if (!isCollectedDrawerOrder(order)) return totals
      const method = String(order.payment?.method || 'cash')
      totals[method] = (totals[method] || 0) + Number(order.total || 0)
      return totals
    }, {})
  }, [sessionOrders])

  const totalRevenue = useMemo(() => {
    return sessionOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
  }, [sessionOrders])

  const totalExpenses = useMemo(() => {
    return sessionExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0)
  }, [sessionExpenses])

  const drawerNetAfterExpenses = useMemo(() => {
    return collectedDrawerRevenue - totalExpenses
  }, [collectedDrawerRevenue, totalExpenses])

  const totalRemainingToCollect = useMemo(() => {
    return sessionOrders.reduce((sum, order) => {
      return String(order.payment?.status || '').toLowerCase() === 'cash_on_delivery' ? sum + Number(order.total || 0) : sum
    }, 0)
  }, [sessionOrders])

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
        orders: sessionOrders,
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
    <div className="space-y-6">
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
              {isArabic ? 'الطلبات' : 'Orders'}: {sessionOrders.length}
            </div>
              <div className="text-xs text-slate-500">
                {isArabic ? 'مدة الوردية' : 'Duration'}: {formatDuration(new Date((daySession.isOpen ? new Date().toISOString() : (daySession.closedAt || daySession.openedAt))).getTime() - new Date(daySession.openedAt).getTime(), isArabic)}
              </div>
          </div>
          <div className="ms-2 flex gap-2">
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={handlePrint}>
              <Printer className="h-4 w-4" />
              {isArabic ? 'طباعة' : 'Print'}
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
                  await performShiftClosing({ ...daySession, closedAt })
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {isArabic ? 'إجمالي المبيعات (بدون رسوم التوصيل)' : 'Total Revenue (excl. delivery)'}
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
              {isArabic ? 'إجمالي المصروفات' : 'Total Expenses'}
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
              {isArabic ? 'صافي الدرج بعد المصروفات' : 'Drawer Net After Expenses'}
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
              <span className="font-semibold">{sessionOrders.length}</span>
            </div>
            <div className="flex justify-between">
              <span>{isArabic ? 'إجمالي المبيعات' : 'Total'}</span>
              <span className="font-semibold">{totalRevenue.toFixed(2)} {currency}</span>
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
              <span>{isArabic ? 'إجمالي المصروفات' : 'Total'}</span>
              <span className="font-semibold">{totalExpenses.toFixed(2)} {currency}</span>
            </div>
            <div className="flex justify-between">
              <span>{isArabic ? 'تسوية السائقين' : 'Driver Settlements'}</span>
              <span className="font-semibold">{driverSettlements.toFixed(2)} {currency}</span>
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
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">{isArabic ? 'المبيعات' : 'Sales'}</p>
              <p className="text-2xl font-bold text-green-600">{totalRevenue.toFixed(2)} {currency}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">{isArabic ? 'إجمالي التكاليف' : 'Total Costs'}</p>
              <p className="text-2xl font-bold text-red-600">{totalExpenses.toFixed(2)} {currency}</p>
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
