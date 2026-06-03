'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AppCustomer } from '@/lib/customers'

export default function DashboardCustomersPage() {
  const [customers, setCustomers] = useState<AppCustomer[]>([])
  const [loading, setLoading] = useState(true)

  const loadCustomers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/customers', { cache: 'no-store' })
      const data = await response.json()
      setCustomers(Array.isArray(data.customers) ? data.customers : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      loadCustomers().catch(() => setLoading(false))
    })
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold">إدارة العملاء</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">تظهر هنا بيانات العملاء بعد التسجيل أو تحديث الملف الشخصي أو إكمال طلب.</p>
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
          {customers.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              لا توجد بيانات عملاء بعد.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-right dark:border-slate-800">
                    <th className="py-3 font-semibold">الاسم</th>
                    <th className="py-3 font-semibold">الإيميل</th>
                    <th className="py-3 font-semibold">رقم الهاتف</th>
                    <th className="py-3 font-semibold">العنوان</th>
                    <th className="py-3 font-semibold">آخر تحديث</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.id} className="border-b border-slate-100 dark:border-slate-900">
                      <td className="py-3 font-medium">{customer.name || '-'}</td>
                      <td className="py-3">{customer.email}</td>
                      <td className="py-3">{customer.phone || '-'}</td>
                      <td className="py-3">{customer.address || '-'}</td>
                      <td className="py-3 text-slate-500">{new Date(customer.updatedAt).toLocaleString('ar-EG')}</td>
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
