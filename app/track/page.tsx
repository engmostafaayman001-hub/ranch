'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Navbar } from '@/components/navbar'
import { Sidebar } from '@/components/sidebar'
import { CURRENCY } from '@/lib/constants'
import { useLanguage } from '@/components/language-provider'
import { useAuthStore } from '@/lib/store'
import { TrackedOrder, getTrackedOrdersForEmail, statusLabels, syncTrackedOrdersForEmail } from '@/lib/order-tracking'

export default function TrackPage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [orderId, setOrderId] = useState('')
  const [recentOrders, setRecentOrders] = useState<TrackedOrder[]>([])
  const { isLoggedIn, logout, user } = useAuthStore()
  const { language } = useLanguage()
  const isArabic = language === 'ar'

  useEffect(() => {
    let active = true

    async function loadRecentOrders() {
      try {
        const response = await fetch('/api/pos/orders', { cache: 'no-store' })
        const data = await response.json().catch(() => ({}))
        const orders = Array.isArray(data.orders) ? data.orders as TrackedOrder[] : []
        const nextOrders = isLoggedIn && user?.email
          ? syncTrackedOrdersForEmail(orders, user.email)
          : getTrackedOrdersForEmail(null)
        if (active) setRecentOrders(nextOrders)
      } catch {
        if (active) setRecentOrders(isLoggedIn && user?.email ? getTrackedOrdersForEmail(user.email) : getTrackedOrdersForEmail(null))
      }
    }

    const timer = window.setTimeout(loadRecentOrders, 0)
    const interval = window.setInterval(loadRecentOrders, 10000)
    return () => {
      active = false
      window.clearTimeout(timer)
      window.clearInterval(interval)
    }
  }, [isLoggedIn, user?.email])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (orderId.trim()) router.push(`/track/${orderId.trim().toUpperCase()}`)
  }

  const handleLogout = () => {
    logout()
    setSidebarOpen(false)
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isLoggedIn={isLoggedIn} onLogout={handleLogout} />
      <Navbar onMenuOpen={() => setSidebarOpen(true)} isLoggedIn={isLoggedIn} onLogout={handleLogout} />

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Card>
          <CardHeader><CardTitle>{isArabic ? 'تتبع طلبك' : 'Track Your Order'}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="orderId">{isArabic ? 'رقم الطلب' : 'Order ID'}</Label>
                <Input id="orderId" value={orderId} onChange={(event) => setOrderId(event.target.value)} placeholder="ORD001" className="mt-1" />
              </div>
              <Button className="w-full bg-red-600 hover:bg-red-700">{isArabic ? 'عرض التتبع' : 'View Tracking'}</Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8">
          <h2 className="mb-4 text-2xl font-bold">{isArabic ? 'أحدث الطلبات' : 'Recent Orders'}</h2>
          <div className="space-y-3">
            {recentOrders.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-slate-500">{isArabic ? 'لا توجد طلبات حديثة بعد.' : 'No recent orders yet.'}</CardContent></Card>
            ) : (
              recentOrders.slice(0, 6).map((order) => (
                <Link key={order.id} href={`/track/${order.id}`} className="block">
                  <Card className="transition-shadow hover:shadow-md">
                    <CardContent className="flex items-center justify-between gap-4 py-4">
                      <div>
                        <p className="font-bold">{order.id}</p>
                        <p className="text-sm text-slate-500">{order.customer}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-red-600">{statusLabels[order.status][language]}</p>
                        <p className="text-sm text-slate-500">{Number(order.total || 0).toFixed(2)} {CURRENCY}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
