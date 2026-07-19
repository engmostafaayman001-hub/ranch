'use client'

import { useEffect, useMemo, useState } from 'react'
import { Printer, CalendarDays, TrendingUp, TrendingDown, Wallet, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN } from '@/lib/constants'
import { TrackedOrder } from '@/lib/order-tracking'
import { useAppStore } from '@/lib/app-store'
import { printerManager, syncPrinterManagerSettings } from '@/lib/printer'
import { createClosingReceiptPayload } from '@/lib/closing-print'
import { getSessionDateRange, loadPosDaySession, savePosDaySession, type PosDaySession } from '@/lib/pos-day-session'

type Expense = {
  id: string
  name: string
  amount: number
  date: string
  note: string
}

function getDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

function isWithinSessionRange(value: string | undefined, sessionRange: { start: string; end: string }) {
  if (!value) return false
  const compareDate = new Date(value)
  if (Number.isNaN(compareDate.getTime())) return false
  const startDate = new Date(sessionRange.start)
  const endDate = new Date(sessionRange.end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return false
  return compareDate.getTime() >= startDate.getTime() && compareDate.getTime() <= endDate.getTime()
}

function isExpenseInSessionRange(expense: Expense, sessionRange: { start: string; end: string }) {
  const expenseDateValue = expense.date || expense.id || ''
  const expenseDate = new Date(expenseDateValue)
  if (Number.isNaN(expenseDate.getTime())) return false
  const startDate = new Date(sessionRange.start)
  const endDate = new Date(sessionRange.end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return false
  const normalizedExpense = new Date(expenseDate.getFullYear(), expenseDate.getMonth(), expenseDate.getDate())
  const normalizedStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  const normalizedEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
  return normalizedExpense >= normalizedStart && normalizedExpense <= normalizedEnd
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
  const [daySession, setDaySession] = useState<PosDaySession>(() => loadPosDaySession())

  const sessionRange = useMemo(() => getSessionDateRange(daySession), [daySession])

  function getDateRangeFromInputs(startValue: string, endValue: string) {
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
  }

  const effectiveRange = useMemo(() => getDateRangeFromInputs(rangeStart, rangeEnd), [rangeStart, rangeEnd, sessionRange])

  useEffect(() => {
    const loadExpenses = async () => {
      try {
        const response = await fetch('/api/expenses', { cache: 'no-store' })
        const data = await response.json().catch(() => ({}))
        setExpenses(Array.isArray(data.expenses) ? data.expenses : [])
      } catch {
        setExpenses([])
      }
    }
    loadExpenses()

    let active = true
    fetch('/api/pos/orders?limit=500', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (!active) return
        if (Array.isArray(data.orders)) {
          setOrders(data.orders)
        }
      })
      .catch(() => {
        if (!active) return
        setOrders([])
      })

    return () => {
      active = false
    }
  }, [])

  const sessionOrders = useMemo(() => {
    return orders.filter((order) => order.status !== 'cancelled' && order.createdAt && isWithinSessionRange(order.createdAt, effectiveRange))
  }, [orders, effectiveRange])

  const sessionExpenses = useMemo(() => {
    return expenses.filter((exp) => isExpenseInSessionRange(exp, effectiveRange))
  }, [expenses, effectiveRange])

  const driverSettlements = useMemo(() => {
    return sessionOrders.reduce((sum, order) => sum + Number(order.deliveryFee || 0), 0)
  }, [sessionOrders])

  const collectedDrawerRevenue = useMemo(() => {
    return sessionOrders.reduce((sum, order) => isCollectedDrawerOrder(order) ? sum + Number(order.total || 0) : sum, 0)
  }, [sessionOrders])

  const sessionRevenueWithoutDelivery = useMemo(() => {
    return sessionOrders.reduce((sum, order) => {
      const amount = typeof (order as any).subtotal === 'number' && Number.isFinite((order as any).subtotal)
        ? Number((order as any).subtotal)
        : Math.max(0, Number(order.total || 0) - Number(order.deliveryFee || 0))
      return sum + amount
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

  const netProfit = collectedDrawerRevenue - totalExpenses

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

  const handlePrint = async () => {
    try {
      syncPrinterManagerSettings(settings.printers)
      const includeOrders = daySession.isOpen
      const payload = createClosingReceiptPayload({
        title: isArabic ? 'تقفيل الوردية' : 'Shift Closing',
        dateLabel: `${new Date(daySession.openedAt).toLocaleString()} - ${daySession.isOpen ? new Date().toLocaleString() : new Date(daySession.closedAt || daySession.openedAt).toLocaleString()}`,
        orders: includeOrders ? sessionOrders : [],
        expenses: sessionExpenses,
        revenue: includeOrders ? collectedDrawerRevenue : 0,
        expenseTotal: totalExpenses,
        net: includeOrders ? netProfit : 0,
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

  const openShift = () => {
    const next: PosDaySession = { isOpen: true, openedAt: new Date().toISOString(), closedAt: null }
    savePosDaySession(next)
    setDaySession(next)
    setPrintStatus(isArabic ? 'تم فتح الوردية' : 'Shift opened')
  }

  const endShift = () => {
    const confirmMsg = isArabic ? 'هل أنت متأكد من إنهاء الوردية؟ لن تتمكن من إضافة طلبات لهذه الوردية بعد الإغلاق.' : 'Are you sure you want to end the shift? Orders will no longer be counted for this shift.'
    if (typeof window !== 'undefined' && !window.confirm(confirmMsg)) return
    const closedAt = new Date().toISOString()
    const next: PosDaySession = { ...daySession, isOpen: false, closedAt }
    savePosDaySession(next)
    setDaySession(next)
    setPrintStatus(isArabic ? 'تم إنهاء الوردية' : 'Shift ended')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold">{isArabic ? 'التقفيل اليومي' : 'Daily Closing'}</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {isArabic ? 'ملخص المبيعات والمصروفات لفترة محددة.' : "Summary of sales and expenses for a specific period."}
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
              <Button className="gap-2 bg-red-600 hover:bg-red-700" onClick={endShift}>
                {isArabic ? 'إنهاء الوردية' : 'End Shift'}
              </Button>
            ) : (
              <Button className="gap-2 bg-green-600 hover:bg-green-700" onClick={openShift}>
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {isArabic ? 'طرق الدفع الأخرى' : 'Other Payments'}
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {isArabic ? 'صافي الدرج' : 'Drawer Net'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {netProfit.toFixed(2)}
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
              <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {netProfit.toFixed(2)} {currency}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
