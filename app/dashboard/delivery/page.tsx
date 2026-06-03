'use client'

import { FormEvent, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLanguage } from '@/components/language-provider'
import { useAppStore } from '@/lib/app-store'

export default function DashboardDeliveryPage() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const { drivers, addDriver, updateDriver, deleteDriver } = useAppStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', area: '', status: 'active' as 'active' | 'inactive' })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) return
    if (editingId) updateDriver(editingId, form)
    else addDriver(form)
    setEditingId(null)
    setForm({ name: '', phone: '', area: '', status: 'active' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">{isArabic ? 'السائقون والتوصيل' : 'Drivers & Delivery'}</h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">{isArabic ? 'أضف المندوبين وحدد بيانات الاتصال التي ستظهر للعميل.' : 'Add drivers and contact details shown to customers.'}</p>
      </div>

      <Card>
        <CardHeader><CardTitle>{editingId ? (isArabic ? 'تعديل سائق' : 'Edit Driver') : (isArabic ? 'إضافة سائق' : 'Add Driver')}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-4">
            <Field id="driver-name" label={isArabic ? 'اسم السائق' : 'Driver Name'} value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
            <Field id="driver-phone" label={isArabic ? 'الهاتف' : 'Phone'} value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
            <Field id="driver-area" label={isArabic ? 'المنطقة' : 'Area'} value={form.area} onChange={(value) => setForm({ ...form, area: value })} />
            <div className="flex items-end">
              <Button type="submit" className="w-full bg-red-600 hover:bg-red-700">{editingId ? (isArabic ? 'حفظ' : 'Save') : (isArabic ? 'إضافة' : 'Add')}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{isArabic ? 'قائمة السائقين' : 'Driver List'}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {drivers.length === 0 ? <p className="py-8 text-center text-slate-500">{isArabic ? 'لا يوجد سائقون بعد.' : 'No drivers yet.'}</p> : drivers.map((driver) => (
            <div key={driver.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 dark:border-slate-800">
              <div>
                <p className="font-semibold">{driver.name}</p>
                <p className="text-sm text-slate-500">{driver.phone} - {driver.area}</p>
                <Badge className={driver.status === 'active' ? 'bg-green-600' : 'bg-slate-500'}>{driver.status === 'active' ? (isArabic ? 'نشط' : 'Active') : (isArabic ? 'غير نشط' : 'Inactive')}</Badge>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setEditingId(driver.id); setForm({ name: driver.name, phone: driver.phone, area: driver.area, status: driver.status }) }}>{isArabic ? 'تعديل' : 'Edit'}</Button>
                <Button size="sm" variant="destructive" onClick={() => deleteDriver(driver.id)}>{isArabic ? 'حذف' : 'Delete'}</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function Field({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}
