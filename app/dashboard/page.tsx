'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN } from '@/lib/constants'
import { TrackedOrder } from '@/lib/order-tracking'

type DashboardCustomer = {
  id: string
  email: string
}

export default function DashboardPage() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const [orders, setOrders] = useState<TrackedOrder[]>([])
  const [customers, setCustomers] = useState<DashboardCustomer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadDashboardData() {
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
        if (active) setLoading(false)
      }
    }

    const timer = window.setTimeout(loadDashboardData, 0)
    const interval = window.setInterval(loadDashboardData, 15000)
    return () => {
      active = false
      window.clearTimeout(timer)
      window.clearInterval(interval)
    }
  }, [])

  const stats = useMemo(() => {
    const activeStatuses = new Set(['placed', 'confirmed', 'preparing', 'ready_for_delivery', 'out_for_delivery'])
    const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0)
    const activeOrders = orders.filter((order) => activeStatuses.has(order.status)).length
    const today = new Date().toDateString()
    const todayOrders = orders.filter((order) => new Date(order.createdAt).toDateString() === today).length

    return [
      [isArabic ? 'إجمالي الطلبات' : 'Total Orders', String(orders.length)],
      [isArabic ? 'إيرادات الطلبات' : 'Order Revenue', `${revenue.toFixed(2)} ${currency}`],
      [isArabic ? 'طلبات نشطة' : 'Active Orders', String(activeOrders)],
      [isArabic ? 'طلبات اليوم' : 'Today Orders', String(todayOrders)],
      [isArabic ? 'العملاء' : 'Customers', String(customers.length)],
    ]
  }, [orders, customers, isArabic, currency])

  const recentOrders = orders.slice(0, 5)

  return (
    <div>
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

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{loading ? '-' : value}</p>
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
                    <p className="font-semibold">{order.id}</p>
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
