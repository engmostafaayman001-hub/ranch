'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function DashboardPosPage() {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
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
    setLoading(true)

    try {
      const response = await fetch('/api/pos/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'dashboard-pos',
          customer: form.customer,
          phone: form.phone,
          address: form.address,
          total: Number(form.total),
          items: Number(form.items),
          status: 'placed',
          payment: {
            method: 'cash',
            status: 'cash_on_delivery',
          },
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.message || data.error || 'تعذر إرسال الطلب')
      }

      setMessage(`تم إرسال الطلب إلى النظام بنجاح: ${data.order?.id || ''}`)
      setForm({ customer: '', phone: '', address: '', total: '', items: '1' })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر إرسال الطلب.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="mb-8 text-3xl font-bold">نقطة البيع</h2>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>إرسال طلب تجريبي إلى النظام</CardTitle>
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
                <Input id="total" type="number" min="0" step="0.01" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="items">عدد المنتجات</Label>
                <Input id="items" type="number" min="1" value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value })} required />
              </div>
              <div className="md:col-span-2">
                <Button disabled={loading} className="bg-red-600 hover:bg-red-700">
                  {loading ? 'جاري الإرسال...' : 'إرسال الطلب'}
                </Button>
              </div>
              {message && <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200 md:col-span-2">{message}</p>}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>إعداد ربط POS الخارجي</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-slate-600 dark:text-slate-400">
              ضع مفاتيح الربط في متغير البيئة <span className="font-semibold">RANCH_POS_API_KEYS</span> أو <span className="font-semibold">POS_API_KEYS</span>، وافصل أكثر من مفتاح بفاصلة.
            </p>
            <code className="block overflow-x-auto rounded bg-slate-100 p-3 dark:bg-slate-900">
              X-POS-API-Key: your-secret-key
            </code>
            <code className="block overflow-x-auto rounded bg-slate-100 p-3 dark:bg-slate-900">
              {`PATCH /api/pos/orders { "orderId": "ORD123", "status": "preparing" }`}
            </code>
            <p className="text-slate-500">
              يقبل النظام أيضا حالات شائعة من أنظمة POS مثل accepted, cooking, ready, dispatched, completed ويحوّلها تلقائيا لحالة تتبع مناسبة.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
