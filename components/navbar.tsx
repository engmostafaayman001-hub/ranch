'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Heart, LayoutDashboard, LogIn, LogOut, Menu, Moon, ShoppingCart, Sun, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { useTheme } from '@/components/theme-provider'
import { useLanguage } from '@/components/language-provider'
import { useAuthStore } from '@/lib/store'
import { NotificationBell } from '@/components/notification-bell'
import { ROUTES } from '@/lib/constants'

interface NavbarProps {
  onMenuOpen: () => void
  isLoggedIn: boolean
  onLogout: () => void
}

export function Navbar({ onMenuOpen, isLoggedIn, onLogout }: NavbarProps) {
  const { theme, toggleTheme } = useTheme()
  const { language, appName, toggleLanguage, t } = useLanguage()
  const user = useAuthStore((state) => state.user)
  const [canOpenDashboard, setCanOpenDashboard] = useState(false)

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
    <nav className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onMenuOpen} title={language === 'ar' ? 'فتح القائمة' : 'Open menu'}>
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>
            <Link href={ROUTES.HOME} className="flex items-center gap-3">
              <Logo size="md" />
              <span className="hidden text-xl font-bold text-red-600 sm:inline">{appName}</span>
            </Link>
          </div>

          <div className="hidden items-center gap-1 lg:flex">
            <Link href={ROUTES.MENU}><Button variant="ghost">{t('menu')}</Button></Link>
            <Link href={ROUTES.FAVORITES}><Button variant="ghost" className="gap-2"><Heart className="h-4 w-4" />{t('favorites')}</Button></Link>
            <Link href={ROUTES.CART}><Button variant="ghost" className="gap-2"><ShoppingCart className="h-4 w-4" />{t('cart')}</Button></Link>
            <Link href={ROUTES.TRACK_ORDER}><Button variant="ghost">{t('trackOrder')}</Button></Link>
            <Link href="/my-orders"><Button variant="ghost">{t('myOrders')}</Button></Link>
            {isLoggedIn && <Link href={ROUTES.PROFILE}><Button variant="ghost">{t('profile')}</Button></Link>}
            {isLoggedIn && canOpenDashboard && (
              <Link href={ROUTES.DASHBOARD}>
                <Button variant="ghost" className="gap-2"><LayoutDashboard className="h-4 w-4" />{t('dashboard')}</Button>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-1">
            <NotificationBell />
            <Button variant="ghost" size="icon" onClick={toggleLanguage} title={language === 'ar' ? 'English' : 'العربية'} className="font-semibold">
              {language === 'ar' ? 'EN' : 'AR'}
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleTheme} title={theme === 'light' ? t('darkMode') : t('lightMode')}>
              {theme === 'light' ? <Moon className="h-5 w-5" aria-hidden="true" /> : <Sun className="h-5 w-5" aria-hidden="true" />}
            </Button>
            {isLoggedIn ? (
              <Button onClick={onLogout} variant="destructive" size="sm" className="hidden gap-2 sm:inline-flex">
                <LogOut className="h-4 w-4" />{t('logout')}
              </Button>
            ) : (
              <div className="hidden gap-2 sm:flex">
                <Link href={ROUTES.LOGIN}><Button size="sm" className="gap-2 bg-red-600 hover:bg-red-700"><LogIn className="h-4 w-4" />{t('login')}</Button></Link>
                <Link href={ROUTES.REGISTER}><Button size="sm" variant="outline" className="gap-2"><UserPlus className="h-4 w-4" />{t('register')}</Button></Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
