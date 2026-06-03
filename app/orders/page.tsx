'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Navbar } from '@/components/navbar'
import { Sidebar } from '@/components/sidebar'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN, ROUTES } from '@/lib/constants'
import { useAuthStore } from '@/lib/store'
import { getTrackedOrders, statusLabels, TrackedOrder, TrackingStatus } from '@/lib/order-tracking'

const getStatusColor = (status: TrackingStatus) => {
  switch (status) {
    case 'received':
    case 'delivered':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    case 'out_for_delivery':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    case 'preparing':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
  }
}

export default function OrdersPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [orders, setOrders] = useState<TrackedOrder[]>([])
  const { isLoggedIn, logout } = useAuthStore()
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN

  useEffect(() => {
    fetch('/api/pos/orders')
      .then((response) => response.json())
      .then((data) => {
        const apiOrders = Array.isArray(data.orders) ? data.orders : []
        setOrders(apiOrders.length > 0 ? apiOrders : getTrackedOrders())
      })
      .catch(() => setOrders(getTrackedOrders()))
  }, [])

  const handleLogout = () => {
    logout()
    setSidebarOpen(false)
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isLoggedIn={isLoggedIn} onLogout={handleLogout} />
      <Navbar onMenuOpen={() => setSidebarOpen(true)} isLoggedIn={isLoggedIn} onLogout={handleLogout} />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold">{isArabic ? 'طلباتي' : 'My Orders'}</h1>
          <Link href={ROUTES.MENU}><Button className="bg-red-600 hover:bg-red-700">{isArabic ? 'اطلب مرة أخرى' : 'Order Again'}</Button></Link>
        </div>

        <div className="space-y-4">
          {orders.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="mb-4 text-slate-600 dark:text-slate-400">{isArabic ? 'ليس لديك طلبات بعد.' : 'You do not have any orders yet.'}</p>
                <Link href={ROUTES.MENU}><Button className="bg-red-600 hover:bg-red-700">{isArabic ? 'ابدأ الطلب' : 'Start Order'}</Button></Link>
              </CardContent>
            </Card>
          ) : (
            orders.map((order) => (
              <Card key={order.id} className="transition-shadow hover:shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold">{order.id}</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{new Date(order.createdAt).toLocaleDateString(isArabic ? 'ar-EG' : 'en-US')}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{order.items} {isArabic ? 'منتج' : `item${order.items !== 1 ? 's' : ''}`}</p>
                    </div>
                    <div className="space-y-2 text-right">
                      <p className="text-lg font-bold">{order.total.toFixed(2)} {currency}</p>
                      <Badge className={getStatusColor(order.status)}>{statusLabels[order.status][language]}</Badge>
                      <Link href={`${ROUTES.TRACK_ORDER}/${order.id}`}>
                        <Button variant="outline" size="sm" className="w-full">{isArabic ? 'تتبع الطلب' : 'Track Order'}</Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </main>
  )
}
