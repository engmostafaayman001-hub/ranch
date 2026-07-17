'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ReceiptText, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN } from '@/lib/constants'

type Expense = {
  id: string
  name: string
  amount: number
  date: string
  note: string
  createdAt?: string
}

function expenseDayKey(expense: Expense) {
  const date = new Date(expense.date || expense.createdAt || expense.id || '')
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function money(value: number, currency: string) {
  return `${Number(value || 0).toFixed(2)} ${currency}`
}

export default function DashboardExpensesPage() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ name: '', amount: '', date: new Date().toISOString().slice(0, 10), note: '' })
  const [search, setSearch] = useState('')
  const [dashboardRole, setDashboardRole] = useState<string | null>(null)
  const todayKey = new Date().toISOString().slice(0, 10)
  const isCashier = dashboardRole === 'cashier'

  const loadExpenses = async () => {
    try {
      const response = await fetch('/api/expenses', { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      setExpenses(Array.isArray(data.expenses) ? data.expenses : [])
    } catch {
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(loadExpenses, 0)
    const interval = window.setInterval(loadExpenses, 15000)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    let active = true
    fetch('/api/auth/dashboard-access', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (active) setDashboardRole(typeof data.role === 'string' ? data.role : null)
      })
      .catch(() => {
        if (active) setDashboardRole(null)
      })

    return () => {
      active = false
    }
  }, [])

  const total = useMemo(() => expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0), [expenses])
  const dailyExpenses = useMemo(() => expenses.filter((expense) => expenseDayKey(expense) === todayKey), [expenses, todayKey])
  const dailyTotal = useMemo(() => expenses
    .filter((expense) => expenseDayKey(expense) === todayKey)
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0), [expenses, todayKey])
  const filteredExpenses = useMemo(() => {
    const term = search.trim().toLowerCase()
    const source = isCashier ? dailyExpenses : expenses
    if (!term) return source
    return source.filter((expense) => `${expense.name} ${expense.note} ${expense.date} ${expense.amount}`.toLowerCase().includes(term))
  }, [dailyExpenses, expenses, isCashier, search])
  const filteredTotal = useMemo(() => filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0), [filteredExpenses])

  const closeForm = () => {
    setForm({ name: '', amount: '', date: new Date().toISOString().slice(0, 10), note: '' })
    setFormOpen(false)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const amount = Number(form.amount)
    if (!form.name.trim() || !Number.isFinite(amount) || amount <= 0) return
    const response = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name.trim(), amount, date: form.date, note: form.note.trim() }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setMessage(data.message || data.error || (isArabic ? 'تعذر حفظ المصروف.' : 'Could not save expense.'))
      return
    }
    setMessage(isArabic ? 'تم حفظ المصروف.' : 'Expense saved.')
    closeForm()
    loadExpenses()
  }

  const remove = async (id: string) => {
    const response = await fetch('/api/expenses', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (response.ok) loadExpenses()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold">{isArabic ? 'المصروفات' : 'Expenses'}</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">{isArabic ? 'سجل مصروفات المطعم اليومية.' : 'Track daily restaurant expenses.'}</p>
          {message && <p className="mt-2 text-sm text-green-600">{message}</p>}
        </div>
        <Button onClick={() => setFormOpen(true)} className="bg-red-600 hover:bg-red-700">{isArabic ? 'إضافة مصروف' : 'Add Expense'}</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ExpenseSummaryCard
          title={isArabic ? 'إجمالي مصروفات اليوم' : 'Today Expenses'}
          value={money(dailyTotal, currency)}
          hint={isArabic ? 'مصروفات تاريخ اليوم فقط' : 'Only expenses dated today'}
          icon={CalendarDays}
        />
        <ExpenseSummaryCard
          title={isArabic ? 'إجمالي المصروفات' : 'All Expenses'}
          value={isCashier ? '-' : money(total, currency)}
          hint={`${expenses.length} ${isArabic ? 'مصروف' : 'expenses'}`}
          icon={ReceiptText}
        />
        <ExpenseSummaryCard
          title={isArabic ? 'إجمالي نتائج البحث' : 'Search Total'}
          value={isCashier ? '-' : money(filteredTotal, currency)}
          hint={search.trim() ? (isArabic ? 'حسب البحث الحالي' : 'For current search') : (isArabic ? 'كل السجل الحالي' : 'Current ledger')}
          icon={Search}
        />
      </div>

      {formOpen && (
        <Card>
          <CardHeader><CardTitle>{isArabic ? 'إضافة مصروف' : 'Add Expense'}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-4 md:grid-cols-4">
              <Field id="expense-name" label={isArabic ? 'اسم المصروف' : 'Expense name'} value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
              <Field id="expense-amount" label={isArabic ? 'القيمة' : 'Amount'} value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} type="number" />
              <Field id="expense-date" label={isArabic ? 'التاريخ' : 'Date'} value={form.date} onChange={(value) => setForm({ ...form, date: value })} type="date" />
              <Field id="expense-note" label={isArabic ? 'ملاحظة' : 'Note'} value={form.note} onChange={(value) => setForm({ ...form, note: value })} />
              <div className="flex gap-2 md:col-span-4">
                <Button type="submit" className="bg-red-600 hover:bg-red-700">{isArabic ? 'حفظ المصروف' : 'Save Expense'}</Button>
                <Button type="button" variant="outline" onClick={closeForm}>{isArabic ? 'إلغاء' : 'Cancel'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span>{isArabic ? 'سجل المصروفات' : 'Expense Ledger'}</span>
            {!isCashier && <span className="text-base text-red-600">{total.toFixed(2)} {currency}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isArabic ? 'بحث في المصروفات' : 'Search expenses'} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </div>
          {loading ? (
            <p className="py-8 text-center text-slate-500">{isArabic ? 'جاري التحميل...' : 'Loading...'}</p>
          ) : (isCashier ? dailyExpenses.length === 0 : expenses.length === 0) ? (
            <p className="py-8 text-center text-slate-500">{isArabic ? 'لا توجد مصروفات بعد.' : 'No expenses yet.'}</p>
          ) : filteredExpenses.length === 0 ? (
            <p className="py-8 text-center text-slate-500">{isArabic ? 'لا توجد مصروفات مطابقة.' : 'No matching expenses.'}</p>
          ) : (
            <div className="space-y-3">
              {filteredExpenses.map((expense) => (
                <div key={expense.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 dark:border-slate-800">
                  <div>
                    <p className="font-semibold">{expense.name}</p>
                    <p className="text-sm text-slate-500">{expense.date} {expense.note ? `- ${expense.note}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold">{expense.amount.toFixed(2)} {currency}</span>
                    <Button size="sm" variant="destructive" onClick={() => remove(expense.id)}>{isArabic ? 'حذف' : 'Delete'}</Button>
                  </div>
                </div>
              ))}
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

function ExpenseSummaryCard({ title, value, hint, icon: Icon }: { title: string; value: string; hint: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-red-600" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      </CardContent>
    </Card>
  )
}
