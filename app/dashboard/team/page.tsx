'use client'

import { FormEvent, useState } from 'react'
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
  status: 'active' as const,
}

export default function DashboardTeamPage() {
  const { team, addTeamMember, updateTeamMember, deleteTeamMember } = useAppStore()
  const [form, setForm] = useState(emptyMember)
  const [editingId, setEditingId] = useState<string | null>(null)

  const submitMember = (event: FormEvent) => {
    event.preventDefault()
    if (!form.name.trim() || !form.email.trim()) return
    if (editingId) {
      updateTeamMember(editingId, form)
    } else {
      addTeamMember(form)
    }
    setEditingId(null)
    setForm(emptyMember)
  }

  const editMember = (member: TeamMember) => {
    setEditingId(member.id)
    setForm({ name: member.name, email: member.email, role: member.role, status: member.status })
  }

  const roleLabel = (role: string) => roles.find((item) => item.value === role)?.label || role

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">إدارة الفريق</h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">أضف أعضاء لوحة التحكم وحدد الدور والحالة لكل عضو.</p>
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
              <Input id="member-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
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
              <Button type="submit" className="bg-red-600 hover:bg-red-700">{editingId ? 'حفظ التعديل' : 'إضافة العضو'}</Button>
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
                  <Button size="sm" variant="outline" onClick={() => updateTeamMember(member.id, { status: member.status === 'active' ? 'inactive' : 'active' })}>
                    {member.status === 'active' ? 'تعطيل' : 'تفعيل'}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteTeamMember(member.id)}>حذف</Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
