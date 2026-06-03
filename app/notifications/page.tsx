'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Logo } from '@/components/logo'
import { useLanguage } from '@/components/language-provider'
import { AppNotification, markNotificationsRead } from '@/lib/notifications'

export default function NotificationsPage() {
  const { language, appName } = useLanguage()
  const isArabic = language === 'ar'
  const [notifications, setNotifications] = useState<AppNotification[]>([])

  useEffect(() => {
    fetch('/api/notifications')
      .then((response) => response.json())
      .then((data) => {
        const items = Array.isArray(data.notifications) ? data.notifications : []
        setNotifications(items)
        markNotificationsRead(items.map((item: AppNotification) => item.id))
      })
      .catch(() => setNotifications([]))
  }, [])

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <nav className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <Logo size="md" />
              <span className="font-bold text-xl text-red-600">{appName}</span>
            </Link>
            <Link href="/">
              <Button variant="ghost">{isArabic ? '← الرئيسية' : '← Home'}</Button>
            </Link>
          </div>
        </div>
      </nav>

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
                    {notification.code && (
                      <span className="rounded-full bg-red-600 px-3 py-1 text-sm text-white">{notification.code}</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 dark:text-slate-400">{notification.message}</p>
                  <p className="mt-3 text-xs text-slate-500">
                    {new Date(notification.createdAt).toLocaleString(isArabic ? 'ar-EG' : 'en-US')}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </main>
  )
}
