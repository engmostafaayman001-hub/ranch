'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeftToLine, Home, Menu, ReceiptText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { useLanguage } from '@/components/language-provider'
import { ROUTES } from '@/lib/constants'
import { dashboardLinks } from '@/lib/dashboard-routes'

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { language, t } = useLanguage()
  const isArabic = language === 'ar'

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <DashboardAside isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="min-w-0 flex-1">
        <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} title={isArabic ? 'فتح قائمة لوحة التحكم' : 'Open dashboard menu'}>
                <Menu className="h-5 w-5" aria-hidden="true" />
              </Button>
              <h1 className="text-2xl font-bold">{t('dashboard')}</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={ROUTES.TRACK_ORDER} prefetch={false}>
                <Button variant="outline" className="gap-2"><ReceiptText className="h-4 w-4" />{isArabic ? 'تتبع العميل' : 'Customer Tracking'}</Button>
              </Link>
              <Link href={ROUTES.HOME} prefetch={false}>
                <Button className="gap-2"><Home className="h-4 w-4" />{isArabic ? 'فتح التطبيق' : 'Open App'}</Button>
              </Link>
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </main>
    </div>
  )
}

function DashboardAside({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/auth/dashboard-access', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (active) setRole(data.role || null)
      })
      .catch(() => {
        if (active) setRole(null)
      })
    return () => {
      active = false
    }
  }, [])

  const visibleLinks = dashboardLinks.filter((link) => !role || (link.roles as readonly string[]).includes(role))

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
            <p className="text-xs text-slate-400">{isArabic ? 'الصفحات حسب صلاحية الدور' : 'Pages by role permissions'}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="text-white lg:hidden" onClick={onClose}>
          <X className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto">
        {visibleLinks.map((link) => {
          const Icon = link.icon
          return (
            <Link key={link.href} href={link.href} prefetch={false} onClick={onClose}>
              <Button variant="ghost" className={`w-full gap-3 text-white hover:bg-slate-800 ${isArabic ? 'justify-end' : 'justify-start'}`}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {isArabic ? link.labelAr : link.labelEn}
              </Button>
            </Link>
          )
        })}
      </nav>

      <Link href={ROUTES.HOME} prefetch={false}>
        <Button variant="outline" className="w-full gap-2">
          <ArrowLeftToLine className="h-4 w-4" aria-hidden="true" />
          {isArabic ? 'العودة للتطبيق' : 'Back to App'}
        </Button>
      </Link>
    </aside>
  )
}
