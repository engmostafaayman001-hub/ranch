'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AppCustomer } from '@/lib/customers'
import { TrackedOrder } from '@/lib/order-tracking'

type CustomerRow = AppCustomer & {
  ordersCount: number
  totalSpent: number
}

export default function DashboardCustomersPage() {
  const [customers, setCustomers] = useState<AppCustomer[]>([])
  const [orders, setOrders] = useState<TrackedOrder[]>([])
  const [loading, setLoading] = useState(true)

  const loadCustomers = async () => {
    setLoading(true)
    try {
      const [customersResponse, ordersResponse] = await Promise.all([
        fetch('/api/customers', { cache: 'no-store' }),
        fetch('/api/pos/orders', { cache: 'no-store' }),
      ])
      const customersData = await customersResponse.json().catch(() => ({}))
      const ordersData = await ordersResponse.json().catch(() => ({}))
      setCustomers(Array.isArray(customersData.customers) ? customersData.customers : [])
      setOrders(Array.isArray(ordersData.orders) ? ordersData.orders : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => loadCustomers().catch(() => setLoading(false)), 0)
    const interval = window.setInterval(() => loadCustomers().catch(() => setLoading(false)), 15000)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(interval)
    }
  }, [])

  const rows = useMemo<CustomerRow[]>(() => {
    const map = new Map<string, CustomerRow>()

    for (const customer of customers) {
      const key = customer.email?.toLowerCase() || customer.phone || customer.id
      map.set(key, { ...customer, ordersCount: 0, totalSpent: 0 })
    }

    for (const order of orders) {
      const key = order.customerEmail?.toLowerCase() || order.phone || order.customer.toLowerCase()
      const existing = map.get(key)
      if (existing) {
        existing.ordersCount += 1
        existing.totalSpent += Number(order.total || 0)
        existing.phone = existing.phone || order.phone
        existing.address = existing.address || order.address
        existing.name = existing.name || order.customer
      } else {
        map.set(key, {
          id: `order-${order.id}`,
          name: order.customer,
          email: '-',
          phone: order.phone,
          address: order.address,
          createdAt: order.createdAt,
          updatedAt: order.createdAt,
          ordersCount: 1,
          totalSpent: Number(order.total || 0),
        })
      }
    }

    return Array.from(map.values()).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [customers, orders])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold">إدارة العملاء</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            تعرض العملاء المسجلين وأي عميل ظهر في الطلبات، مع عدد الطلبات وإجمالي الإنفاق.
          </p>
        </div>
        <Button variant="outline" onClick={() => loadCustomers()} disabled={loading}>
          {loading ? 'جاري التحديث...' : 'تحديث'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>كل العملاء</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-slate-500">جاري تحميل العملاء...</div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-slate-500">لا توجد بيانات عملاء بعد.</div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {rows.map((customer) => (
                  <div key={customer.id} className="rounded-lg border p-4">
                    <p className="font-bold">{customer.name || '-'}</p>
                    <p className="text-sm text-slate-500">{customer.email}</p>
                    <p className="text-sm text-slate-500">{customer.phone || '-'}</p>
                    <p className="mt-2 text-sm">{customer.address || '-'}</p>
                    <div className="mt-3 flex justify-between text-sm font-semibold">
                      <span>{customer.ordersCount} طلب</span>
                      <span>{customer.totalSpent.toFixed(2)} ج.م</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-right dark:border-slate-800">
                      <th className="py-3 font-semibold">الاسم</th>
                      <th className="py-3 font-semibold">الإيميل</th>
                      <th className="py-3 font-semibold">رقم الهاتف</th>
                      <th className="py-3 font-semibold">العنوان</th>
                      <th className="py-3 font-semibold">الطلبات</th>
                      <th className="py-3 font-semibold">الإجمالي</th>
                      <th className="py-3 font-semibold">آخر تحديث</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((customer) => (
                      <tr key={customer.id} className="border-b border-slate-100 dark:border-slate-900">
                        <td className="py-3 font-medium">{customer.name || '-'}</td>
                        <td className="py-3">{customer.email}</td>
                        <td className="py-3">{customer.phone || '-'}</td>
                        <td className="py-3">{customer.address || '-'}</td>
                        <td className="py-3">{customer.ordersCount}</td>
                        <td className="py-3">{customer.totalSpent.toFixed(2)} ج.م</td>
                        <td className="py-3 text-slate-500">{new Date(customer.updatedAt).toLocaleString('ar-EG')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
