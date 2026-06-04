'use client'

import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Navbar } from '@/components/navbar'
import { Sidebar } from '@/components/sidebar'
import { useLanguage } from '@/components/language-provider'
import { useAuthStore } from '@/lib/store'
import { AppNotification, markNotificationsRead } from '@/lib/notifications'

export default function NotificationsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [message, setMessage] = useState('')
  const { isLoggedIn, logout } = useAuthStore()
  const { language, t } = useLanguage()
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

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code)
    setMessage(isArabic ? `تم نسخ كود الخصم ${code}` : `Discount code ${code} copied`)
    window.setTimeout(() => setMessage(''), 1800)
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isLoggedIn={isLoggedIn} onLogout={handleLogout} />
      <Navbar onMenuOpen={() => setSidebarOpen(true)} isLoggedIn={isLoggedIn} onLogout={handleLogout} />

      <div className="mx-auto max-w-3xl px-3 py-6 sm:px-6 lg:px-8">
        <h1 className="mb-5 text-2xl font-bold sm:text-3xl">{t('notifications')}</h1>
        {message && <p className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-200">{message}</p>}
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
                  <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                    <span>{notification.title}</span>
                    {notification.code && (
                      <Button type="button" size="sm" className="gap-2 bg-red-600 hover:bg-red-700" onClick={() => copyCode(notification.code!)}>
                        <Copy className="h-4 w-4" />
                        {notification.code}
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 dark:text-slate-400">{notification.message}</p>
                  {notification.code && (
                    <p className="mt-3 text-sm font-medium text-red-600">
                      {isArabic ? 'اضغط على الكود لنسخه واستخدمه في الدفع.' : 'Tap the code to copy it and use it at checkout.'}
                    </p>
                  )}
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
