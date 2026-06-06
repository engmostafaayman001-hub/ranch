'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/components/language-provider'
import { AppNotification, getReadNotificationIds, markNotificationsRead } from '@/lib/notifications'

const emptyForm = {
  title: '',
  message: '',
  code: '',
  discountType: 'percent',
  discountValue: '10',
  minSubtotal: '',
  expiresAt: '',
  active: true,
}

export default function DashboardNotificationsPage() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [readIds, setReadIds] = useState<string[]>([])
  const [form, setForm] = useState(emptyForm)

  const loadNotifications = async () => {
    const response = await fetch('/api/notifications', { cache: 'no-store' })
    const data = await response.json().catch(() => ({}))
    setNotifications(Array.isArray(data.notifications) ? data.notifications : [])
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setReadIds(getReadNotificationIds())
      loadNotifications().catch(() => setNotifications([]))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const closeForm = () => {
    setForm(emptyForm)
    setFormOpen(false)
  }

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
      setStatus(isArabic ? 'تم حفظ العرض وإرسال الإشعار للعملاء. كود الخصم أصبح فعالا.' : 'Offer saved and notification sent. The discount code is now active.')
      closeForm()
      await loadNotifications()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : (isArabic ? 'تعذر إرسال الإشعار.' : 'Could not send notification.'))
    } finally {
      setSending(false)
    }
  }

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code)
    setStatus(isArabic ? `تم نسخ الكود ${code}` : `Code ${code} copied`)
  }

  const markRead = (id: string) => {
    markNotificationsRead([id])
    setReadIds(getReadNotificationIds())
    setStatus(isArabic ? 'تم وضع الإشعار كمقروء.' : 'Notification marked as read.')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold">{isArabic ? 'الإشعارات والعروض' : 'Notifications & Offers'}</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {isArabic ? 'اعرض العروض المحفوظة وافتح نموذج إرسال عرض جديد عند الحاجة.' : 'View saved offers and open the send form only when needed.'}
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="bg-red-600 hover:bg-red-700">
          {isArabic ? 'إرسال عرض جديد' : 'Send New Offer'}
        </Button>
      </div>
      {status && <p className="rounded-md bg-slate-100 p-3 text-sm dark:bg-slate-900">{status}</p>}

      {formOpen && (
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
                <Field id="code" label={isArabic ? 'كود الخصم' : 'Discount Code'} value={form.code} onChange={(value) => setForm({ ...form, code: value.toUpperCase().replace(/\s+/g, '') })} />
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
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={sending} className="bg-red-600 hover:bg-red-700">{sending ? (isArabic ? 'جاري الإرسال...' : 'Sending...') : (isArabic ? 'إرسال للجميع' : 'Send to Customers')}</Button>
                <Button type="button" variant="outline" onClick={closeForm}>{isArabic ? 'إلغاء' : 'Cancel'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{isArabic ? 'العروض المحفوظة' : 'Saved Offers'}</CardTitle></CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="py-8 text-center text-slate-500">{isArabic ? 'لا توجد عروض أو إشعارات محفوظة بعد.' : 'No saved offers or notifications yet.'}</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => {
                const isRead = readIds.includes(notification.id)
                return (
                <div key={notification.id} className={`rounded-md border p-4 dark:border-slate-800 ${isRead ? 'bg-slate-50/70 dark:bg-slate-900/40' : 'bg-white dark:bg-slate-950'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{notification.title}</p>
                        {isRead && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{isArabic ? 'مقروء' : 'Read'}</span>}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{notification.message}</p>
                      <p className="mt-2 text-xs text-slate-500">{new Date(notification.createdAt).toLocaleString(isArabic ? 'ar-EG' : 'en-US')}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!isRead && (
                        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => markRead(notification.id)}>
                          <Check className="h-4 w-4" />
                          {isArabic ? 'كمقروء' : 'Mark read'}
                        </Button>
                      )}
                      {notification.code && (
                        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => copyCode(notification.code!)}>
                          <Copy className="h-4 w-4" />
                          {notification.code}
                        </Button>
                      )}
                    </div>
                  </div>
                  {notification.code && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>{isArabic ? 'الحالة' : 'Status'}: {notification.active !== false ? (isArabic ? 'فعال' : 'Active') : (isArabic ? 'غير فعال' : 'Inactive')}</span>
                      <span>{isArabic ? 'الخصم' : 'Discount'}: {notification.discountValue}{notification.discountType === 'fixed' ? '' : '%'}</span>
                      {notification.expiresAt && <span>{isArabic ? 'ينتهي' : 'Expires'}: {notification.expiresAt}</span>}
                    </div>
                  )}
                </div>
              )})}
            </div>
          )}
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
