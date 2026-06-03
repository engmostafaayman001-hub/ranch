'use client'

import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/components/language-provider'

export default function DashboardNotificationsPage() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState('')
  const [form, setForm] = useState({
    title: '',
    message: '',
    code: '',
    discountType: 'percent',
    discountValue: '10',
    minSubtotal: '',
    expiresAt: '',
    active: true,
  })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSending(true)
    setStatus('')
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          discountValue: Number(form.discountValue || 0),
          minSubtotal: form.minSubtotal ? Number(form.minSubtotal) : undefined,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || data.error || 'Could not send notification')
      setStatus(isArabic ? 'تم إرسال الإشعار إلى العملاء بنجاح.' : 'Notification sent to customers successfully.')
      setForm({ title: '', message: '', code: '', discountType: 'percent', discountValue: '10', minSubtotal: '', expiresAt: '', active: true })
    } catch (error) {
      setStatus(error instanceof Error ? error.message : (isArabic ? 'تعذر إرسال الإشعار.' : 'Could not send notification.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">{isArabic ? 'الإشعارات والعروض' : 'Notifications & Offers'}</h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">{isArabic ? 'أرسل عرضًا أو كود خصم ليظهر للعملاء ويصبح صالحًا للاستخدام.' : 'Send an offer or discount code that customers can use.'}</p>
      </div>
      {status && <p className="rounded-md bg-slate-100 p-3 text-sm dark:bg-slate-900">{status}</p>}
      <Card>
        <CardHeader><CardTitle>{isArabic ? 'إرسال إشعار جديد' : 'Send New Notification'}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="title">{isArabic ? 'العنوان' : 'Title'}</Label>
              <Input id="title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder={isArabic ? 'عرض خاص اليوم' : 'Special offer today'} required />
            </div>
            <div>
              <Label htmlFor="message">{isArabic ? 'نص الإشعار' : 'Message'}</Label>
              <Textarea id="message" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder={isArabic ? 'استخدم الكود واحصل على خصم على طلبك القادم' : 'Use the code and get a discount on your next order'} required />
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <Field id="code" label={isArabic ? 'كود الخصم' : 'Discount Code'} value={form.code} onChange={(value) => setForm({ ...form, code: value.toUpperCase() })} />
              <div>
                <Label htmlFor="discountType">{isArabic ? 'نوع الخصم' : 'Discount Type'}</Label>
                <select id="discountType" value={form.discountType} onChange={(event) => setForm({ ...form, discountType: event.target.value })} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
                  <option value="percent">{isArabic ? 'نسبة' : 'Percent'}</option>
                  <option value="fixed">{isArabic ? 'قيمة ثابتة' : 'Fixed'}</option>
                </select>
              </div>
              <Field id="discountValue" label={isArabic ? 'قيمة الخصم' : 'Discount Value'} value={form.discountValue} onChange={(value) => setForm({ ...form, discountValue: value })} type="number" />
              <Field id="minSubtotal" label={isArabic ? 'حد أدنى للطلب' : 'Minimum Order'} value={form.minSubtotal} onChange={(value) => setForm({ ...form, minSubtotal: value })} type="number" />
            </div>
            <Field id="expiresAt" label={isArabic ? 'تاريخ الانتهاء' : 'Expiry Date'} value={form.expiresAt} onChange={(value) => setForm({ ...form, expiresAt: value })} type="date" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
              {isArabic ? 'الكود فعال' : 'Code is active'}
            </label>
            <Button type="submit" disabled={sending} className="bg-red-600 hover:bg-red-700">{sending ? (isArabic ? 'جاري الإرسال...' : 'Sending...') : (isArabic ? 'إرسال للجميع' : 'Send to Customers')}</Button>
          </form>
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
