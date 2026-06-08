'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeftToLine, Home, Menu, ReceiptText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { useLanguage } from '@/components/language-provider'
import { DashboardPrintWatcher } from '@/components/dashboard-print-watcher'
import { ROUTES } from '@/lib/constants'
import { dashboardLinks } from '@/lib/dashboard-routes'
import { useSharedAppData } from '@/lib/use-shared-app-data'

const roleLabels: Record<string, { ar: string; en: string }> = {
  super_admin: { ar: 'مالك النظام', en: 'Super Admin' },
  admin: { ar: 'مدير', en: 'Admin' },
  manager: { ar: 'مشرف', en: 'Manager' },
  cashier: { ar: 'كاشير', en: 'Cashier' },
  delivery: { ar: 'مندوب توصيل', en: 'Delivery' },
  support: { ar: 'دعم العملاء', en: 'Support' },
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  useSharedAppData()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { language, t } = useLanguage()
  const isArabic = language === 'ar'

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-slate-50 dark:bg-slate-950">
      <DashboardPrintWatcher />
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <DashboardAside isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="min-w-0 max-w-full flex-1 overflow-x-hidden">
        <div className="sticky top-0 z-30 max-w-full border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:px-6">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} title={isArabic ? 'فتح قائمة لوحة التحكم' : 'Open dashboard menu'}>
                <Menu className="h-5 w-5" aria-hidden="true" />
              </Button>
              <h1 className="min-w-0 text-2xl font-bold">{t('dashboard')}</h1>
            </div>
            <div className="flex min-w-0 flex-wrap gap-2">
              <Link href={ROUTES.TRACK_ORDER}>
                <Button variant="outline" className="gap-2">
                  <ReceiptText className="h-4 w-4" />
                  {isArabic ? 'تتبع العميل' : 'Customer Tracking'}
                </Button>
              </Link>
              <Link href={ROUTES.HOME}>
                <Button className="gap-2">
                  <Home className="h-4 w-4" />
                  {isArabic ? 'فتح التطبيق' : 'Open App'}
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <div className="min-w-0 max-w-full overflow-x-hidden p-4 sm:p-6">{children}</div>
      </main>
    </div>
  )
}

function DashboardAside({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { language } = useLanguage()
  const pathname = usePathname()
  const isArabic = language === 'ar'
  const [role, setRole] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      fetch('/api/auth/dashboard-access', { cache: 'no-store' })
        .then((response) => response.json())
        .then((data) => {
          if (active) setRole(typeof data.role === 'string' ? data.role : null)
        })
        .catch(() => {
          if (active) setRole(null)
        })
    }, 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [])

  const visibleLinks =
    typeof role === 'undefined'
      ? []
      : dashboardLinks.filter((link) => role && (link.roles as readonly string[]).includes(role))
  const roleLabel = role ? roleLabels[role] : null

  return (
    <aside
      className={`fixed ${isArabic ? 'right-0' : 'left-0'} top-0 z-50 flex h-screen w-72 shrink-0 flex-col bg-slate-950 p-6 text-white shadow-xl transition-transform lg:static lg:translate-x-0 ${
        isOpen ? 'translate-x-0' : isArabic ? 'translate-x-full' : '-translate-x-full'
      }`}
    >
      <div className="mb-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo size="md" />
          <div>
            <h2 className="text-xl font-bold">{isArabic ? 'لوحة التحكم' : 'Dashboard'}</h2>
            <p className="text-xs text-slate-400">
              {typeof role === 'undefined'
                ? isArabic ? 'جاري تحميل الصلاحيات' : 'Loading permissions'
                : roleLabel ? (isArabic ? roleLabel.ar : roleLabel.en) : isArabic ? 'بدون صلاحية' : 'No permission'}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="text-white lg:hidden" onClick={onClose}>
          <X className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto">
        {typeof role === 'undefined' ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded-md bg-slate-800" />
            ))}
          </div>
        ) : visibleLinks.length === 0 ? (
          <p className="rounded-md bg-slate-900 p-3 text-sm text-slate-300">
            {isArabic ? 'لا توجد صفحات متاحة لهذا الدور.' : 'No pages available for this role.'}
          </p>
        ) : (
          visibleLinks.map((link) => {
            const Icon = link.icon
            const active = link.href === ROUTES.DASHBOARD ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`)
            return (
              <Link key={link.href} href={link.href} onClick={onClose}>
                <Button
                  variant="ghost"
                  className={`w-full gap-3 text-white hover:bg-slate-800 ${active ? 'bg-slate-800' : ''} ${isArabic ? 'justify-end' : 'justify-start'}`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {isArabic ? link.labelAr : link.labelEn}
                </Button>
              </Link>
            )
          })
        )}
      </nav>

      <Link href={ROUTES.HOME}>
        <Button variant="outline" className="w-full gap-2">
          <ArrowLeftToLine className="h-4 w-4" aria-hidden="true" />
          {isArabic ? 'العودة للتطبيق' : 'Back to App'}
        </Button>
      </Link>
    </aside>
  )
}
