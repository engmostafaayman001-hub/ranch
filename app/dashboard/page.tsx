'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CURRENCY } from '@/lib/constants'
import { TrackedOrder } from '@/lib/order-tracking'

type DashboardCustomer = {
  id: string
  email: string
}

export default function DashboardPage() {
  const [orders, setOrders] = useState<TrackedOrder[]>([])
  const [customers, setCustomers] = useState<DashboardCustomer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadDashboardData() {
      try {
        const [ordersResponse, customersResponse] = await Promise.all([
          fetch('/api/pos/orders'),
          fetch('/api/customers'),
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

    loadDashboardData()
    const interval = window.setInterval(loadDashboardData, 15000)
    return () => {
      active = false
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
      ['إجمالي الطلبات', String(orders.length)],
      ['إيرادات الطلبات', `${revenue.toFixed(2)} ${CURRENCY}`],
      ['طلبات نشطة', String(activeOrders)],
      ['طلبات اليوم', String(todayOrders)],
      ['العملاء', String(customers.length)],
    ]
  }, [orders, customers])

  const recentOrders = orders.slice(0, 5)

  return (
    <div>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold">نظرة عامة</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            أرقام حقيقية من الطلبات والعملاء، ويتم تحديثها تلقائيًا كل 15 ثانية.
          </p>
        </div>
        <Link href="/dashboard/orders">
          <Button className="bg-red-600 hover:bg-red-700">إدارة الطلبات</Button>
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

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>أحدث الطلبات</CardTitle>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="py-8 text-center text-slate-500">لا توجد طلبات حقيقية بعد.</p>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">{order.id}</p>
                      <p className="text-sm text-slate-500">{order.customer} - {order.phone || 'بدون رقم'}</p>
                    </div>
                    <div className="text-sm font-semibold">{Number(order.total || 0).toFixed(2)} {CURRENCY}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ربط POS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600 dark:text-slate-400">
              أرسل الطلبات أو تحديثات الحالة إلى هذا المسار لتظهر مباشرة في لوحة الطلبات والتتبع.
            </p>
            <code className="block overflow-x-auto rounded bg-slate-100 p-3 text-sm dark:bg-slate-900">
              POST /api/pos/orders
            </code>
            <code className="block overflow-x-auto rounded bg-slate-100 p-3 text-sm dark:bg-slate-900">
              PATCH /api/pos/orders
            </code>
            <p className="text-sm text-slate-500">
              يمكن إضافة المفاتيح في البيئة باسم <span className="font-semibold">RANCH_POS_API_KEYS</span> أو <span className="font-semibold">POS_API_KEYS</span>، ثم إرسالها في الهيدر <span className="font-semibold">X-POS-API-Key</span> أو Bearer Token.
            </p>
            <Link href="/dashboard/pos">
              <Button variant="outline">فتح صفحة POS</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
