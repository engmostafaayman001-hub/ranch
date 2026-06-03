'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sidebar } from '@/components/sidebar'
import { useAuthStore } from '@/lib/store'
import { ROUTES, CURRENCY, CURRENCY_EN } from '@/lib/constants'
import { useLanguage } from '@/components/language-provider'
import { Logo } from '@/components/logo'
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
  const { language, appName } = useLanguage()
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
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isLoggedIn={isLoggedIn}
        onLogout={handleLogout}
      />

      <nav className="sticky top-0 z-40 w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden">
                ☰
              </Button>
              <Link href="/" className="flex items-center gap-3">
                <Logo size="md" />
                <span className="hidden font-bold text-lg text-red-600 sm:inline">{appName}</span>
              </Link>
            </div>
            <Link href={ROUTES.MENU}>
              <Button className="bg-red-600 hover:bg-red-700">{isArabic ? 'اطلب مرة أخرى' : 'Order Again'}</Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="mb-8 text-3xl font-bold">{isArabic ? 'طلباتي' : 'My Orders'}</h1>

        <div className="space-y-4">
          {orders.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="mb-4 text-slate-600 dark:text-slate-400">
                  {isArabic ? 'ليس لديك طلبات بعد.' : 'You do not have any orders yet.'}
                </p>
                <Link href={ROUTES.MENU}>
                  <Button className="bg-red-600 hover:bg-red-700">{isArabic ? 'ابدأ الطلب' : 'Start Order'}</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            orders.map((order) => (
              <Card key={order.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-2">
                      <h3 className="font-bold text-lg">{order.id}</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {new Date(order.createdAt).toLocaleDateString(isArabic ? 'ar-EG' : 'en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {order.items} {isArabic ? 'منتجات' : `item${order.items !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                    <div className="space-y-2 text-right">
                      <p className="font-bold text-lg">{order.total.toFixed(2)} {currency}</p>
                      <Badge className={getStatusColor(order.status)}>
                        {statusLabels[order.status][language]}
                      </Badge>
                      <Link href={`${ROUTES.TRACK_ORDER}/${order.id}`}>
                        <Button variant="outline" size="sm" className="w-full">
                          {isArabic ? 'تتبع الطلب' : 'Track Order'}
                        </Button>
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
