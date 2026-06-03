'use client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { useTheme } from '@/components/theme-provider'
import { useLanguage } from '@/components/language-provider'
import { ROUTES } from '@/lib/constants'
import { useAuthStore } from '@/lib/store'
import { canAccessDashboardByEmail } from '@/lib/access'

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
  const canOpenDashboard = canAccessDashboardByEmail(user?.email)

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed right-0 top-0 h-screen w-64 bg-white dark:bg-slate-900 shadow-lg transform transition-transform duration-300 z-50 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-6 h-full flex flex-col overflow-y-auto">
          {/* Logo */}
          <div className="mb-8">
            <Link href="/" onClick={onClose} className="flex items-center space-x-3 flex-row-reverse group">
              <Logo size="md" />
              <span className="font-bold text-lg text-red-600 group-hover:text-red-700 transition">{appName}</span>
            </Link>
          </div>

          {/* Main Menu */}
          <nav className="space-y-2 flex-1">
            <Link href={ROUTES.HOME} onClick={onClose}>
              <Button variant="ghost" className="w-full justify-start">
                🏠 {t('home')}
              </Button>
            </Link>
            <Link href={ROUTES.MENU} onClick={onClose}>
              <Button variant="ghost" className="w-full justify-start">
                📋 {t('menu')}
              </Button>
            </Link>
            <Link href={ROUTES.CART} onClick={onClose}>
              <Button variant="ghost" className="w-full justify-start">
                🛒 {t('cart')}
              </Button>
            </Link>
            <Link href="/track" onClick={onClose}>
              <Button variant="ghost" className="w-full justify-start">
                📍 {t('trackOrder')}
              </Button>
            </Link>

            {isLoggedIn && (
              <>
                <hr className="my-4" />
                <Link href={ROUTES.PROFILE} onClick={onClose}>
                  <Button variant="ghost" className="w-full justify-start">
                    👤 {t('profile')}
                  </Button>
                </Link>
                <Link href={ROUTES.ORDERS} onClick={onClose}>
                  <Button variant="ghost" className="w-full justify-start">
                    📦 {t('orders')}
                  </Button>
                </Link>
                <Link href="/notifications" onClick={onClose}>
                  <Button variant="ghost" className="w-full justify-start">
                    🔔 {language === 'ar' ? 'الإشعارات' : 'Notifications'}
                  </Button>
                </Link>
                {canOpenDashboard && (
                  <Link href={ROUTES.DASHBOARD} onClick={onClose}>
                    <Button variant="ghost" className="w-full justify-start">
                      📊 {language === 'ar' ? 'لوحة التحكم' : 'Dashboard'}
                    </Button>
                  </Link>
                )}
              </>
            )}

            <hr className="my-4" />
            <Link href="/about" onClick={onClose}>
              <Button variant="ghost" className="w-full justify-start">
                ℹ️ {t('aboutUs')}
              </Button>
            </Link>
            <Link href="/contact" onClick={onClose}>
              <Button variant="ghost" className="w-full justify-start">
                📞 {t('contactUs')}
              </Button>
            </Link>
            <Link href="/faq" onClick={onClose}>
              <Button variant="ghost" className="w-full justify-start">
                ❓ {t('faq')}
              </Button>
            </Link>
            <hr className="my-4" />
            <Link href="/privacy" onClick={onClose}>
              <Button variant="ghost" className="w-full justify-start">
                🔒 {t('privacy')}
              </Button>
            </Link>
            <Link href="/terms" onClick={onClose}>
              <Button variant="ghost" className="w-full justify-start">
                ⚖️ {t('terms')}
              </Button>
            </Link>
            <Link href="/refund" onClick={onClose}>
              <Button variant="ghost" className="w-full justify-start">
                💳 {t('refund')}
              </Button>
            </Link>
          </nav>

          {/* Theme and Language Toggle */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-2">
            <Button
              variant="outline"
              className="w-full justify-center"
              onClick={toggleTheme}
            >
              {theme === 'light' ? '☾ ' : '☀ '}
              {theme === 'light' ? t('darkMode') : t('lightMode')}
            </Button>

            <Button
              variant="outline"
              className="w-full justify-center"
              onClick={toggleLanguage}
            >
              {language === 'ar' ? 'EN' : 'AR'}
            </Button>

            {isLoggedIn ? (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-400 px-2 mb-2">
                  ✓ {language === 'ar' ? 'تم تسجيل الدخول' : 'Logged In'}
                </p>
                <Button
                  onClick={() => {
                    onLogout()
                    onClose()
                  }}
                  variant="destructive"
                  className="w-full"
                >
                  {t('logout')}
                </Button>
              </>
            ) : (
              <>
                <Link href={ROUTES.LOGIN} onClick={onClose} className="block">
                  <Button className="w-full bg-red-600 hover:bg-red-700">
                    {t('login')}
                  </Button>
                </Link>
                <Link href={ROUTES.REGISTER} onClick={onClose} className="block">
                  <Button variant="outline" className="w-full">
                    {t('register')}
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
