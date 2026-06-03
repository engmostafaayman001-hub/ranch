'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function DashboardPosPage() {
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    customer: '',
    phone: '',
    address: '',
    total: '',
    items: '1',
  })

  const submitOrder = async (event: React.FormEvent) => {
    event.preventDefault()
    setMessage('')

    const response = await fetch('/api/pos/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: form.customer,
        phone: form.phone,
        address: form.address,
        total: Number(form.total),
        items: Number(form.items),
        status: 'placed',
      }),
    })

    setMessage(response.ok ? 'تم إرسال الطلب إلى النظام.' : 'تعذر إرسال الطلب.')
  }

  return (
    <div>
      <h2 className="mb-8 text-3xl font-bold">نقطة البيع</h2>
      <Card>
        <CardHeader>
          <CardTitle>إرسال طلب إلى النظام</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitOrder} className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="customer">اسم العميل</Label>
              <Input id="customer" value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="phone">الهاتف</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="address">العنوان</Label>
              <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="total">الإجمالي</Label>
              <Input id="total" type="number" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="items">عدد المنتجات</Label>
              <Input id="items" type="number" value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value })} required />
            </div>
            <div className="md:col-span-2">
              <Button className="bg-red-600 hover:bg-red-700">إرسال الطلب</Button>
            </div>
            {message && <p className="md:col-span-2 text-sm text-slate-600">{message}</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
