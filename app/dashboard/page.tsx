'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN } from '@/lib/constants'
import { TrackedOrder } from '@/lib/order-tracking'
import { type ShiftSession } from '@/lib/pos-day-session'
import useShiftSession from '@/lib/use-shift-session'

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

export default function DashboardPage() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const [orders, setOrders] = useState<TrackedOrder[]>([])
  const [customers, setCustomers] = useState<DashboardCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [shiftSession] = useShiftSession()
  const loadingDashboard = useRef(false)
  const activeDashboardUsers = useActiveDashboardUsers()

  useEffect(() => {
    let active = true

    async function loadDashboardData() {
      if (loadingDashboard.current) return
      loadingDashboard.current = true
      try {
        const [ordersResponse, customersResponse] = await Promise.all([
          fetch('/api/pos/orders', { cache: 'no-store' }),
          fetch('/api/customers', { cache: 'no-store' }),
        ])
        const ordersData = await ordersResponse.json().catch(() => ({}))
        const customersData = await customersResponse.json().catch(() => ({}))

        if (!active) return
        setOrders(Array.isArray(ordersData.orders) ? ordersData.orders : [])
        setCustomers(Array.isArray(customersData.customers) ? customersData.customers : [])
      } finally {
        loadingDashboard.current = false
        if (active) setLoading(false)
      }
    }

    const timer = window.setTimeout(loadDashboardData, 0)
    const interval = window.setInterval(loadDashboardData, 120000)
    return () => {
      active = false
      window.clearTimeout(timer)
      window.clearInterval(interval)
    }
  }, [])

  const stats = useMemo(() => {
    const activeStatuses = new Set(['placed', 'confirmed', 'preparing', 'ready_for_delivery', 'out_for_delivery'])
    const activeOrders = orders.filter((order) => activeStatuses.has(order.status)).length
    const shiftOrders = orders.filter((order) => shiftSession.shiftId ? order.shiftId === shiftSession.shiftId : false)
    const appShiftOrders = shiftOrders.filter((order) => order.source !== 'restaurant_pos')
    const restaurantShiftOrders = shiftOrders.filter((order) => order.source === 'restaurant_pos')
    const shiftRevenue = shiftOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
    const appShiftRevenue = appShiftOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
    const restaurantShiftRevenue = restaurantShiftOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)

    return [
      [isArabic ? 'إجمالي الطلبات' : 'Total Orders', String(orders.length)],
      [isArabic ? 'طلبات الوردية' : 'Shift Orders', String(shiftOrders.length)],
      [isArabic ? 'إيرادات الوردية' : 'Shift Revenue', `${shiftRevenue.toFixed(2)} ${currency}`],
      [isArabic ? 'طلبات نشطة' : 'Active Orders', String(activeOrders)],
      [isArabic ? 'الأشخاص النشطون الآن' : 'Active People Now', String(activeDashboardUsers)],
      [isArabic ? 'العملاء' : 'Customers', String(customers.length)],
    ]
  }, [orders, customers, activeDashboardUsers, shiftSession.shiftId, isArabic, currency])

  const recentOrders = orders.slice(0, 5)

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold">{isArabic ? 'نظرة عامة' : 'Overview'}</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            {isArabic ? 'أرقام حقيقية من الطلبات والعملاء، ويتم تحديثها تلقائيا كل 15 ثانية.' : 'Live numbers from orders and customers, refreshed every 15 seconds.'}
          </p>
        </div>
        <Link href="/dashboard/orders">
          <Button className="bg-red-600 hover:bg-red-700">{isArabic ? 'إدارة الطلبات' : 'Manage Orders'}</Button>
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
