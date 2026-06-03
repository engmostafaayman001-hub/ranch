'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN } from '@/lib/constants'
import { TrackedOrder } from '@/lib/order-tracking'

type Customer = {
  id?: string
  name?: string
  email?: string
  phone?: string
  address?: string
  orders?: number
  totalSpent?: number
  lastOrderAt?: string
}

export default function DashboardCustomersPage() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function loadCustomers() {
      try {
        const [customersResponse, ordersResponse] = await Promise.all([
          fetch('/api/customers', { cache: 'no-store' }),
          fetch('/api/pos/orders', { cache: 'no-store' }),
        ])
        const customersData = await customersResponse.json().catch(() => ({}))
        const ordersData = await ordersResponse.json().catch(() => ({}))
        const baseCustomers = Array.isArray(customersData.customers) ? customersData.customers as Customer[] : []
        const orders = Array.isArray(ordersData.orders) ? ordersData.orders as TrackedOrder[] : []
        const byEmail = new Map<string, Customer>()

        for (const customer of baseCustomers) {
          const key = customer.email?.toLowerCase()
          if (key) byEmail.set(key, { ...customer, orders: 0, totalSpent: 0 })
        }

        for (const order of orders) {
          const key = order.customerEmail?.toLowerCase()
          if (!key) continue
          const existing = byEmail.get(key) || {
            id: key,
            name: order.customer,
            email: order.customerEmail,
            phone: order.phone,
            address: order.address,
            orders: 0,
            totalSpent: 0,
          }
          byEmail.set(key, {
            ...existing,
            name: existing.name || order.customer,
            phone: existing.phone || order.phone,
            address: existing.address || order.address,
            orders: (existing.orders || 0) + 1,
            totalSpent: (existing.totalSpent || 0) + Number(order.total || 0),
            lastOrderAt: !existing.lastOrderAt || new Date(order.createdAt) > new Date(existing.lastOrderAt) ? order.createdAt : existing.lastOrderAt,
          })
        }

        if (active) setCustomers(Array.from(byEmail.values()).sort((a, b) => new Date(b.lastOrderAt || 0).getTime() - new Date(a.lastOrderAt || 0).getTime()))
      } catch {
        if (active) setCustomers([])
      } finally {
        if (active) setLoading(false)
      }
    }

    const timer = window.setTimeout(loadCustomers, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">{isArabic ? 'إدارة العملاء' : 'Customers'}</h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          {isArabic ? 'عرض العملاء المسجلين والعملاء الذين ظهروا في الطلبات.' : 'View registered customers and customers collected from orders.'}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>{isArabic ? 'قائمة العملاء' : 'Customer List'}</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-slate-500">{isArabic ? 'جاري تحميل العملاء...' : 'Loading customers...'}</div>
          ) : customers.length === 0 ? (
            <div className="py-12 text-center text-slate-500">{isArabic ? 'لا يوجد عملاء بعد.' : 'No customers yet.'}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left dark:border-slate-800">
                    <th className="py-3 font-semibold">{isArabic ? 'الاسم' : 'Name'}</th>
                    <th className="py-3 font-semibold">{isArabic ? 'البريد' : 'Email'}</th>
                    <th className="py-3 font-semibold">{isArabic ? 'الهاتف' : 'Phone'}</th>
                    <th className="py-3 font-semibold">{isArabic ? 'الطلبات' : 'Orders'}</th>
                    <th className="py-3 font-semibold">{isArabic ? 'الإجمالي' : 'Total'}</th>
                    <th className="py-3 font-semibold">{isArabic ? 'آخر طلب' : 'Last Order'}</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer, index) => (
                    <tr key={customer.id || customer.email || index} className="border-b last:border-0 dark:border-slate-800">
                      <td className="py-3">{customer.name || '-'}</td>
                      <td className="py-3">{customer.email || '-'}</td>
                      <td className="py-3">{customer.phone || '-'}</td>
                      <td className="py-3">{customer.orders || 0}</td>
                      <td className="py-3">{Number(customer.totalSpent || 0).toFixed(2)} {currency}</td>
                      <td className="py-3">{customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString(isArabic ? 'ar-EG' : 'en-US') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
