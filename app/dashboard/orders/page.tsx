'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CURRENCY, PAYMENT_METHOD_LABELS } from '@/lib/constants'
import { useAppStore } from '@/lib/app-store'
import { deleteTrackedOrder, getStatusIndex, statusLabels, trackingSteps, TrackedOrder, TrackingStatus } from '@/lib/order-tracking'

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
    case 'cancelled':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-slate-100 text-slate-800'
  }
}

const paymentLabel = (order: TrackedOrder) => {
  if (!order.payment) return 'غير محدد'
  if (order.payment.status === 'cash_on_delivery') return 'الدفع عند الاستلام'
  if (order.payment.status === 'receipt_uploaded') return 'إيصال مرفوع - بانتظار المراجعة'
  if (order.payment.status === 'paid') return 'مدفوع'
  if (order.payment.status === 'rejected') return 'إيصال مرفوض'
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
  const drivers = useAppStore((state) => state.drivers)
  const [orders, setOrders] = useState<TrackedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [pendingDriverOrder, setPendingDriverOrder] = useState<{ orderId: string; status: TrackingStatus } | null>(null)
  const [selectedDriverId, setSelectedDriverId] = useState('')

  const loadOrders = async () => {
    try {
      const response = await fetch('/api/pos/orders', { cache: 'no-store' })
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
    const interval = window.setInterval(loadOrders, 10000)
    return () => {
      window.clearTimeout(initialLoad)
      window.clearInterval(interval)
    }
  }, [])

  const patchOrder = async (body: Record<string, unknown>) => {
    const response = await fetch('/api/pos/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.message || data.error || 'تعذر تحديث الطلب')
    setOrders((current) => current.map((order) => (order.id === data.order.id ? data.order : order)))
    return data.order as TrackedOrder
  }

  const handleStatusChange = async (orderId: string, status: TrackingStatus, driverId?: string) => {
    if (status === 'out_for_delivery' && !driverId) {
      setPendingDriverOrder({ orderId, status })
      setSelectedDriverId(drivers.find((driver) => driver.status === 'active')?.id || drivers[0]?.id || '')
      return
    }

    setUpdatingId(orderId)
    setMessage('')
    const driver = drivers.find((item) => item.id === driverId)

    try {
      await patchOrder({
        id: orderId,
        status,
        driver: driver ? { name: driver.name, phone: driver.phone, rating: 0 } : undefined,
      })
      setMessage('تم تحديث حالة الطلب بنجاح.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر تحديث حالة الطلب.')
    } finally {
      setUpdatingId(null)
    }
  }

  const reviewReceipt = async (order: TrackedOrder, approved: boolean) => {
    setUpdatingId(order.id)
    setMessage('')
    try {
      await patchOrder({
        id: order.id,
        status: approved ? 'confirmed' : 'cancelled',
        paymentStatus: approved ? 'paid' : 'rejected',
      })
      setMessage(approved ? 'تم قبول الإيصال وبدأ تنفيذ الطلب.' : 'تم رفض الإيصال وإلغاء الطلب.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر مراجعة الإيصال.')
    } finally {
      setUpdatingId(null)
    }
  }

  const deleteOrder = async (orderId: string) => {
    setUpdatingId(orderId)
    setMessage('')
    try {
      const response = await fetch('/api/pos/orders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || data.error || 'تعذر حذف الطلب')
      setOrders((current) => current.filter((order) => order.id !== orderId))
      deleteTrackedOrder(orderId)
      setMessage('تم حذف الطلب نهائيًا من لوحة التحكم.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر حذف الطلب.')
    } finally {
      setUpdatingId(null)
    }
  }

  const confirmDriverAssignment = () => {
    if (!pendingDriverOrder || !selectedDriverId) {
      setMessage('اختر السائق قبل نقل الطلب إلى مرحلة التوصيل.')
      return
    }
    handleStatusChange(pendingDriverOrder.orderId, pendingDriverOrder.status, selectedDriverId)
    setPendingDriverOrder(null)
  }

  const timeline = (order: TrackedOrder) => (
    <div className="flex flex-wrap gap-1.5">
      {trackingSteps.map((step) => {
        const active = order.status === 'cancelled'
          ? step.status === 'cancelled'
          : getStatusIndex(step.status) <= getStatusIndex(order.status) && step.status !== 'cancelled'
        return (
          <span key={step.status} className={`rounded-full px-2 py-1 text-[11px] ${active ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
            {step.ar}
          </span>
        )
      })}
    </div>
  )

  const paymentActions = (order: TrackedOrder) => (
    order.payment?.receiptDataUrl ? (
      <div className="mt-2 flex flex-wrap gap-2">
        <a href={order.payment.receiptDataUrl} target="_blank" rel="noreferrer">
          <Button type="button" variant="outline" size="sm">فتح الصورة</Button>
        </a>
        {order.payment.status === 'receipt_uploaded' && (
          <>
            <Button type="button" size="sm" className="bg-green-600 hover:bg-green-700" disabled={updatingId === order.id} onClick={() => reviewReceipt(order, true)}>قبول</Button>
            <Button type="button" size="sm" variant="destructive" disabled={updatingId === order.id} onClick={() => reviewReceipt(order, false)}>رفض</Button>
          </>
        )}
      </div>
    ) : null
  )

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold">إدارة الطلبات</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          كل تغيير هنا يتم حفظه في السيرفر ويظهر للعميل في صفحة التتبع.
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
                        {paymentActions(order)}
                      </div>
                      {timeline(order)}
                      <div className="flex flex-col gap-2 pt-2">
                        <Link href={`/track/${order.id}`}><Button variant="outline" size="sm" className="w-full">عرض التتبع</Button></Link>
                        <StatusSelect order={order} disabled={updatingId === order.id} onChange={handleStatusChange} />
                        <Button variant="destructive" size="sm" disabled={updatingId === order.id} onClick={() => deleteOrder(order.id)}>حذف الطلب</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[1060px] table-fixed">
                  <thead>
                    <tr className="border-b text-sm text-slate-500">
                      <th className="w-[13%] py-3 text-right font-semibold">رقم الطلب</th>
                      <th className="w-[15%] py-3 text-right font-semibold">العميل</th>
                      <th className="w-[9%] py-3 text-right font-semibold">المبلغ</th>
                      <th className="w-[18%] py-3 text-right font-semibold">الدفع</th>
                      <th className="w-[11%] py-3 text-right font-semibold">الحالة</th>
                      <th className="w-[17%] py-3 text-right font-semibold">خط السير</th>
                      <th className="w-[8%] py-3 text-right font-semibold">التتبع</th>
                      <th className="w-[15%] py-3 text-right font-semibold">تغيير الحالة</th>
                      <th className="w-[8%] py-3 text-right font-semibold">حذف</th>
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
                          {paymentActions(order)}
                        </td>
                        <td className="py-4 pl-3"><Badge className={getStatusColor(order.status)}>{statusLabels[order.status].ar}</Badge></td>
                        <td className="py-4 pl-3">{timeline(order)}</td>
                        <td className="py-4 pl-3"><Link href={`/track/${order.id}`}><Button variant="outline" size="sm">عرض</Button></Link></td>
                        <td className="py-4"><StatusSelect order={order} disabled={updatingId === order.id} onChange={handleStatusChange} /></td>
                        <td className="py-4"><Button variant="destructive" size="sm" disabled={updatingId === order.id} onClick={() => deleteOrder(order.id)}>حذف</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {pendingDriverOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader><CardTitle>اختيار السائق</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                اختر المندوب الذي سيستلم الطلب. ستظهر بيانات الاتصال للعميل في صفحة التتبع.
              </p>
              {drivers.length === 0 ? (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  لا توجد أسماء سائقين. أضف السائقين من صفحة السائقين والتوصيل.
                </p>
              ) : (
                <select
                  value={selectedDriverId}
                  onChange={(event) => setSelectedDriverId(event.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name} - {driver.phone} {driver.status === 'inactive' ? '(غير نشط)' : ''}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex gap-2">
                <Button className="bg-red-600 hover:bg-red-700" disabled={!selectedDriverId || drivers.length === 0} onClick={confirmDriverAssignment}>تأكيد التعيين</Button>
                <Button variant="outline" onClick={() => setPendingDriverOrder(null)}>إلغاء</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
