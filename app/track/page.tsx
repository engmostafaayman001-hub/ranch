'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/logo'
import { useLanguage } from '@/components/language-provider'

export default function TrackPage() {
  const router = useRouter()
  const { language, appName } = useLanguage()
  const isArabic = language === 'ar'
  const [orderId, setOrderId] = useState('')

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (orderId.trim()) {
      router.push(`/track/${orderId.trim().toUpperCase()}`)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <nav className="sticky top-0 z-50 w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <Logo size="md" />
              <span className="font-bold text-xl text-red-600">{appName}</span>
            </Link>
            <Link href="/">
              <Button variant="ghost">{isArabic ? '← الصفحة الرئيسية' : '← Home'}</Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle>{isArabic ? 'تتبع طلبك' : 'Track Your Order'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="orderId">{isArabic ? 'رقم الطلب' : 'Order ID'}</Label>
                <Input
                  id="orderId"
                  value={orderId}
                  onChange={(event) => setOrderId(event.target.value)}
                  placeholder="ORD001"
                  className="mt-1"
                />
              </div>
              <Button className="w-full bg-red-600 hover:bg-red-700">
                {isArabic ? 'عرض التتبع' : 'View Tracking'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
