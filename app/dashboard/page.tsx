'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN } from '@/lib/constants'
import { TrackedOrder } from '@/lib/order-tracking'
import { readAllClosings, type ClosingRecord, type SavedClosingExpense } from '@/lib/closings'
import { summarizeClosingData } from '@/lib/financial-calculations'

type DashboardCustomer = {
  id: string
  email: string
}

type DashboardPresenceEntry = {
  id: string
  userKey: string
  lastSeen: number
  isActive: boolean
}

type DashboardExpense = SavedClosingExpense

const DASHBOARD_PRESENCE_STORAGE_KEY = 'dashboard-active-users'
const DASHBOARD_PRESENCE_WINDOW_MS = 30000
const DASHBOARD_PRESENCE_HEARTBEAT_MS = 10000

function readDashboardPresenceEntries(): DashboardPresenceEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(DASHBOARD_PRESENCE_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as DashboardPresenceEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeDashboardPresenceEntries(entries: DashboardPresenceEntry[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(DASHBOARD_PRESENCE_STORAGE_KEY, JSON.stringify(entries))
}

function getDashboardPresenceUserKey() {
  if (typeof window === 'undefined') return 'anonymous'
  const cookie = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith('app_user_email='))

  if (cookie) {
    const value = cookie.split('=').slice(1).join('=')
    return decodeURIComponent(value || 'anonymous').trim() || 'anonymous'
  }

  return 'anonymous'
}

function useActiveDashboardUsers() {
  const [activeUsersCount, setActiveUsersCount] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const tabId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const userKey = getDashboardPresenceUserKey()
    let mounted = true

    const syncPresence = (isActive: boolean = true) => {
      if (!mounted) return
      const now = Date.now()
      const activeWindow = now - DASHBOARD_PRESENCE_WINDOW_MS
      const entries = readDashboardPresenceEntries()
        .filter((entry) => entry.lastSeen >= activeWindow)
        .filter((entry) => entry.id !== tabId)
      entries.push({ id: tabId, userKey, lastSeen: now, isActive })
      writeDashboardPresenceEntries(entries)
      const activeCount = new Set(entries.filter((entry) => entry.isActive).map((entry) => entry.userKey)).size
      setActiveUsersCount(activeCount)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        syncPresence(false)
      } else {
        syncPresence(true)
      }
    }

    syncPresence(true)
    const interval = window.setInterval(() => syncPresence(true), DASHBOARD_PRESENCE_HEARTBEAT_MS)
    window.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', () => syncPresence(false))

    return () => {
      mounted = false
      window.clearInterval(interval)
      window.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', () => syncPresence(false))
      const entries = readDashboardPresenceEntries().filter((entry) => entry.id !== tabId)
      writeDashboardPresenceEntries(entries)
      setActiveUsersCount(0)
    }
  }, [])

  return activeUsersCount
}

function uniqueOrders(...groups: TrackedOrder[][]) {
  const byId = new Map<string, TrackedOrder>()
  for (const orders of groups) {
    for (const order of orders) {
      if (!order?.id) continue
      const existing = byId.get(order.id)
      if (!existing || (!existing.lines?.length && order.lines?.length)) byId.set(order.id, order)
    }
  }
  return Array.from(byId.values()).sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
}

function uniqueExpenses(...groups: DashboardExpense[][]) {
  const byId = new Map<string, DashboardExpense>()
  for (const expenses of groups) {
    for (const expense of expenses) {
      if (expense?.id) byId.set(expense.id, expense)
    }
  }
  return Array.from(byId.values()).sort((first, second) => new Date(second.date || '').getTime() - new Date(first.date || '').getTime())
}

function money(value: number, currency: string) {
  return `${Number(value || 0).toFixed(2)} ${currency}`
}

