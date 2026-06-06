'use client'

import { FormEvent, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLanguage } from '@/components/language-provider'
import { DeliveryDriver, useAppStore } from '@/lib/app-store'
import { saveSharedDrivers, useSharedAppData } from '@/lib/use-shared-app-data'

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export default function DashboardDeliveryPage() {
  useSharedAppData()
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const { drivers, setDrivers } = useAppStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', area: '', status: 'active' as 'active' | 'inactive' })
  const [saveStatus, setSaveStatus] = useState('')
  const [saving, setSaving] = useState(false)

  const publishDrivers = async (nextDrivers: DeliveryDriver[]) => {
    setDrivers(nextDrivers)
    setSaving(true)
    setSaveStatus('')

    try {
      const data = await saveSharedDrivers(nextDrivers)
      setDrivers(data.drivers || nextDrivers)
      setSaveStatus(isArabic ? 'تم حفظ السائقين وظهورهم لجميع أجهزة لوحة التحكم.' : 'Drivers saved and published to all dashboard devices.')
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : (isArabic ? 'تم حفظ التغيير محليا فقط.' : 'Changes were saved locally only.'))
    } finally {
      setSaving(false)
      window.setTimeout(() => setSaveStatus(''), 3000)
    }
  }

  const closeForm = () => {
    setEditingId(null)
    setForm({ name: '', email: '', phone: '', area: '', status: 'active' })
    setFormOpen(false)
  }

  const openNewDriver = () => {
    setEditingId(null)
    setForm({ name: '', email: '', phone: '', area: '', status: 'active' })
    setFormOpen(true)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) return

    if (editingId) {
      publishDrivers(drivers.map((driver) => (driver.id === editingId ? { ...driver, ...form } : driver)))
    } else {
      publishDrivers([...drivers, { ...form, id: createId('driver') }])
    }
    closeForm()
  }

  const editDriver = (driver: DeliveryDriver) => {
    setEditingId(driver.id)
    setForm({
      name: driver.name,
      email: driver.email || '',
      phone: driver.phone,
      area: driver.area,
      status: driver.status,
    })
    setFormOpen(true)
  }

  const toggleDriverStatus = (driver: DeliveryDriver) => {
    publishDrivers(drivers.map((item) => (
      item.id === driver.id
        ? { ...item, status: item.status === 'active' ? 'inactive' : 'active' }
        : item
    )))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold">{isArabic ? 'السائقون والتوصيل' : 'Drivers & Delivery'}</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {isArabic ? 'أدر بيانات السائقين واحفظها لكل أجهزة لوحة التحكم. التعطيل يخفي السائق من التعيين دون حذف بياناته.' : 'Manage drivers across all dashboard devices. Deactivation removes a driver from assignment without deleting their data.'}
          </p>
          {saveStatus && <p className="mt-2 text-sm font-medium text-green-600">{saveStatus}</p>}
        </div>
        <Button onClick={openNewDriver} disabled={saving} className="bg-red-600 hover:bg-red-700">
          {isArabic ? 'إضافة سائق' : 'Add Driver'}
        </Button>
      </div>

      {formOpen && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? (isArabic ? 'تعديل سائق' : 'Edit Driver') : (isArabic ? 'إضافة سائق' : 'Add Driver')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-4 md:grid-cols-6">
              <Field id="driver-name" label={isArabic ? 'اسم السائق' : 'Driver Name'} value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
              <Field id="driver-email" label={isArabic ? 'بريد حساب السائق' : 'Driver Account Email'} value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
              <Field id="driver-phone" label={isArabic ? 'الهاتف' : 'Phone'} value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
              <Field id="driver-area" label={isArabic ? 'المنطقة' : 'Area'} value={form.area} onChange={(value) => setForm({ ...form, area: value })} />
              <div>
                <Label htmlFor="driver-status">{isArabic ? 'الحالة' : 'Status'}</Label>
                <select
                  id="driver-status"
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value as 'active' | 'inactive' })}
                  className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                >
                  <option value="active">{isArabic ? 'نشط' : 'Active'}</option>
                  <option value="inactive">{isArabic ? 'غير نشط' : 'Inactive'}</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={saving} className="flex-1 bg-red-600 hover:bg-red-700">
                  {editingId ? (isArabic ? 'حفظ' : 'Save') : (isArabic ? 'إضافة' : 'Add')}
                </Button>
                <Button type="button" variant="outline" onClick={closeForm}>{isArabic ? 'إلغاء' : 'Cancel'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{isArabic ? 'قائمة السائقين' : 'Driver List'}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {drivers.length === 0 ? (
            <p className="py-8 text-center text-slate-500">{isArabic ? 'لا يوجد سائقون بعد.' : 'No drivers yet.'}</p>
          ) : drivers.map((driver) => (
            <div key={driver.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 dark:border-slate-800">
              <div>
                <p className="font-semibold">{driver.name}</p>
                <p className="text-sm text-slate-500">{driver.phone} - {driver.email || (isArabic ? 'بدون بريد' : 'No email')} - {driver.area}</p>
                <Badge className={driver.status === 'active' ? 'bg-green-600' : 'bg-slate-500'}>
                  {driver.status === 'active' ? (isArabic ? 'نشط' : 'Active') : (isArabic ? 'غير نشط' : 'Inactive')}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => editDriver(driver)}>{isArabic ? 'تعديل' : 'Edit'}</Button>
                <Button size="sm" variant="outline" disabled={saving} onClick={() => toggleDriverStatus(driver)}>
                  {driver.status === 'active' ? (isArabic ? 'تعطيل' : 'Deactivate') : (isArabic ? 'إعادة تفعيل' : 'Reactivate')}
                </Button>
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
