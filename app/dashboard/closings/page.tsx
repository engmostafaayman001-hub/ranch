'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/components/language-provider'
import { readClosings, type ClosingRecord } from '@/lib/closings'

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

  useEffect(() => {
    setClosings(readClosings())
  }, [])

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
                    <td className="px-4 py-3">{closing.type === 'driver' ? (isArabic ? 'تقفيل السائقين' : 'Driver') : (isArabic ? 'تقفيل يومي' : 'Daily')}</td>
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
              <p className="mt-2 text-2xl font-bold">{selectedClosing.type === 'driver' ? (isArabic ? 'تقفيل السائقين' : 'Driver Closing') : (isArabic ? 'تقفيل يومي' : 'Daily Closing')}</p>
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
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
