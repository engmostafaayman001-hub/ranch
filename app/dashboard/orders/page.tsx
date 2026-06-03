'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getStatusIndex, statusLabels, trackingSteps, TrackedOrder, TrackingStatus } from '@/lib/order-tracking'
import { PAYMENT_METHOD_LABELS } from '@/lib/constants'

const getStatusColor = (status: TrackingStatus) => {
  switch (status) {
    case 'received':
    case 'delivered':
      return 'bg-green-100 text-green-800'
    case 'out_for_delivery':
      return 'bg-yellow-100 text-yellow-800'
    case 'preparing':
      return 'bg-blue-100 text-blue-800'
    case 'confirmed':
      return 'bg-indigo-100 text-indigo-800'
    default:
      return 'bg-slate-100 text-slate-800'
  }
}

const paymentLabel = (order: TrackedOrder) => {
  if (!order.payment) return 'غير محدد'
  if (order.payment.status === 'cash_on_delivery') return 'الدفع عند الاستلام'
  if (order.payment.status === 'receipt_uploaded') return 'إيصال مرفوع - بانتظار المراجعة'
  if (order.payment.status === 'paid') return 'مدفوع'
  return 'قيد الانتظار'
}

export default function DashboardOrdersPage() {
  const [orders, setOrders] = useState<TrackedOrder[]>([])

  useEffect(() => {
    fetch('/api/pos/orders')
      .then((response) => response.json())
      .then((data) => setOrders(Array.isArray(data.orders) ? data.orders : []))
      .catch(() => setOrders([]))
  }, [])

  const handleStatusChange = async (orderId: string, status: TrackingStatus) => {
    const response = await fetch('/api/pos/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orderId, status }),
    })
    if (!response.ok) return
    const data = await response.json()
    setOrders((current) => current.map((order) => (order.id === orderId ? data.order : order)))
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold">إدارة الطلبات</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          حدّث حالة الطلب من الإنشاء حتى التسليم والاستلام، وتابع حالة الدفع والإيصال.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>كل الطلبات</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px]">
              <thead>
                <tr className="border-b text-sm text-slate-500">
                  <th className="py-3 text-right font-semibold">رقم الطلب</th>
                  <th className="py-3 text-right font-semibold">العميل</th>
                  <th className="py-3 text-right font-semibold">المبلغ</th>
                  <th className="py-3 text-right font-semibold">الدفع</th>
                  <th className="py-3 text-right font-semibold">الحالة</th>
                  <th className="py-3 text-right font-semibold">تحديث الحالة</th>
                  <th className="py-3 text-right font-semibold">خط السير</th>
                  <th className="py-3 text-right font-semibold">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-slate-500">لا توجد طلبات بعد.</td></tr>
                )}
                {orders.map((order) => (
                  <tr key={order.id} className="border-b align-top hover:bg-slate-50 dark:hover:bg-slate-900">
                    <td className="py-4 font-semibold">{order.id}</td>
                    <td className="py-4">
                      <div className="font-medium">{order.customer}</div>
                      <div className="text-xs text-slate-500">{order.phone}</div>
                    </td>
                    <td className="py-4 font-semibold">{order.total.toFixed(2)} ج.م</td>
                    <td className="py-4">
                      <div className="text-sm font-medium">{paymentLabel(order)}</div>
                      <div className="text-xs text-slate-500">{order.payment?.method ? PAYMENT_METHOD_LABELS[order.payment.method as keyof typeof PAYMENT_METHOD_LABELS] || order.payment.method : '-'}</div>
                      {order.payment?.receiptDataUrl && (
                        <a href={order.payment.receiptDataUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-red-600">
                          عرض الإيصال
                        </a>
                      )}
                    </td>
                    <td className="py-4"><Badge className={getStatusColor(order.status)}>{statusLabels[order.status].ar}</Badge></td>
                    <td className="py-4">
                      <select value={order.status} onChange={(event) => handleStatusChange(order.id, event.target.value as TrackingStatus)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
                        {trackingSteps.map((step) => <option key={step.status} value={step.status}>{step.ar}</option>)}
                      </select>
                    </td>
                    <td className="py-4">
                      <div className="flex max-w-md flex-wrap gap-2">
                        {trackingSteps.map((step) => {
                          const active = getStatusIndex(step.status) <= getStatusIndex(order.status)
                          return <span key={step.status} className={`rounded-full px-2 py-1 text-xs ${active ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{step.ar}</span>
                        })}
                      </div>
                    </td>
                    <td className="py-4">
                      <Link href={`/track/${order.id}`}><Button variant="outline" size="sm">عرض التتبع</Button></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
