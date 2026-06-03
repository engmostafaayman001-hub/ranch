'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DeliveryDriver, useAppStore } from '@/lib/app-store'
import { TrackedOrder } from '@/lib/order-tracking'

const emptyDriver: Omit<DeliveryDriver, 'id'> = {
  name: '',
  phone: '',
  area: '',
  status: 'active',
}

export default function DashboardDeliveryPage() {
  const { drivers, addDriver, updateDriver, deleteDriver } = useAppStore()
  const [form, setForm] = useState(emptyDriver)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [orders, setOrders] = useState<TrackedOrder[]>([])

  useEffect(() => {
    const loadOrders = async () => {
      const response = await fetch('/api/pos/orders')
      const data = await response.json().catch(() => ({}))
      setOrders(Array.isArray(data.orders) ? data.orders : [])
    }
    const timer = window.setTimeout(loadOrders, 0)
    const interval = window.setInterval(loadOrders, 15000)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(interval)
    }
  }, [])

  const submitDriver = (event: FormEvent) => {
    event.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) return

    if (editingId) {
      updateDriver(editingId, form)
    } else {
      addDriver(form)
    }

    setEditingId(null)
    setForm(emptyDriver)
  }

  const editDriver = (driver: DeliveryDriver) => {
    setEditingId(driver.id)
    setForm({ name: driver.name, phone: driver.phone, area: driver.area, status: driver.status })
  }

  const activeDeliveryOrders = orders.filter((order) => ['out_for_delivery', 'delivered'].includes(order.status))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">السائقون والتوصيل</h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          أضف المندوبين وحدد بيانات الاتصال التي ستظهر للعميل عند تعيين السائق في إدارة الطلبات.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? 'تعديل بيانات سائق' : 'إضافة سائق'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitDriver} className="grid gap-4 md:grid-cols-4">
            <div>
              <Label htmlFor="driver-name">اسم السائق</Label>
              <Input id="driver-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </div>
            <div>
              <Label htmlFor="driver-phone">رقم الهاتف</Label>
              <Input id="driver-phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
            </div>
            <div>
              <Label htmlFor="driver-area">المنطقة</Label>
              <Input id="driver-area" value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })} placeholder="القاهرة الجديدة" />
            </div>
            <div>
              <Label htmlFor="driver-status">الحالة</Label>
              <select id="driver-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as 'active' | 'inactive' })} className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950">
                <option value="active">نشط</option>
                <option value="inactive">غير نشط</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2 md:col-span-4">
              <Button type="submit" className="bg-red-600 hover:bg-red-700">{editingId ? 'حفظ التعديل' : 'إضافة السائق'}</Button>
              {editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(emptyDriver) }}>إلغاء</Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>قائمة السائقين</CardTitle>
            <Badge>{drivers.length} سائق</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {drivers.length === 0 ? (
              <p className="py-10 text-center text-slate-500">لا يوجد سائقون محفوظون بعد.</p>
            ) : (
              drivers.map((driver) => (
                <div key={driver.id} className="grid gap-4 rounded-md border border-slate-200 p-4 dark:border-slate-800 md:grid-cols-[1fr_auto]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{driver.name}</h3>
                      <Badge className={driver.status === 'active' ? 'bg-green-600' : 'bg-slate-500'}>{driver.status === 'active' ? 'نشط' : 'غير نشط'}</Badge>
                    </div>
                    <p className="text-sm text-slate-500">{driver.phone}</p>
                    <p className="mt-1 text-sm font-semibold text-red-600">{driver.area || 'بدون منطقة محددة'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => editDriver(driver)}>تعديل</Button>
                    <Button size="sm" variant="outline" onClick={() => updateDriver(driver.id, { status: driver.status === 'active' ? 'inactive' : 'active' })}>
                      {driver.status === 'active' ? 'تعطيل' : 'تفعيل'}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteDriver(driver.id)}>حذف</Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>طلبات التوصيل الحالية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeDeliveryOrders.length === 0 ? (
              <p className="py-10 text-center text-slate-500">لا توجد رحلات توصيل نشطة بعد.</p>
            ) : (
              activeDeliveryOrders.map((order) => (
                <div key={order.id} className="rounded-md border p-4">
                  <p className="font-bold">{order.id}</p>
                  <p className="text-sm text-slate-500">{order.customer} - {order.phone}</p>
                  <p className="mt-2 text-sm">السائق: <span className="font-semibold">{order.driver.name}</span></p>
                  <p className="text-sm text-slate-500">{order.driver.phone}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
