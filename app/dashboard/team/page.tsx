'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TeamMember, useAppStore } from '@/lib/app-store'

const roles = [
  { value: 'admin', label: 'مدير' },
  { value: 'manager', label: 'مشرف' },
  { value: 'cashier', label: 'كاشير' },
  { value: 'delivery', label: 'مندوب توصيل' },
  { value: 'support', label: 'دعم العملاء' },
]

const emptyMember: Omit<TeamMember, 'id'> = {
  name: '',
  email: '',
  role: 'manager',
  status: 'active',
}

export default function DashboardTeamPage() {
  const { team: localTeam, addTeamMember, updateTeamMember, deleteTeamMember } = useAppStore()
  const [team, setTeam] = useState<TeamMember[]>(localTeam)
  const [form, setForm] = useState(emptyMember)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const loadTeam = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/team', { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || data.error || 'تعذر تحميل الفريق')
      setTeam(Array.isArray(data.members) ? data.members : [])
      setMessage('')
    } catch (error) {
      setTeam(localTeam)
      setMessage(error instanceof Error ? error.message : 'تعذر تحميل الفريق من السيرفر.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadTeam()
    }, 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submitMember = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.name.trim() || !form.email.trim()) return

    setLoading(true)
    setMessage('')
    try {
      const response = await fetch('/api/team', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { id: editingId, role: form.role, status: form.status } : form),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || data.error || 'تعذر حفظ العضو')

      if (editingId) {
        setTeam((current) => current.map((member) => (member.id === editingId ? data.member : member)))
        updateTeamMember(editingId, form)
        setMessage('تم حفظ تعديل العضو.')
      } else {
        setTeam((current) => [data.member, ...current.filter((member) => member.email !== data.member.email)])
        addTeamMember(form)
        setMessage(data.tempPassword ? `تمت إضافة العضو. كلمة المرور المؤقتة: ${data.tempPassword}` : 'تمت إضافة العضو وتفعيل صلاحياته.')
      }
    } catch (error) {
      if (editingId) {
        updateTeamMember(editingId, form)
        setTeam((current) => current.map((member) => (member.id === editingId ? { ...member, ...form } : member)))
      } else {
        addTeamMember(form)
        setTeam((current) => [...current, { ...form, id: `local-${Date.now()}` }])
      }
      setMessage(error instanceof Error ? `${error.message} تم حفظ التغيير محلياً فقط.` : 'تم حفظ التغيير محلياً فقط.')
    } finally {
      setLoading(false)
      setEditingId(null)
      setForm(emptyMember)
    }
  }

  const editMember = (member: TeamMember) => {
    setEditingId(member.id)
    setForm({ name: member.name, email: member.email, role: member.role, status: member.status })
  }

  const toggleMemberStatus = async (member: TeamMember) => {
    const status = member.status === 'active' ? 'inactive' : 'active'
    setLoading(true)
    setMessage('')
    try {
      const response = await fetch('/api/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: member.id, status }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || data.error || 'تعذر تحديث حالة العضو')
      setTeam((current) => current.map((item) => (item.id === member.id ? data.member : item)))
    } catch (error) {
      setTeam((current) => current.map((item) => (item.id === member.id ? { ...item, status } : item)))
      setMessage(error instanceof Error ? `${error.message} تم تحديث النسخة المحلية فقط.` : 'تم تحديث النسخة المحلية فقط.')
    } finally {
      updateTeamMember(member.id, { status })
      setLoading(false)
    }
  }

  const removeMember = async (member: TeamMember) => {
    setLoading(true)
    setMessage('')
    try {
      const response = await fetch('/api/team', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: member.id }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || data.error || 'تعذر حذف العضو')
    } catch (error) {
      setMessage(error instanceof Error ? `${error.message} تم حذف النسخة المحلية فقط.` : 'تم حذف النسخة المحلية فقط.')
    } finally {
      setTeam((current) => current.filter((item) => item.id !== member.id))
      deleteTeamMember(member.id)
      setLoading(false)
    }
  }

  const roleLabel = (role: string) => roles.find((item) => item.value === role)?.label || role

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold">إدارة الفريق</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">أضف أعضاء للوحة التحكم وحدد الدور والحالة لكل عضو.</p>
          {message && <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">{message}</p>}
        </div>
        <Button variant="outline" onClick={loadTeam} disabled={loading}>{loading ? 'جاري التحديث...' : 'تحديث'}</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? 'تعديل عضو' : 'إضافة عضو'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitMember} className="grid gap-4 md:grid-cols-4">
            <div>
              <Label htmlFor="member-name">الاسم</Label>
              <Input id="member-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </div>
            <div>
              <Label htmlFor="member-email">البريد الإلكتروني</Label>
              <Input id="member-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} disabled={!!editingId} required />
            </div>
            <div>
              <Label htmlFor="member-role">الدور</Label>
              <select id="member-role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950">
                {roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="member-status">الحالة</Label>
              <select id="member-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as 'active' | 'inactive' })} className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950">
                <option value="active">نشط</option>
                <option value="inactive">غير نشط</option>
              </select>
            </div>
            <div className="flex gap-2 md:col-span-4">
              <Button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700">{editingId ? 'حفظ التعديل' : 'إضافة العضو'}</Button>
              {editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(emptyMember) }}>إلغاء</Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>أعضاء الفريق</CardTitle>
          <Badge>{team.length} عضو</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {team.length === 0 ? (
            <p className="py-10 text-center text-slate-500">لا يوجد أعضاء فريق محفوظون بعد.</p>
          ) : (
            team.map((member) => (
              <div key={member.id} className="grid gap-4 rounded-md border border-slate-200 p-4 dark:border-slate-800 md:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{member.name}</h3>
                    <Badge className={member.status === 'active' ? 'bg-green-600' : 'bg-slate-500'}>{member.status === 'active' ? 'نشط' : 'غير نشط'}</Badge>
                  </div>
                  <p className="text-sm text-slate-500">{member.email}</p>
                  <p className="mt-1 text-sm font-semibold text-red-600">{roleLabel(member.role)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => editMember(member)}>تعديل</Button>
                  <Button size="sm" variant="outline" disabled={loading} onClick={() => toggleMemberStatus(member)}>
                    {member.status === 'active' ? 'تعطيل' : 'تفعيل'}
                  </Button>
                  <Button size="sm" variant="destructive" disabled={loading} onClick={() => removeMember(member)}>حذف</Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
