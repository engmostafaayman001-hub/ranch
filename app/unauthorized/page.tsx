'use client'

import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useLanguage } from '@/components/language-provider'
import { ROUTES } from '@/lib/constants'

export default function UnauthorizedPage() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-5 pt-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{isArabic ? 'لا توجد صلاحية لهذه الصفحة' : 'No Access to This Page'}</h1>
            <p className="mt-2 text-slate-500">
              {isArabic ? 'حسابك فعال، لكن دورك لا يسمح بفتح هذا المسار. استخدم الصفحات المتاحة لك من لوحة التحكم.' : 'Your account is active, but your role cannot open this route. Use the dashboard pages available to you.'}
            </p>
          </div>
          <div className="flex justify-center gap-2">
            <Link href={ROUTES.DASHBOARD}><Button>{isArabic ? 'لوحة التحكم' : 'Dashboard'}</Button></Link>
            <Link href={ROUTES.HOME}><Button variant="outline">{isArabic ? 'التطبيق' : 'App'}</Button></Link>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
