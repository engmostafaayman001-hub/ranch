'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ROUTES } from '@/lib/constants'
import { useLanguage } from '@/components/language-provider'
import { Logo } from '@/components/logo'
import {
  findTrackedOrder,
  getStatusIndex,
  statusLabels,
  TrackedOrder,
  trackingSteps,
} from '@/lib/order-tracking'

export default function TrackOrderPage() {
  const params = useParams()
  const { language, appName } = useLanguage()
  const isArabic = language === 'ar'
  const orderId = String(params.orderId || '')
  const [order, setOrder] = useState<TrackedOrder | null>(null)

  useEffect(() => {
    fetch('/api/pos/orders')
      .then((response) => response.json())
      .then((data) => {
        const apiOrders = Array.isArray(data.orders) ? data.orders as TrackedOrder[] : []
        setOrder(apiOrders.find((item) => item.id.toLowerCase() === orderId.toLowerCase()) || findTrackedOrder(orderId) || null)
      })
      .catch(() => setOrder(findTrackedOrder(orderId) || null))
  }, [orderId])

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <nav className="sticky top-0 z-50 w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <Logo size="md" />
              <span className="font-bold text-xl text-red-600">{appName}</span>
            </Link>
            <Link href={ROUTES.ORDERS}>
              <Button variant="ghost">{isArabic ? '← العودة للطلبات' : '← Back to Orders'}</Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-8">{isArabic ? 'تتبع الطلب' : 'Track Order'}</h1>

        {!order ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="mb-4 text-slate-600 dark:text-slate-400">
                {isArabic ? 'لم يتم العثور على هذا الطلب.' : 'This order could not be found.'}
              </p>
              <Link href="/track">
                <Button className="bg-red-600 hover:bg-red-700">
                  {isArabic ? 'البحث عن طلب آخر' : 'Search Another Order'}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>{isArabic ? 'الطلب' : 'Order'} {order.id}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{isArabic ? 'الحالة' : 'Status'}</p>
                    <p className="text-lg font-bold">{statusLabels[order.status][language]}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{isArabic ? 'التوصيل المتوقع' : 'Estimated Delivery'}</p>
                    <p className="text-lg font-bold text-green-600">{order.estimatedDelivery}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{isArabic ? 'الإجمالي' : 'Total'}</p>
                    <p className="text-lg font-bold text-red-600">{order.total.toFixed(2)} ج.م</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mb-8">
              <CardHeader>
                <CardTitle>{isArabic ? 'خط سير الطلب' : 'Order Timeline'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-5">
                  {trackingSteps.map((step, index) => {
                    const completed = getStatusIndex(step.status) <= getStatusIndex(order.status)
                    const event = order.history.find((item) => item.status === step.status)
                    const active = step.status === order.status
                    return (
                      <div key={step.status} className="flex items-start gap-4">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-white ${
                            completed ? 'bg-red-600' : 'bg-slate-300'
                          }`}
                        >
                          {completed ? '✓' : index + 1}
                        </div>
                        <div className="flex-1 border-b border-slate-200 pb-4 dark:border-slate-800">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={`font-semibold ${completed ? 'text-red-600' : 'text-slate-500'}`}>
                              {step[language]}
                            </p>
                            {active && (
                              <Badge className="bg-green-600">{isArabic ? 'الحالة الحالية' : 'Current'}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-500">
                            {event
                              ? new Date(event.at).toLocaleString(isArabic ? 'ar-EG' : 'en-US')
                              : (isArabic ? 'بانتظار التحديث' : 'Waiting for update')}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{isArabic ? 'معلومات السائق' : 'Driver Information'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="font-bold">{order.driver.name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">⭐ {isArabic ? 'تقييم' : 'Rating'} {order.driver.rating || '-'}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">☎ {order.driver.phone}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  )
}
