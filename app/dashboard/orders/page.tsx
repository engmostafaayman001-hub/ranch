'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CURRENCY, PAYMENT_METHOD_LABELS } from '@/lib/constants'
import { getStatusIndex, statusLabels, trackingSteps, TrackedOrder, TrackingStatus } from '@/lib/order-tracking'

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

function StatusSelect({
  order,
  disabled,
  onChange,
}: {
  order: TrackedOrder
  disabled: boolean
  onChange: (orderId: string, status: TrackingStatus) => void
}) {
  return (
    <select
      value={order.status}
      disabled={disabled}
      onChange={(event) => onChange(order.id, event.target.value as TrackingStatus)}
      className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 sm:w-52"
    >
      {trackingSteps.map((step) => (
        <option key={step.status} value={step.status}>{step.ar}</option>
      ))}
    </select>
  )
}

export default function DashboardOrdersPage() {
  const [orders, setOrders] = useState<TrackedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const loadOrders = async () => {
    try {
      const response = await fetch('/api/pos/orders')
      const data = await response.json().catch(() => ({}))
      setOrders(Array.isArray(data.orders) ? data.orders : [])
    } catch {
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(loadOrders, 0)
    const interval = window.setInterval(loadOrders, 15000)
    return () => {
      window.clearTimeout(initialLoad)
      window.clearInterval(interval)
    }
  }, [])

  const handleStatusChange = async (orderId: string, status: TrackingStatus) => {
    setUpdatingId(orderId)
    setMessage('')

    try {
      const response = await fetch('/api/pos/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.message || data.error || 'تعذر تحديث حالة الطلب')
      }

      setOrders((current) => current.map((order) => (order.id === orderId ? data.order : order)))
      setMessage('تم تحديث حالة الطلب بنجاح.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر تحديث حالة الطلب.')
    } finally {
      setUpdatingId(null)
    }
  }

  const timeline = (order: TrackedOrder) => (
    <div className="flex flex-wrap gap-1.5">
      {trackingSteps.map((step) => {
        const active = getStatusIndex(step.status) <= getStatusIndex(order.status)
        return (
          <span key={step.status} className={`rounded-full px-2 py-1 text-[11px] ${active ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
            {step.ar}
          </span>
        )
      })}
    </div>
  )

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold">إدارة الطلبات</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          تابع الطلبات الحقيقية وحدّث الحالة من آخر الجدول أو من نظام POS عبر API.
        </p>
        {message && <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">{message}</p>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>كل الطلبات</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-slate-500">جاري تحميل الطلبات...</p>
          ) : orders.length === 0 ? (
            <p className="py-8 text-center text-slate-500">لا توجد طلبات بعد.</p>
          ) : (
            <>
              <div className="space-y-4 md:hidden">
                {orders.map((order) => (
                  <div key={order.id} className="rounded-lg border p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold">{order.id}</p>
                        <p className="text-sm text-slate-500">{order.customer}</p>
                        <p className="text-xs text-slate-500">{order.phone || 'بدون رقم'}</p>
                      </div>
                      <Badge className={getStatusColor(order.status)}>{statusLabels[order.status].ar}</Badge>
                    </div>
                    <div className="grid gap-3 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500">المبلغ</span>
                        <span className="font-semibold">{Number(order.total || 0).toFixed(2)} {CURRENCY}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">الدفع</span>
                        <p className="mt-1 font-medium">{paymentLabel(order)}</p>
                        <p className="text-xs text-slate-500">{order.payment?.method ? PAYMENT_METHOD_LABELS[order.payment.method as keyof typeof PAYMENT_METHOD_LABELS] || order.payment.method : '-'}</p>
                      </div>
                      {timeline(order)}
                      <div className="flex flex-col gap-2 pt-2">
                        <Link href={`/track/${order.id}`}>
                          <Button variant="outline" size="sm" className="w-full">عرض التتبع</Button>
                        </Link>
                        <StatusSelect order={order} disabled={updatingId === order.id} onChange={handleStatusChange} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[980px] table-fixed">
                  <thead>
                    <tr className="border-b text-sm text-slate-500">
                      <th className="w-[14%] py-3 text-right font-semibold">رقم الطلب</th>
                      <th className="w-[18%] py-3 text-right font-semibold">العميل</th>
                      <th className="w-[10%] py-3 text-right font-semibold">المبلغ</th>
                      <th className="w-[18%] py-3 text-right font-semibold">الدفع</th>
                      <th className="w-[12%] py-3 text-right font-semibold">الحالة</th>
                      <th className="w-[18%] py-3 text-right font-semibold">خط السير</th>
                      <th className="w-[10%] py-3 text-right font-semibold">التتبع</th>
                      <th className="w-[16%] py-3 text-right font-semibold">تغيير الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-b align-top hover:bg-slate-50 dark:hover:bg-slate-900">
                        <td className="break-words py-4 pl-3 font-semibold">{order.id}</td>
                        <td className="py-4 pl-3">
                          <div className="font-medium">{order.customer}</div>
                          <div className="text-xs text-slate-500">{order.phone || 'بدون رقم'}</div>
                        </td>
                        <td className="py-4 pl-3 font-semibold">{Number(order.total || 0).toFixed(2)} {CURRENCY}</td>
                        <td className="py-4 pl-3">
                          <div className="text-sm font-medium">{paymentLabel(order)}</div>
                          <div className="text-xs text-slate-500">{order.payment?.method ? PAYMENT_METHOD_LABELS[order.payment.method as keyof typeof PAYMENT_METHOD_LABELS] || order.payment.method : '-'}</div>
                          {order.payment?.receiptDataUrl && (
                            <a href={order.payment.receiptDataUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-red-600">
                              عرض الإيصال
                            </a>
                          )}
                        </td>
                        <td className="py-4 pl-3">
                          <Badge className={getStatusColor(order.status)}>{statusLabels[order.status].ar}</Badge>
                        </td>
                        <td className="py-4 pl-3">{timeline(order)}</td>
                        <td className="py-4 pl-3">
                          <Link href={`/track/${order.id}`}>
                            <Button variant="outline" size="sm">عرض</Button>
                          </Link>
                        </td>
                        <td className="py-4">
                          <StatusSelect order={order} disabled={updatingId === order.id} onChange={handleStatusChange} />
                        </td>
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
