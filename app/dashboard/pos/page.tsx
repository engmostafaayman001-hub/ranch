'use client'

import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLanguage } from '@/components/language-provider'

export default function DashboardPosPage() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ customer: '', phone: '', address: '', total: '0', items: '1' })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const response = await fetch('/api/pos/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `POS${Date.now()}`,
          customer: form.customer,
          phone: form.phone,
          address: form.address,
          total: Number(form.total),
          items: Number(form.items),
          status: 'placed',
          createdAt: new Date().toISOString(),
          estimatedDelivery: isArabic ? '30 دقيقة' : '30 min',
          driver: { name: 'Pending assignment', phone: '-', rating: 0 },
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || data.error || 'Could not send order')
      setMessage(isArabic ? `تم إرسال الطلب إلى النظام بنجاح: ${data.order?.id || ''}` : `Order sent successfully: ${data.order?.id || ''}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (isArabic ? 'تعذر إرسال الطلب.' : 'Could not send order.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>{isArabic ? 'إرسال طلب تجريبي إلى النظام' : 'Send Test Order to System'}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <Field id="customer" label={isArabic ? 'اسم العميل' : 'Customer Name'} value={form.customer} onChange={(value) => setForm({ ...form, customer: value })} />
            <Field id="phone" label={isArabic ? 'الهاتف' : 'Phone'} value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
            <Field id="address" label={isArabic ? 'العنوان' : 'Address'} value={form.address} onChange={(value) => setForm({ ...form, address: value })} />
            <Field id="total" label={isArabic ? 'الإجمالي' : 'Total'} value={form.total} onChange={(value) => setForm({ ...form, total: value })} type="number" />
            <Field id="items" label={isArabic ? 'عدد المنتجات' : 'Item Count'} value={form.items} onChange={(value) => setForm({ ...form, items: value })} type="number" />
            <Button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700">{loading ? (isArabic ? 'جاري الإرسال...' : 'Sending...') : (isArabic ? 'إرسال الطلب' : 'Send Order')}</Button>
            {message && <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p>}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{isArabic ? 'إعداد ربط POS الخارجي' : 'External POS Setup'}</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
          <p>{isArabic ? 'ضع مفاتيح الربط في متغير البيئة RANCH_POS_API_KEYS أو POS_API_KEYS وافصل أكثر من مفتاح بفاصلة.' : 'Put integration keys in RANCH_POS_API_KEYS or POS_API_KEYS, separated by commas.'}</p>
          <code className="block rounded bg-slate-100 p-3 dark:bg-slate-900">POST /api/pos/orders</code>
          <code className="block rounded bg-slate-100 p-3 dark:bg-slate-900">PATCH /api/pos/orders</code>
          <p>{isArabic ? 'يقبل النظام حالات POS الشائعة ويحولها تلقائيًا إلى حالات تتبع مناسبة.' : 'The system accepts common POS statuses and maps them to tracking statuses automatically.'}</p>
        </CardContent>
      </Card>
    </div>
  )
}

function Field({ id, label, value, onChange, type = 'text' }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}