export default function DashboardPage() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const [orders, setOrders] = useState<TrackedOrder[]>([])
  const [expenses, setExpenses] = useState<DashboardExpense[]>([])
  const [closings, setClosings] = useState<ClosingRecord[]>([])
  const [customers, setCustomers] = useState<DashboardCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const loadingDashboard = useRef(false)
  const activeDashboardUsers = useActiveDashboardUsers()

  useEffect(() => {
    let active = true

    async function loadDashboardData() {
      if (loadingDashboard.current) return
      loadingDashboard.current = true
      try {
        const [ordersResponse, expensesResponse, customersResponse, closingRecords] = await Promise.all([
          fetch('/api/orders?limit=10000', { cache: 'no-store' }),
          fetch('/api/expenses', { cache: 'no-store' }),
          fetch('/api/customers', { cache: 'no-store' }),
          readAllClosings(),
        ])
        const ordersData = await ordersResponse.json().catch(() => ({}))
        const expensesData = await expensesResponse.json().catch(() => ({}))
        const customersData = await customersResponse.json().catch(() => ({}))

        if (!active) return
        const currentOrders = Array.isArray(ordersData.orders) ? ordersData.orders as TrackedOrder[] : []
        const currentExpenses = Array.isArray(expensesData.expenses) ? expensesData.expenses as DashboardExpense[] : []
        setOrders(uniqueOrders(currentOrders))
        setExpenses(uniqueExpenses(currentExpenses))
        setClosings(closingRecords)
        setCustomers(Array.isArray(customersData.customers) ? customersData.customers : [])
      } catch {
        if (!active) return
        setOrders([])
        setExpenses([])
        setClosings([])
        setCustomers([])
      } finally {
        loadingDashboard.current = false
        if (active) setLoading(false)
      }
    }

    const timer = window.setTimeout(loadDashboardData, 0)
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadDashboardData()
    }, 300000)
    return () => {
      active = false
      window.clearTimeout(timer)
      window.clearInterval(interval)
    }
  }, [])

  const stats = useMemo(() => {
    const activeStatuses = new Set(['placed', 'confirmed', 'preparing', 'ready_for_delivery', 'out_for_delivery'])
    const activeOrders = orders.filter((order) => activeStatuses.has(order.status)).length
    const completedOrders = orders.filter((order) => order.status !== 'cancelled')
    const summary = summarizeClosingData(orders, expenses)
    const closingOrdersCount = closings.reduce((sum, closing) => sum + Number(closing.ordersCount || 0), 0)
    const closingCancelledOrders = closings.reduce((sum, closing) => sum + Number(closing.cancelledOrdersCount || 0), 0)
    const closingNetSales = closings.reduce((sum, closing) => sum + Number(closing.salesWithoutDelivery || 0), 0)
    const closingExpenses = closings.reduce((sum, closing) => sum + Number(closing.expensesTotal || 0), 0)
    const totalOrders = orders.length + closingOrdersCount
    const cancelledOrders = orders.length - completedOrders.length + closingCancelledOrders
    const closedShiftCount = closings.filter((closing) => closing.type !== 'driver').length
    const appOrders = completedOrders.filter((order) => order.source !== 'restaurant_pos').length
    const restaurantOrders = completedOrders.filter((order) => order.source === 'restaurant_pos').length

    return [
      [isArabic ? 'إجمالي طلبات التطبيق' : 'All App Orders', String(totalOrders)],
      [isArabic ? 'صافي مبيعات التطبيق' : 'App Net Sales', money(summary.netSales + closingNetSales, currency)],
      [isArabic ? 'إجمالي المصروفات' : 'Total Expenses', money(summary.expenses + closingExpenses, currency)],
      [isArabic ? 'الطلبات الملغية' : 'Cancelled Orders', String(cancelledOrders)],
      [isArabic ? 'طلبات نشطة حاليا' : 'Active Orders Now', String(activeOrders)],
      [isArabic ? 'الورديات المقفولة' : 'Closed Shifts', String(closedShiftCount)],
      [isArabic ? 'طلبات التطبيق الحالية' : 'Current Customer App Orders', String(appOrders)],
      [isArabic ? 'طلبات المطعم الحالية' : 'Current Restaurant Orders', String(restaurantOrders)],
      [isArabic ? 'العملاء' : 'Customers', String(customers.length)],
      [isArabic ? 'الأشخاص النشطون الآن' : 'Active People Now', String(activeDashboardUsers)],
    ]
  }, [orders, expenses, closings, customers, activeDashboardUsers, isArabic, currency])

  const recentOrders = orders.slice(0, 5)

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold">{isArabic ? 'نظرة عامة' : 'Overview'}</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            {isArabic ? 'نتائج التطبيق بالكامل من الطلبات الحالية والتقفيلات المحفوظة والمصروفات، وليست أرقام الوردية فقط.' : 'App-wide results from live orders, saved closings, and expenses, not just the current shift.'}
          </p>
        </div>
        <Link href="/dashboard/orders">
          <Button className="bg-red-600 hover:bg-red-700">{isArabic ? 'إدارة الطلبات' : 'Manage Orders'}</Button>
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="break-words text-3xl font-bold">{loading ? '-' : value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isArabic ? 'أحدث الطلبات' : 'Recent Orders'}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <DashboardListSkeleton />
          ) : recentOrders.length === 0 ? (
            <p className="py-8 text-center text-slate-500">{isArabic ? 'لا توجد طلبات حقيقية بعد.' : 'No real orders yet.'}</p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">#{order.displayNumber || order.id}</p>
                    <p className="text-sm text-slate-500">{order.customer} - {order.phone || (isArabic ? 'بدون رقم' : 'No phone')}</p>
                  </div>
                  <div className="text-sm font-semibold">{Number(order.total || 0).toFixed(2)} {currency}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DashboardListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-900" />
      ))}
    </div>
  )
}
