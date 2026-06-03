'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AppNotification, getReadNotificationIds } from '@/lib/notifications'
import { useLanguage } from '@/components/language-provider'

export function NotificationBell() {
  const { language } = useLanguage()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let active = true

    const loadNotifications = async () => {
      const response = await fetch('/api/notifications', { cache: 'no-store' })
      if (!response.ok || !active) return

      const data = await response.json()
      const notifications: AppNotification[] = Array.isArray(data.notifications) ? data.notifications : []
      const read = new Set(getReadNotificationIds())
      setUnreadCount(notifications.filter((notification) => !read.has(notification.id)).length)
    }

    loadNotifications().catch(() => {})
    const interval = window.setInterval(() => loadNotifications().catch(() => {}), 10000)
    window.addEventListener('focus', loadNotifications)

    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', loadNotifications)
    }
  }, [])

  return (
    <Link href="/notifications">
      <Button variant="ghost" size="icon" title={language === 'ar' ? 'الإشعارات' : 'Notifications'} className="relative">
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
            {unreadCount}
          </span>
        )}
      </Button>
    </Link>
  )
}
