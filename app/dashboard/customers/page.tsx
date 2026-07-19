'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN } from '@/lib/constants'
import { TrackedOrder } from '@/lib/order-tracking'

type Customer = {
  key?: string
  id?: string
  name?: string
  email?: string
  phone?: string
  address?: string
  createdAt?: string
  updatedAt?: string
  orders?: number
  totalSpent?: number
  lastOrderAt?: string
}

const isLocalCustomerEmail = (email?: string) => Boolean(email?.trim().toLowerCase().endsWith('@local.ranch'))
const displayEmail = (email?: string) => isLocalCustomerEmail(email) ? '' : email
const customerKey = (customer: Partial<Customer>) => {
  const email = customer.email?.trim().toLowerCase()
  const phone = customer.phone?.replace(/\D/g, '')
  if (email && !isLocalCustomerEmail(email)) return `email:${email}`
  if (phone) return `phone:${phone}`
  return `guest:${customer.name || ''}:${customer.address || ''}`.toLowerCase()
}

export default function DashboardCustomersPage() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' })
  const [editingKey, setEditingKey] = useState('')

  useEffect(() => {
    let active = true

    async function loadCustomers() {
      try {
        const [customersResponse, ordersResponse] = await Promise.all([
          fetch('/api/customers', { cache: 'no-store' }),
          fetch('/api/pos/orders', { cache: 'no-store' }),
        ])
        const customersData = await customersResponse.json().catch(() => ({}))
        const ordersData = await ordersResponse.json().catch(() => ({}))
        const baseCustomers = Array.isArray(customersData.customers) ? (customersData.customers as Customer[]) : []
        const orders = Array.isArray(ordersData.orders) ? (ordersData.orders as TrackedOrder[]) : []
        const byCustomer = new Map<string, Customer>()

        for (const customer of baseCustomers) {
          const key = customerKey(customer)

          byCustomer.set(key, {
            ...customer,
            key,
            email: displayEmail(customer.email),
            orders: 0,
            totalSpent: 0,
          })
        }

        for (const order of orders) {
          const key = customerKey({ email: order.customerEmail, phone: order.phone, name: order.customer, address: order.address })

          const existing = byCustomer.get(key) || {
            key,
            id: key,
            name: order.customer,
            email: displayEmail(order.customerEmail),
            phone: order.phone,
            address: order.address,
            orders: 0,
            totalSpent: 0,
          }

          byCustomer.set(key, {
            ...existing,
            key,
            name: existing.name || order.customer,
            phone: existing.phone || order.phone,
            address: existing.address || order.address,
            orders: (existing.orders || 0) + 1,
            totalSpent: (existing.totalSpent || 0) + Number(order.total || 0),
            lastOrderAt:
              !existing.lastOrderAt || new Date(order.createdAt) > new Date(existing.lastOrderAt)
                ? order.createdAt
                : existing.lastOrderAt,
          })
        }

        const sorted = Array.from(byCustomer.values()).sort((a, b) => {
          const dateA = new Date(a.lastOrderAt || a.updatedAt || a.createdAt || 0).getTime()
          const dateB = new Date(b.lastOrderAt || b.updatedAt || b.createdAt || 0).getTime()
          return dateB - dateA
        })

        if (active) setCustomers(sorted)
      } catch {
        if (active) setCustomers([])
      } finally {
        if (active) setLoading(false)
      }
    }

    const timer = window.setTimeout(loadCustomers, 0)
    const interval = window.setInterval(loadCustomers, 120000)
    return () => {
      active = false
      window.clearTimeout(timer)
      window.clearInterval(interval)
    }
  }, [reloadKey])

  const formatDate = (value?: string) => {
    if (!value) return '-'
    return new Date(value).toLocaleDateString(isArabic ? 'ar-EG' : 'en-US')
  }

  const addCustomer = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.name.trim() || (!form.email.trim() && !form.phone.trim())) {
      setMessage(isArabic ? 'اكتب اسم العميل ورقم الهاتف أو البريد.' : 'Enter the customer name and phone or email.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || data.error || 'Could not add customer')
      setForm({ name: '', email: '', phone: '', address: '' })
      setEditingKey('')
      setShowAddForm(false)
      setMessage(editingKey ? (isArabic ? 'تم تعديل العميل.' : 'Customer updated.') : (isArabic ? 'تم إضافة العميل.' : 'Customer added.'))
      setReloadKey((value) => value + 1)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (isArabic ? 'تعذر إضافة العميل.' : 'Could not add customer.'))
    } finally {
      setSaving(false)
    }
  }

  const editCustomer = (customer: Customer) => {
    setEditingKey(customer.key || customerKey(customer))
    setForm({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
    })
    setShowAddForm(true)
    setMessage('')
  }

  const deleteCustomer = async (customer: Customer) => {
    if (!window.confirm(isArabic ? 'هل تريد حذف هذا العميل؟' : 'Delete this customer?')) return
    setSaving(true)
    setMessage('')
    try {
      const params = new URLSearchParams()
      if (customer.id && customer.id.startsWith('CUS')) params.set('id', customer.id)
      if (customer.email) params.set('email', customer.email)
      if (customer.phone) params.set('phone', customer.phone)
      const response = await fetch(`/api/customers?${params.toString()}`, { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || data.error || 'Could not delete customer')
      const key = customer.key || customerKey(customer)
      setCustomers((current) => current.filter((item) => (item.key || customerKey(item)) !== key))
      setMessage(isArabic ? 'تم حذف العميل.' : 'Customer deleted.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (isArabic ? 'تعذر حذف العميل.' : 'Could not delete customer.'))
    } finally {
      setSaving(false)
    }
  }

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return customers
    return customers.filter((customer) => `${customer.name || ''} ${customer.email || ''} ${customer.phone || ''} ${customer.address || ''}`.toLowerCase().includes(term))
  }, [customers, search])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold">{isArabic ? 'إدارة العملاء' : 'Customers'}</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {isArabic
              ? 'عرض عملاء التطبيق وعملاء نقطة البيع مع بيانات الطلبات الخاصة بكل عميل.'
              : 'View app and POS customers with each customer order activity.'}
          </p>
        </div>
        <Button type="button" className="gap-2 bg-red-600 hover:bg-red-700" onClick={() => {
          setEditingKey('')
          setForm({ name: '', email: '', phone: '', address: '' })
          setShowAddForm((value) => !value)
        }}>
          <Plus className="h-4 w-4" />
          {isArabic ? 'إضافة عميل' : 'Add Customer'}
        </Button>
      </div>

      {message && <p className="rounded-md bg-slate-100 p-3 text-sm dark:bg-slate-900">{message}</p>}

      {showAddForm && (
        <Card>
          <CardHeader><CardTitle>{editingKey ? (isArabic ? 'تعديل العميل' : 'Edit Customer') : (isArabic ? 'إضافة عميل جديد' : 'Add New Customer')}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={addCustomer} className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="customer-name">{isArabic ? 'اسم العميل' : 'Customer name'}</Label>
                <Input id="customer-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
              </div>
              <div>
                <Label htmlFor="customer-phone">{isArabic ? 'رقم الهاتف' : 'Phone'}</Label>
                <Input id="customer-phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </div>
              <div>
                <Label htmlFor="customer-email">{isArabic ? 'البريد الإلكتروني اختياري' : 'Email optional'}</Label>
                <Input id="customer-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </div>
              <div>
                <Label htmlFor="customer-address">{isArabic ? 'العنوان' : 'Address'}</Label>
                <Input id="customer-address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
              </div>
              <div className="flex gap-2 md:col-span-2">
                <Button type="submit" disabled={saving} className="bg-red-600 hover:bg-red-700">
                  {saving ? (isArabic ? 'جاري الحفظ...' : 'Saving...') : editingKey ? (isArabic ? 'حفظ التعديل' : 'Save Changes') : (isArabic ? 'حفظ العميل' : 'Save Customer')}
                </Button>
                <Button type="button" variant="outline" onClick={() => {
                  setShowAddForm(false)
                  setEditingKey('')
                  setForm({ name: '', email: '', phone: '', address: '' })
                }}>{isArabic ? 'إلغاء' : 'Cancel'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{isArabic ? 'قائمة العملاء' : 'Customer List'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isArabic ? 'بحث بالاسم أو الهاتف أو البريد' : 'Search name, phone, or email'} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </div>
          {loading ? (
            <div className="py-12 text-center text-slate-500">
              {isArabic ? 'جاري تحميل العملاء...' : 'Loading customers...'}
            </div>
          ) : customers.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              {isArabic ? 'لا يوجد عملاء مسجلون بعد.' : 'No registered customers yet.'}
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="py-12 text-center text-slate-500">{isArabic ? 'لا يوجد عملاء مطابقون.' : 'No matching customers.'}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left dark:border-slate-800">
                    <th className="py-3 font-semibold">{isArabic ? 'الاسم' : 'Name'}</th>
                    <th className="py-3 font-semibold">{isArabic ? 'البريد' : 'Email'}</th>
                    <th className="py-3 font-semibold">{isArabic ? 'الهاتف' : 'Phone'}</th>
                    <th className="py-3 font-semibold">{isArabic ? 'تاريخ التسجيل' : 'Registered'}</th>
                    <th className="py-3 font-semibold">{isArabic ? 'الطلبات' : 'Orders'}</th>
                    <th className="py-3 font-semibold">{isArabic ? 'الإجمالي' : 'Total'}</th>
                    <th className="py-3 font-semibold">{isArabic ? 'آخر طلب' : 'Last Order'}</th>
                    <th className="py-3 font-semibold">{isArabic ? 'إجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer, index) => (
                    <tr key={customer.key || customer.id || customer.email || index} className="border-b last:border-0 dark:border-slate-800">
                      <td className="py-3">{customer.name || '-'}</td>
                      <td className="py-3">{customer.email || '-'}</td>
                      <td className="py-3">{customer.phone || '-'}</td>
                      <td className="py-3">{formatDate(customer.createdAt)}</td>
                      <td className="py-3">{customer.orders || 0}</td>
                      <td className="py-3">
                        {Number(customer.totalSpent || 0).toFixed(2)} {currency}
                      </td>
                      <td className="py-3">{formatDate(customer.lastOrderAt)}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => editCustomer(customer)}>
                            {isArabic ? 'تعديل' : 'Edit'}
                          </Button>
                          <Button type="button" size="sm" variant="destructive" disabled={saving} onClick={() => deleteCustomer(customer)}>
                            {isArabic ? 'حذف' : 'Delete'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
