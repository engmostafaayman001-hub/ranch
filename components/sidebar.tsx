'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { useTheme } from '@/components/theme-provider'
import { useLanguage } from '@/components/language-provider'
import { ROUTES } from '@/lib/constants'
import { useAuthStore } from '@/lib/store'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  isLoggedIn: boolean
  onLogout: () => void
}

export function Sidebar({ isOpen, onClose, isLoggedIn, onLogout }: SidebarProps) {
  const { theme, toggleTheme } = useTheme()
  const { language, appName, toggleLanguage, t } = useLanguage()
  const user = useAuthStore((state) => state.user)
  const [canOpenDashboard, setCanOpenDashboard] = useState(false)
  const align = language === 'ar' ? 'justify-end text-right' : 'justify-start text-left'

  const itemClass = `w-full ${align}`

  useEffect(() => {
    if (!isLoggedIn || !user?.email) {
      queueMicrotask(() => setCanOpenDashboard(false))
      return
    }

    let active = true
    fetch('/api/auth/dashboard-access', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (active) setCanOpenDashboard(Boolean(data.allowed))
      })
      .catch(() => {
        if (active) setCanOpenDashboard(false)
      })

    return () => {
      active = false
    }
  }, [isLoggedIn, user?.email])

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />}

      <aside className={`fixed top-0 z-50 h-screen w-72 bg-white shadow-xl transition-transform duration-300 dark:bg-slate-900 ${language === 'ar' ? 'right-0' : 'left-0'} ${isOpen ? 'translate-x-0' : language === 'ar' ? 'translate-x-full' : '-translate-x-full'}`}>
        <div className="flex h-full flex-col overflow-y-auto p-5">
          <div className="mb-6 flex items-center justify-between">
            <Link href="/" onClick={onClose} className="flex items-center gap-3">
              <Logo size="md" />
              <span className="text-lg font-bold text-red-600">{appName}</span>
            </Link>
            <Button variant="ghost" size="icon" onClick={onClose} title={language === 'ar' ? 'إغلاق' : 'Close'}>×</Button>
          </div>

          <nav className="flex-1 space-y-2">
            <Link href={ROUTES.HOME} onClick={onClose}><Button variant="ghost" className={itemClass}>{t('home')}</Button></Link>
            <Link href={ROUTES.MENU} onClick={onClose}><Button variant="ghost" className={itemClass}>{t('menu')}</Button></Link>
            <Link href={ROUTES.CART} onClick={onClose}><Button variant="ghost" className={itemClass}>{t('cart')}</Button></Link>
            <Link href={ROUTES.TRACK_ORDER} onClick={onClose}><Button variant="ghost" className={itemClass}>{t('trackOrder')}</Button></Link>
            <Link href="/my-orders" onClick={onClose}><Button variant="ghost" className={itemClass}>{language === 'ar' ? 'طلباتي' : 'My Orders'}</Button></Link>
            <Link href="/notifications" onClick={onClose}><Button variant="ghost" className={itemClass}>{language === 'ar' ? 'الإشعارات' : 'Notifications'}</Button></Link>

            {isLoggedIn && (
              <>
                <hr className="my-4 border-slate-200 dark:border-slate-800" />
                <Link href={ROUTES.PROFILE} onClick={onClose}><Button variant="ghost" className={itemClass}>{t('profile')}</Button></Link>
                {canOpenDashboard && <Link href={ROUTES.DASHBOARD} onClick={onClose}><Button variant="ghost" className={itemClass}>{language === 'ar' ? 'لوحة التحكم' : 'Dashboard'}</Button></Link>}
              </>
            )}

            <hr className="my-4 border-slate-200 dark:border-slate-800" />
            <Link href="/about" onClick={onClose}><Button variant="ghost" className={itemClass}>{t('aboutUs')}</Button></Link>
            <Link href="/contact" onClick={onClose}><Button variant="ghost" className={itemClass}>{t('contactUs')}</Button></Link>
            <Link href="/faq" onClick={onClose}><Button variant="ghost" className={itemClass}>{t('faq')}</Button></Link>
            <Link href="/privacy" onClick={onClose}><Button variant="ghost" className={itemClass}>{t('privacy')}</Button></Link>
            <Link href="/terms" onClick={onClose}><Button variant="ghost" className={itemClass}>{t('terms')}</Button></Link>
            <Link href="/refund" onClick={onClose}><Button variant="ghost" className={itemClass}>{t('refund')}</Button></Link>
          </nav>

          <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <Button variant="outline" className="w-full" onClick={toggleTheme}>
              {theme === 'light' ? t('darkMode') : t('lightMode')}
            </Button>
            <Button variant="outline" className="w-full" onClick={toggleLanguage}>
              {language === 'ar' ? 'English' : 'العربية'}
            </Button>
            {isLoggedIn ? (
              <Button onClick={() => { onLogout(); onClose() }} variant="destructive" className="w-full">{t('logout')}</Button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link href={ROUTES.LOGIN} onClick={onClose}><Button className="w-full bg-red-600 hover:bg-red-700">{t('login')}</Button></Link>
                <Link href={ROUTES.REGISTER} onClick={onClose}><Button variant="outline" className="w-full">{t('register')}</Button></Link>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
