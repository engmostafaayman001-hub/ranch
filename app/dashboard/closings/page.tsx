'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/components/language-provider'
import { readClosings, type ClosingRecord, type SavedClosingExpense } from '@/lib/closings'
import useShiftSession from '@/lib/use-shift-session'
import performShiftClosing from '@/lib/shift-closing'
import { TrackedOrder } from '@/lib/order-tracking'

function isValidDate(date: Date) {
  return !Number.isNaN(date.getTime())
}

export default function ClosingsPage() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const [closings, setClosings] = useState<ClosingRecord[]>([])
  const [filterStart, setFilterStart] = useState('')
  const [filterEnd, setFilterEnd] = useState('')
  const [selectedClosingId, setSelectedClosingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'orders' | 'expenses'>('orders')
  const [selectedClosingOrders, setSelectedClosingOrders] = useState<TrackedOrder[]>([])
  const [selectedClosingExpenses, setSelectedClosingExpenses] = useState<SavedClosingExpense[]>([])
  const [loadingClosingDetails, setLoadingClosingDetails] = useState(false)
  const [daySession, setDaySession] = useShiftSession()
  const [closingBusy, setClosingBusy] = useState(false)

  useEffect(() => {
    setClosings(readClosings())
    console.log('📋 Closings loaded:', readClosings().length)
  }, [])

  useEffect(() => {
    const handleStorageChange = () => {
      console.log('📋 Storage changed, reloading closings...')
      const updated = readClosings()
      console.log('📋 Updated closings from storage event:', updated.length)
      setClosings(updated)
    }
    
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('closings:updated', handleStorageChange)
    
    // Poll very frequently to catch updates from other tabs/windows
    const interval = window.setInterval(() => {
      const updated = readClosings()
      // Check both count and newest record
      const hasChanges = updated.length !== closings.length || (updated[0]?.id !== closings[0]?.id)
      if (hasChanges) {
        console.log('📋 Closings changed (polling), reloading...', { 
          oldCount: closings.length, 
          newCount: updated.length,
          oldNewest: closings[0]?.id,
          newNewest: updated[0]?.id,
        })
        setClosings(updated)
      }
    }, 300)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('closings:updated', handleStorageChange)
      window.clearInterval(interval)
    }
  }, [closings.length, closings[0]?.id])

  const filteredClosings = useMemo(() => {
    const startDate = filterStart ? new Date(`${filterStart}T00:00:00`) : null
    const endDate = filterEnd ? new Date(`${filterEnd}T23:59:59.999`) : null
    if ((startDate && !isValidDate(startDate)) || (endDate && !isValidDate(endDate))) return closings
    if (!startDate && !endDate) return closings
    if (startDate && endDate) {
      const [from, to] = startDate.getTime() <= endDate.getTime() ? [startDate, endDate] : [endDate, startDate]
      return closings.filter((closing) => {
        const openedAt = new Date(closing.openedAt)
        return !Number.isNaN(openedAt.getTime()) && openedAt.getTime() >= from.getTime() && openedAt.getTime() <= to.getTime()
      })
    }
    if (startDate) {
      return closings.filter((closing) => {
        const openedAt = new Date(closing.openedAt)
        return !Number.isNaN(openedAt.getTime()) && openedAt.getTime() >= startDate.getTime()
      })
    }
    return closings.filter((closing) => {
      const openedAt = new Date(closing.openedAt)
      return !Number.isNaN(openedAt.getTime()) && openedAt.getTime() <= endDate!.getTime()
    })
  }, [closings, filterStart, filterEnd])

  const selectedClosing = closings.find((closing) => closing.id === selectedClosingId)

  useEffect(() => {
    if (!selectedClosing) {
      setSelectedClosingOrders([])
      setSelectedClosingExpenses([])
      return
    }

    setActiveTab('orders')
    setLoadingClosingDetails(true)

    if (selectedClosing.orders?.length) {
      setSelectedClosingOrders(selectedClosing.orders)
    } else if (selectedClosing.shiftId) {
      fetch(`/api/pos/orders?limit=500&shiftId=${encodeURIComponent(selectedClosing.shiftId)}`, { cache: 'no-store' })
        .then((response) => response.json())
        .then((data) => {
          setSelectedClosingOrders(Array.isArray(data.orders) ? data.orders : [])
        })
        .catch(() => setSelectedClosingOrders([]))
    } else {
      setSelectedClosingOrders([])
    }

    if (selectedClosing.expenses?.length) {
      setSelectedClosingExpenses(selectedClosing.expenses)
    } else if (selectedClosing.shiftId) {
      fetch(`/api/expenses?shiftId=${encodeURIComponent(selectedClosing.shiftId)}`, { cache: 'no-store' })
        .then((response) => response.json())
        .then((data) => {
          setSelectedClosingExpenses(Array.isArray(data.expenses) ? data.expenses : [])
        })
        .catch(() => setSelectedClosingExpenses([]))
        .finally(() => setLoadingClosingDetails(false))
    } else {
      setSelectedClosingExpenses([])
      setLoadingClosingDetails(false)
    }
  }, [selectedClosing])

  const closureOrders = selectedClosing?.orders ?? selectedClosingOrders
  const closureExpenses = selectedClosing?.expenses ?? selectedClosingExpenses

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">{isArabic ? 'التقفيلات' : 'Closings'}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{isArabic ? 'عرض التقفيلات السابقة بالبحث في كل وردية.' : 'Browse saved closings and inspect individual shift summaries.'}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 sm:w-[32rem]">
            <label className="space-y-1">
              <span className="text-sm font-medium">{isArabic ? 'من تاريخ' : 'From Date'}</span>
              <Input type="date" value={filterStart} onChange={(event) => setFilterStart(event.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">{isArabic ? 'إلى تاريخ' : 'To Date'}</span>
              <Input type="date" value={filterEnd} onChange={(event) => setFilterEnd(event.target.value)} />
            </label>
          </div>
          <div className="flex items-center gap-2">
            {daySession.isOpen ? (
              <Button className="gap-2 bg-red-600 hover:bg-red-700" onClick={async () => {
                if (!daySession.shiftId || closingBusy) return
                setClosingBusy(true)
                try {
                  // close session locally
                  const closedAt = new Date().toISOString()
                  setDaySession({ ...daySession, isOpen: false, closedAt })
                  // perform closing (fetch orders/expenses and save record)
                  const record = await performShiftClosing({ ...daySession, closedAt })
                  // refresh closings list
                  setClosings(readClosings())
                  setSelectedClosingId(record.id)
                } catch (err) {
                  console.error('Could not perform shift closing', err)
                } finally {
                  setClosingBusy(false)
                }
              }} disabled={closingBusy}>
                {isArabic ? 'غلق الوردية' : 'Close Shift'}
              </Button>
            ) : null}
          </div>
        </div>
        {filteredClosings.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            {isArabic ? 'لا توجد تقفيلات مطابقة.' : 'No matching closings found.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm text-slate-700 dark:text-slate-200">
              <thead>
                <tr className="bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <th className="border-b border-slate-200 px-4 py-3">{isArabic ? 'الوردية' : 'Shift'}</th>
                  <th className="border-b border-slate-200 px-4 py-3">{isArabic ? 'الطلبات' : 'Orders'}</th>
                  <th className="border-b border-slate-200 px-4 py-3">{isArabic ? 'النوع' : 'Type'}</th>
                  <th className="border-b border-slate-200 px-4 py-3">{isArabic ? 'صافي الدرج' : 'Drawer Net'}</th>
                  <th className="border-b border-slate-200 px-4 py-3">{isArabic ? 'الملاحظات' : 'Notes'}</th>
                  <th className="border-b border-slate-200 px-4 py-3">{isArabic ? 'عرض' : 'View'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredClosings.map((closing) => (
                  <tr key={closing.id} className="border-b border-slate-200 dark:border-slate-800">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{new Date(closing.openedAt).toLocaleDateString(isArabic ? 'ar-EG' : 'en-US')}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{new Date(closing.openedAt).toLocaleTimeString(isArabic ? 'ar-EG' : 'en-US')}</div>
                    </td>
                    <td className="px-4 py-3">{closing.ordersCount}</td>
                    <td className="px-4 py-3">{closing.type === 'driver' ? (isArabic ? 'تقفيل السائقين' : 'Driver') : (isArabic ? 'الوردية' : 'Shift')}</td>
                    <td className="px-4 py-3">{closing.drawerNet.toFixed(2)} {closing.currency || 'EGP'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{new Date(closing.closedAt).toLocaleTimeString(isArabic ? 'ar-EG' : 'en-US')}</td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant={selectedClosingId === closing.id ? 'secondary' : 'outline'} onClick={() => setSelectedClosingId(selectedClosingId === closing.id ? null : closing.id)}>
                        {isArabic ? 'عرض' : 'View'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedClosing ? (
        <Card>
          <CardHeader>
            <CardTitle>{isArabic ? 'تفاصيل الوردية' : 'Shift Details'}</CardTitle>
            <CardDescription>
              {new Date(selectedClosing.openedAt).toLocaleString(isArabic ? 'ar-EG' : 'en-US')} → {new Date(selectedClosing.closedAt).toLocaleString(isArabic ? 'ar-EG' : 'en-US')}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm text-slate-500">{isArabic ? 'عدد الطلبات' : 'Orders Count'}</p>
              <p className="mt-2 text-2xl font-bold">{selectedClosing.ordersCount}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm text-slate-500">{isArabic ? 'نوع التقفيل' : 'Closing Type'}</p>
              <p className="mt-2 text-2xl font-bold">{selectedClosing.type === 'driver' ? (isArabic ? 'تقفيل السائقين' : 'Driver Closing') : (isArabic ? 'إغلاق الوردية' : 'Shift Closing')}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm text-slate-500">{isArabic ? 'المبيعات بدون توصيل' : 'Sales without Delivery'}</p>
              <p className="mt-2 text-2xl font-bold">{selectedClosing.salesWithoutDelivery.toFixed(2)} {selectedClosing.currency || 'EGP'}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm text-slate-500">{isArabic ? 'إجمالي المصروفات' : 'Expenses Total'}</p>
              <p className="mt-2 text-2xl font-bold">{selectedClosing.expensesTotal.toFixed(2)} {selectedClosing.currency || 'EGP'}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm text-slate-500">{isArabic ? 'غير محصلة' : 'Uncollected'}</p>
              <p className="mt-2 text-2xl font-bold">{selectedClosing.uncollectedTotal.toFixed(2)} {selectedClosing.currency || 'EGP'}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 md:col-span-2">
              <p className="text-sm text-slate-500">{isArabic ? 'المدفوعات الأخرى' : 'Other Payments'}</p>
              <p className="mt-2 text-2xl font-bold">{selectedClosing.otherPaymentsTotal.toFixed(2)} {selectedClosing.currency || 'EGP'}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 md:col-span-2">
              <p className="text-sm text-slate-500">{isArabic ? 'صافي الدرج' : 'Drawer Net'}</p>
              <p className="mt-2 text-3xl font-bold">{selectedClosing.drawerNet.toFixed(2)} {selectedClosing.currency || 'EGP'}</p>
            </div>
            <div className="md:col-span-2">
              <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="flex flex-wrap justify-center gap-3">
                  <Button variant={activeTab === 'orders' ? 'secondary' : 'outline'} onClick={() => setActiveTab('orders')}>
                    {isArabic ? 'عرض الطلبات الكاملة' : 'View Full Orders'}
                  </Button>
                  <Button variant={activeTab === 'expenses' ? 'secondary' : 'outline'} onClick={() => setActiveTab('expenses')}>
                    {isArabic ? 'عرض المصروفات' : 'View Expenses'}
                  </Button>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {isArabic
                    ? 'يمكنك عرض بيانات الطلبات أو المصروفات الكاملة للتقفيل المغلق.'
                    : 'View full orders or expenses for this closed shift.'}
                </p>
              </div>
            </div>
            <div className="md:col-span-2">
              {loadingClosingDetails ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                  {isArabic ? 'جاري تحميل تفاصيل التقفيل...' : 'Loading closing details...'}
                </div>
              ) : activeTab === 'orders' ? (
                closureOrders.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                    {isArabic ? 'لا توجد طلبات محفوظة لهذا التقفيل.' : 'No saved orders for this closing.'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {closureOrders.map((order) => (
                      <div key={order.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold">#{order.displayNumber || order.id}</p>
                            <p className="text-sm text-slate-500">{order.customer || order.phone || '-'}</p>
                            <p className="mt-2 text-xs text-slate-500">{order.createdAt ? new Date(order.createdAt).toLocaleString(isArabic ? 'ar-EG' : 'en-US') : ''}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">{Number(order.total || 0).toFixed(2)} {selectedClosing.currency || 'EGP'}</p>
                            <p className="text-xs text-slate-500">{order.status}</p>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-xs text-slate-500">{isArabic ? 'طريقة الدفع' : 'Payment Method'}</p>
                            <p className="mt-1 text-sm">{order.payment?.method || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">{isArabic ? 'دفع الإستلام' : 'COD Status'}</p>
                            <p className="mt-1 text-sm">{String(order.payment?.status || '-')}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : closureExpenses.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                  {isArabic ? 'لا توجد مصروفات محفوظة لهذا التقفيل.' : 'No saved expenses for this closing.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {closureExpenses.map((expense) => (
                    <div key={expense.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{expense.name}</p>
                          <p className="mt-1 text-sm text-slate-500">{expense.note || '-'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">{Number(expense.amount || 0).toFixed(2)} {selectedClosing.currency || 'EGP'}</p>
                          <p className="text-xs text-slate-500">{new Date(expense.date).toLocaleString(isArabic ? 'ar-EG' : 'en-US')}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
