'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AppNotification } from '@/lib/notifications'

export default function DashboardNotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [form, setForm] = useState({
    title: '',
    message: '',
    code: '',
    discountType: 'percent',
    discountValue: '10',
    minSubtotal: '',
    active: true,
    expiresAt: '',
  })
  const [status, setStatus] = useState('')
  const [sending, setSending] = useState(false)

  const loadNotifications = async () => {
    const response = await fetch('/api/notifications', { cache: 'no-store' })
    if (!response.ok) return
    const data = await response.json()
    setNotifications(Array.isArray(data.notifications) ? data.notifications : [])
  }

  useEffect(() => {
    queueMicrotask(() => {
      loadNotifications().catch(() => {})
    })
  }, [])

  const sendNotification = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus('')
    setSending(true)

    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.error || 'Notification failed')
      }

      setForm({ title: '', message: '', code: '', discountType: 'percent', discountValue: '10', minSubtotal: '', active: true, expiresAt: '' })
      setStatus('تم إرسال الإشعار إلى العملاء بنجاح.')
      await loadNotifications()
    } catch (error) {
      setStatus(error instanceof Error ? `تعذر إرسال الإشعار: ${error.message}` : 'تعذر إرسال الإشعار. حاول مرة أخرى.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">الإشعارات والعروض</h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          أرسل عرضًا أو كود خصم ليظهر للعملاء في جرس الإشعارات وصفحة الإشعارات.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader><CardTitle>إرسال إشعار جديد</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={sendNotification} className="space-y-4">
              <div>
                <Label htmlFor="title">عنوان الإشعار</Label>
                <Input id="title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="عرض خاص اليوم" required />
              </div>
              <div>
                <Label htmlFor="message">نص الإشعار</Label>
                <Textarea id="message" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="استخدم الكود واحصل على خصم على طلبك القادم" required />
              </div>
              <div>
                <Label htmlFor="code">كود الخصم</Label>
                <Input id="code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="RANCH20" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="discountType">نوع الخصم</Label>
                  <select id="discountType" value={form.discountType} onChange={(event) => setForm({ ...form, discountType: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950">
                    <option value="percent">نسبة مئوية</option>
                    <option value="fixed">مبلغ ثابت</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="discountValue">قيمة الخصم</Label>
                  <Input id="discountValue" type="number" min="0" step="0.01" value={form.discountValue} onChange={(event) => setForm({ ...form, discountValue: event.target.value })} placeholder="10" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="minSubtotal">حد أدنى للطلب</Label>
                  <Input id="minSubtotal" type="number" min="0" step="0.01" value={form.minSubtotal} onChange={(event) => setForm({ ...form, minSubtotal: event.target.value })} placeholder="0" />
                </div>
                <div>
                  <Label htmlFor="expiresAt">تاريخ الانتهاء</Label>
                  <Input id="expiresAt" type="date" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
                الكود فعال
              </label>
              <Button disabled={sending} className="bg-red-600 hover:bg-red-700">
                {sending ? 'جاري الإرسال...' : 'إرسال لجميع العملاء'}
              </Button>
              {status && <p className="text-sm text-slate-600 dark:text-slate-400">{status}</p>}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>آخر الإشعارات</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-500">لا توجد إشعارات مرسلة بعد.</p>
            ) : (
              notifications.slice(0, 8).map((notification) => (
                <div key={notification.id} className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{notification.title}</p>
                    {notification.code && <span className="rounded bg-red-600 px-2 py-1 text-xs text-white">{notification.code}</span>}
                  </div>
                  {notification.code && (
                    <p className="mt-1 text-xs font-semibold text-green-700 dark:text-green-300">
                      {notification.active === false ? 'غير فعال' : 'فعال'} - {notification.discountType === 'fixed' ? `${Number(notification.discountValue || 10).toFixed(2)} ج.م` : `${Number(notification.discountValue || 10)}%`}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{notification.message}</p>
                  <p className="mt-2 text-xs text-slate-500">{new Date(notification.createdAt).toLocaleString('ar-EG')}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
