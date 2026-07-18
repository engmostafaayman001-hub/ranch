'use client'

import { useEffect, useMemo, useState } from 'react'
import { Printer, CalendarDays, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN } from '@/lib/constants'
import { TrackedOrder } from '@/lib/order-tracking'
import { useAppStore } from '@/lib/app-store'
import { printerManager, syncPrinterManagerSettings } from '@/lib/printer'
import { createClosingReceiptPayload } from '@/lib/closing-print'
import { getDriverClosingGroups } from '@/lib/driver-closing-print'

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

type PosDaySession = {
  isOpen: boolean
  openedAt: string
  closedAt: string | null
}

const POS_DAY_SESSION_STORAGE_KEY = 'baseeta-pos-day-session-v1'

function loadPosDaySession(): PosDaySession {
  if (typeof window === 'undefined') {
    return { isOpen: true, openedAt: new Date().toISOString(), closedAt: null }
  }
  try {
    const raw = window.localStorage.getItem(POS_DAY_SESSION_STORAGE_KEY)
    if (!raw) {
      const initial = { isOpen: true, openedAt: new Date().toISOString(), closedAt: null } satisfies PosDaySession
      window.localStorage.setItem(POS_DAY_SESSION_STORAGE_KEY, JSON.stringify(initial))
      return initial
    }
    const parsed = JSON.parse(raw) as Partial<PosDaySession>
    if (typeof parsed?.openedAt === 'string') {
      // If the stored session started on a different calendar day, start a fresh session now
      const opened = new Date(parsed.openedAt)
      const now = new Date()
      const sameDay = opened.getFullYear() === now.getFullYear() && opened.getMonth() === now.getMonth() && opened.getDate() === now.getDate()
      if (!sameDay) {
        const initial = { isOpen: true, openedAt: new Date().toISOString(), closedAt: null } satisfies PosDaySession
        window.localStorage.setItem(POS_DAY_SESSION_STORAGE_KEY, JSON.stringify(initial))
        return initial
      }
      return {
        isOpen: parsed.isOpen !== false,
        openedAt: parsed.openedAt,
        closedAt: typeof parsed.closedAt === 'string' ? parsed.closedAt : null,
      }
    }
  } catch {
    // ignore storage issues and fall back to a fresh session
  }
  return { isOpen: true, openedAt: new Date().toISOString(), closedAt: null }
}

function savePosDaySession(session: PosDaySession) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(POS_DAY_SESSION_STORAGE_KEY, JSON.stringify(session))
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

  const sessionRange = useMemo(() => {
    const start = new Date(daySession.openedAt)
    const end = daySession.isOpen ? new Date() : new Date(daySession.closedAt || daySession.openedAt)
    if (start > end) return { start: end.toISOString(), end: start.toISOString() }
    return { start: start.toISOString(), end: end.toISOString() }
  }, [daySession])

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
    return orders.filter((order) => order.status !== 'cancelled' && order.createdAt && new Date(order.createdAt) >= new Date(sessionRange.start) && new Date(order.createdAt) <= new Date(sessionRange.end))
  }, [orders, sessionRange])

  const sessionExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const expDate = new Date(exp.date || exp.id || '')
      return expDate >= new Date(sessionRange.start) && expDate <= new Date(sessionRange.end)
    })
  }, [expenses, sessionRange])

  const driverSettlements = useMemo(() => {
    return sessionOrders.reduce((sum, order) => sum + Number(order.deliveryFee || 0), 0)
  }, [sessionOrders])

  const driverCollections = useMemo(() => {
    // Only count cash on delivery orders that have not been marked as paid yet
    const uncollectedOrders = sessionOrders.filter(o => o.payment?.status === 'cash_on_delivery' && o.payment?.method === 'cash')
    const driverGroups = getDriverClosingGroups(uncollectedOrders)
    return driverGroups.reduce((sum, group) => sum + group.total, 0)
  }, [sessionOrders])

  const totalRevenue = useMemo(() => {
    return sessionOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
  }, [sessionOrders])

  const totalExpenses = useMemo(() => {
    return sessionExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0)
  }, [sessionExpenses])

  const netProfit = totalRevenue - totalExpenses - driverSettlements

  const handlePrint = async () => {
    try {
      syncPrinterManagerSettings(settings.printers)
      const includeOrders = daySession.isOpen
      const payload = createClosingReceiptPayload({
        title: isArabic ? 'تقفيل الوردية' : 'Shift Closing',
        dateLabel: `${new Date(daySession.openedAt).toLocaleString()} - ${daySession.isOpen ? new Date().toLocaleString() : new Date(daySession.closedAt || daySession.openedAt).toLocaleString()}`,
        orders: includeOrders ? sessionOrders : [],
        expenses: sessionExpenses,
        revenue: includeOrders ? totalRevenue : 0,
        expenseTotal: totalExpenses,
        net: includeOrders ? netProfit : 0,
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
              {isArabic ? 'إجمالي الإيرادات' : 'Total Revenue'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{totalRevenue.toFixed(2)}</p>
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
              {isArabic ? 'تسويات السائقين' : 'Driver Settlements'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{driverSettlements.toFixed(2)}</p>
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <p className="text-xs text-slate-500 mt-1">{currency}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {isArabic ? 'تحصيل السائقين' : 'Driver Collections'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{driverCollections.toFixed(2)}</p>
              <Wallet className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-xs text-slate-500 mt-1">{currency}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {isArabic ? 'الصافي' : 'Net'}
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
              <p className="text-2xl font-bold text-red-600">{(totalExpenses + driverSettlements).toFixed(2)} {currency}</p>
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
