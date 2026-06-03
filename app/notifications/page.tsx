'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Navbar } from '@/components/navbar'
import { Sidebar } from '@/components/sidebar'
import { useLanguage } from '@/components/language-provider'
import { useAuthStore } from '@/lib/store'
import { AppNotification, markNotificationsRead } from '@/lib/notifications'

export default function NotificationsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const { isLoggedIn, logout } = useAuthStore()
  const { language } = useLanguage()
  const isArabic = language === 'ar'

  useEffect(() => {
    fetch('/api/notifications', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        const items: AppNotification[] = Array.isArray(data.notifications) ? data.notifications : []
        setNotifications(items)
        markNotificationsRead(items.map((item) => item.id))
      })
      .catch(() => setNotifications([]))
  }, [])

  const handleLogout = () => {
    logout()
    setSidebarOpen(false)
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isLoggedIn={isLoggedIn} onLogout={handleLogout} />
      <Navbar onMenuOpen={() => setSidebarOpen(true)} isLoggedIn={isLoggedIn} onLogout={handleLogout} />

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="mb-8 text-3xl font-bold">{isArabic ? 'الإشعارات' : 'Notifications'}</h1>
        <div className="space-y-4">
          {notifications.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-slate-500">
                {isArabic ? 'لا توجد إشعارات الآن.' : 'No notifications yet.'}
              </CardContent>
            </Card>
          ) : (
            notifications.map((notification) => (
              <Card key={notification.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3">
                    <span>{notification.title}</span>
                    {notification.code && <span className="rounded-full bg-red-600 px-3 py-1 text-sm text-white">{notification.code}</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 dark:text-slate-400">{notification.message}</p>
                  <p className="mt-3 text-xs text-slate-500">{new Date(notification.createdAt).toLocaleString(isArabic ? 'ar-EG' : 'en-US')}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </main>
  )
}
