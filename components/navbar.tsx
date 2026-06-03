'use client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { useTheme } from '@/components/theme-provider'
import { useLanguage } from '@/components/language-provider'
import { useAuthStore } from '@/lib/store'
import { canAccessDashboardByEmail } from '@/lib/access'
import { NotificationBell } from '@/components/notification-bell'

interface NavbarProps {
  onMenuOpen: () => void
  isLoggedIn: boolean
  onLogout: () => void
}

export function Navbar({ onMenuOpen, isLoggedIn, onLogout }: NavbarProps) {
  const { theme, toggleTheme } = useTheme()
  const { language, appName, toggleLanguage, t } = useLanguage()
  const user = useAuthStore((state) => state.user)
  const canOpenDashboard = canAccessDashboardByEmail(user?.email)

  return (
    <nav className="sticky top-0 z-40 w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left side - Logo */}
          <Link href="/" className="flex items-center space-x-3 flex-row-reverse group">
            <Logo size="md" />
            <span className="font-bold text-xl text-red-600 hidden sm:inline group-hover:text-red-700 transition">{appName}</span>
          </Link>

          {/* Right side - Actions */}
          <div className="flex items-center space-x-2">
            {/* Language Toggle */}
            {isLoggedIn && <NotificationBell />}

            {/* Language Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleLanguage}
              title={language === 'ar' ? 'English' : 'العربية'}
              className="text-sm font-semibold"
            >
              {language === 'ar' ? 'EN' : 'AR'}
            </Button>

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              title={theme === 'light' ? t('darkMode') : t('lightMode')}
            >
              {theme === 'light' ? '☾' : '☀'}
            </Button>

            {/* Desktop Menu */}
            <div className="hidden lg:flex items-center space-x-4">
              <Link href="/menu">
                <Button variant="ghost">{t('menu')}</Button>
              </Link>
              <Link href="/cart">
                    <Button variant="ghost">🛒 {t('cart')}</Button>
              </Link>
              <Link href="/track">
                <Button variant="ghost">{t('trackOrder')}</Button>
              </Link>
              {isLoggedIn ? (
                <>
                  <Link href="/profile">
                    <Button variant="ghost">👤 {t('profile')}</Button>
                  </Link>
                  <Link href="/my-orders">
                    <Button variant="ghost">{language === 'ar' ? 'طلباتي' : 'My Orders'}</Button>
                  </Link>
                  {canOpenDashboard && (
                    <Link href="/dashboard">
                      <Button variant="ghost">{language === 'ar' ? 'لوحة التحكم' : 'Dashboard'}</Button>
                    </Link>
                  )}
                  <Button
                    onClick={onLogout}
                    variant="destructive"
                    size="sm"
                  >
                    {t('logout')}
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/login">
                    <Button>{t('login')}</Button>
                  </Link>
                  <Link href="/register">
                    <Button variant="outline">{t('register')}</Button>
                  </Link>
                </>
              )}
            </div>

            {/* Hamburger Menu - Always visible */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuOpen}
              title={t('menu')}
            >
              ☰
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
