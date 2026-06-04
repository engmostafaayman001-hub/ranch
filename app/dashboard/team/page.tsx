'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLanguage } from '@/components/language-provider'

type TeamMember = {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'inactive'
}

export default function DashboardTeamPage() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'support', status: 'active' as 'active' | 'inactive' })

  const loadTeam = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/team', { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      setTeam(Array.isArray(data.members) ? data.members : Array.isArray(data.team) ? data.team : [])
    } catch {
      setTeam([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(loadTeam, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const closeForm = () => {
    setEditingId(null)
    setForm({ name: '', email: '', role: 'support', status: 'active' })
    setFormOpen(false)
  }

  const openNewMember = () => {
    setEditingId(null)
    setForm({ name: '', email: '', role: 'support', status: 'active' })
    setFormOpen(true)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const response = await fetch('/api/team', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { id: editingId, ...form } : form),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || data.error || 'Could not save member')
      setMessage(editingId ? (isArabic ? 'تم حفظ تعديل العضو.' : 'Member updated.') : (isArabic ? 'تمت إضافة العضو وتفعيل صلاحياته.' : 'Member added and permissions enabled.'))
      closeForm()
      loadTeam()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (isArabic ? 'تعذر حفظ العضو.' : 'Could not save member.'))
    } finally {
      setLoading(false)
    }
  }

  const edit = (member: TeamMember) => {
    setEditingId(member.id)
    setForm({ name: member.name, email: member.email, role: member.role, status: member.status })
    setFormOpen(true)
  }

  const updateStatus = async (member: TeamMember) => {
    setLoading(true)
    setMessage('')
    try {
      const nextStatus = member.status === 'active' ? 'inactive' : 'active'
      const response = await fetch('/api/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: member.id, status: nextStatus }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || data.error || 'Could not update member')
      setMessage(isArabic ? 'تم تحديث حالة العضو.' : 'Member status updated.')
      loadTeam()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (isArabic ? 'تعذر تحديث حالة العضو.' : 'Could not update member status.'))
    } finally {
      setLoading(false)
    }
  }

  const deleteMember = async (member: TeamMember) => {
    setLoading(true)
    setMessage('')
    try {
      const response = await fetch('/api/team', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: member.id }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || data.error || 'Could not delete member')
      setMessage(isArabic ? 'تم حذف العضو.' : 'Member deleted.')
      loadTeam()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (isArabic ? 'تعذر حذف العضو.' : 'Could not delete member.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold">{isArabic ? 'إدارة الفريق' : 'Team Management'}</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">{isArabic ? 'أدر أعضاء لوحة التحكم والصلاحيات من قائمة واضحة.' : 'Manage dashboard members and permissions from a clear list.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadTeam} disabled={loading}>{loading ? (isArabic ? 'جاري التحديث...' : 'Refreshing...') : (isArabic ? 'تحديث' : 'Refresh')}</Button>
          <Button onClick={openNewMember} className="bg-red-600 hover:bg-red-700">{isArabic ? 'إضافة عضو' : 'Add Member'}</Button>
        </div>
      </div>
      {message && <p className="rounded-md bg-slate-100 p-3 text-sm dark:bg-slate-900">{message}</p>}

      {formOpen && (
        <Card>
          <CardHeader><CardTitle>{editingId ? (isArabic ? 'تعديل عضو' : 'Edit Member') : (isArabic ? 'إضافة عضو' : 'Add Member')}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-4 md:grid-cols-4">
              <Field id="member-name" label={isArabic ? 'الاسم' : 'Name'} value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
              <Field id="member-email" label={isArabic ? 'البريد الإلكتروني' : 'Email'} value={form.email} onChange={(value) => setForm({ ...form, email: value })} type="email" />
              <div>
                <Label htmlFor="role">{isArabic ? 'الدور' : 'Role'}</Label>
                <select id="role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
                  <option value="admin">{isArabic ? 'مدير' : 'Admin'}</option>
                  <option value="manager">{isArabic ? 'مشرف' : 'Manager'}</option>
                  <option value="cashier">{isArabic ? 'كاشير' : 'Cashier'}</option>
                  <option value="delivery">{isArabic ? 'مندوب توصيل' : 'Delivery'}</option>
                  <option value="support">{isArabic ? 'دعم العملاء' : 'Support'}</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700">{editingId ? (isArabic ? 'حفظ' : 'Save') : (isArabic ? 'إضافة' : 'Add')}</Button>
                <Button type="button" variant="outline" onClick={closeForm}>{isArabic ? 'إلغاء' : 'Cancel'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{isArabic ? 'أعضاء الفريق' : 'Team Members'}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {team.length === 0 ? <p className="py-10 text-center text-slate-500">{isArabic ? 'لا يوجد أعضاء فريق محفوظون بعد.' : 'No team members saved yet.'}</p> : team.map((member) => (
            <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 dark:border-slate-800">
              <div>
                <p className="font-semibold">{member.name}</p>
                <p className="text-sm text-slate-500">{member.email} - {member.role}</p>
                <Badge className={member.status === 'active' ? 'bg-green-600' : 'bg-slate-500'}>{member.status === 'active' ? (isArabic ? 'نشط' : 'Active') : (isArabic ? 'غير نشط' : 'Inactive')}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => edit(member)}>{isArabic ? 'تعديل' : 'Edit'}</Button>
                <Button size="sm" variant="outline" onClick={() => updateStatus(member)}>{member.status === 'active' ? (isArabic ? 'تعطيل' : 'Disable') : (isArabic ? 'تفعيل' : 'Enable')}</Button>
                <Button size="sm" variant="destructive" onClick={() => deleteMember(member)}>{isArabic ? 'حذف' : 'Delete'}</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function Field({ id, label, value, onChange, type = 'text' }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} required />
    </div>
  )
}
