'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  Bell,
  FileQuestion,
  Heart,
  Home,
  Info,
  LayoutDashboard,
  LogIn,
  LogOut,
  MessageSquare,
  Moon,
  Phone,
  ReceiptText,
  ScrollText,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sun,
  User,
  UserPlus,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { useTheme } from '@/components/theme-provider'
import { useLanguage } from '@/components/language-provider'
import { ROUTES } from '@/lib/constants'
import { getDefaultDashboardRouteForRole } from '@/lib/dashboard-permissions'
import { useAuthStore } from '@/lib/store'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  isLoggedIn: boolean
  onLogout: () => void
}

type NavItemProps = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  onClose: () => void
  alignClass: string
}

function NavItem({ href, label, icon: Icon, onClose, alignClass }: NavItemProps) {
  return (
    <Link href={href} onClick={onClose}>
      <Button variant="ghost" className={`w-full gap-3 ${alignClass}`}>
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {label}
      </Button>
    </Link>
  )
}

export function Sidebar({ isOpen, onClose, isLoggedIn, onLogout }: SidebarProps) {
  const { theme, toggleTheme } = useTheme()
  const { language, appName, toggleLanguage, t } = useLanguage()
  const user = useAuthStore((state) => state.user)
  const [dashboardRole, setDashboardRole] = useState<string | null>(null)
  const canOpenDashboard = Boolean(dashboardRole)
  const align = language === 'ar' ? 'justify-end text-right' : 'justify-start text-left'

  useEffect(() => {
    if (!isLoggedIn || !user?.email) {
      queueMicrotask(() => setDashboardRole(null))
      return
    }

    let active = true
    fetch('/api/auth/dashboard-access', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (active) setDashboardRole(typeof data.role === 'string' ? data.role : null)
      })
      .catch(() => {
        if (active) setDashboardRole(null)
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
            <Link href={ROUTES.HOME} onClick={onClose} className="flex items-center gap-3">
              <Logo size="md" />
              <span className="text-lg font-bold text-red-600">{appName}</span>
            </Link>
            <Button variant="ghost" size="icon" onClick={onClose} title={language === 'ar' ? 'إغلاق' : 'Close'}>
              <X className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>

          <nav className="flex-1 space-y-2">
            <NavItem href={ROUTES.HOME} label={t('home')} icon={Home} onClose={onClose} alignClass={align} />
            <NavItem href={ROUTES.MENU} label={t('menu')} icon={ShoppingBag} onClose={onClose} alignClass={align} />
            <NavItem href={ROUTES.FAVORITES} label={t('favorites')} icon={Heart} onClose={onClose} alignClass={align} />
            <NavItem href={ROUTES.CART} label={t('cart')} icon={ShoppingCart} onClose={onClose} alignClass={align} />
            <NavItem href={ROUTES.TRACK_ORDER} label={t('trackOrder')} icon={ReceiptText} onClose={onClose} alignClass={align} />
            <NavItem href="/my-orders" label={t('myOrders')} icon={ScrollText} onClose={onClose} alignClass={align} />
            <NavItem href="/notifications" label={t('notifications')} icon={Bell} onClose={onClose} alignClass={align} />

            {isLoggedIn && (
              <>
                <hr className="my-4 border-slate-200 dark:border-slate-800" />
                <NavItem href={ROUTES.PROFILE} label={t('profile')} icon={User} onClose={onClose} alignClass={align} />
                {canOpenDashboard && <NavItem href={getDefaultDashboardRouteForRole(dashboardRole) || ROUTES.DASHBOARD} label={t('dashboard')} icon={LayoutDashboard} onClose={onClose} alignClass={align} />}
              </>
            )}

            <hr className="my-4 border-slate-200 dark:border-slate-800" />
            <NavItem href="/about" label={t('aboutUs')} icon={Info} onClose={onClose} alignClass={align} />
            <NavItem href="/contact" label={t('contactUs')} icon={Phone} onClose={onClose} alignClass={align} />
            <NavItem href="/faq" label={t('faq')} icon={FileQuestion} onClose={onClose} alignClass={align} />
            <NavItem href="/privacy" label={t('privacy')} icon={ShieldCheck} onClose={onClose} alignClass={align} />
            <NavItem href="/terms" label={t('terms')} icon={ScrollText} onClose={onClose} alignClass={align} />
            <NavItem href={ROUTES.COMPLAINTS} label={t('refund')} icon={MessageSquare} onClose={onClose} alignClass={align} />
          </nav>

          <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <Button variant="outline" className="w-full gap-2" onClick={toggleTheme}>
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              {theme === 'light' ? t('darkMode') : t('lightMode')}
            </Button>
            <Button variant="outline" className="w-full" onClick={toggleLanguage}>
              {language === 'ar' ? 'English' : 'العربية'}
            </Button>
            {isLoggedIn ? (
              <Button onClick={() => { onLogout(); onClose() }} variant="destructive" className="w-full gap-2">
                <LogOut className="h-4 w-4" />{t('logout')}
              </Button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link href={ROUTES.LOGIN} onClick={onClose}><Button className="w-full gap-2 bg-red-600 hover:bg-red-700"><LogIn className="h-4 w-4" />{t('login')}</Button></Link>
                <Link href={ROUTES.REGISTER} onClick={onClose}><Button variant="outline" className="w-full gap-2"><UserPlus className="h-4 w-4" />{t('register')}</Button></Link>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
