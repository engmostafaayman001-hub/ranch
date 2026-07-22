'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ROUTES } from '@/lib/constants'
import { canRoleOpenDashboardRoute, getDefaultDashboardRouteForRole } from '@/lib/dashboard-permissions'

export function DashboardRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    const resetTimer = window.setTimeout(() => {
      if (active) setReady(false)
    }, 0)

    const verifyAccess = async () => {
      try {
        const response = await fetch('/api/auth/dashboard-access', { cache: 'no-store' })
        const data = await response.json().catch(() => ({}))
        const role = typeof data.role === 'string' ? data.role : null

        if (!active) return

        if (!role) {
          router.replace(ROUTES.LOGIN)
          return
        }

        if (!canRoleOpenDashboardRoute(role, pathname)) {
          const fallback = getDefaultDashboardRouteForRole(role)
          router.replace(fallback || ROUTES.DASHBOARD)
          return
        }

        setReady(true)
      } catch {
        if (!active) return
        router.replace(ROUTES.LOGIN)
      }
    }

    void verifyAccess()

    return () => {
      active = false
      window.clearTimeout(resetTimer)
    }
  }, [pathname, router])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">جاري التحقق من الصلاحيات...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
