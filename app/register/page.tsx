'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/logo'
import { ROUTES } from '@/lib/constants'
import { useAuthStore } from '@/lib/store'
import { useLanguage } from '@/components/language-provider'
import { normalizeEmail, rememberRegisteredEmail } from '@/lib/access'
import { signInWithGoogle, signOut, signUpWithEmail } from '@/lib/auth'

export default function RegisterPage() {
  const router = useRouter()
  const { login } = useAuthStore()
  const { language, appName, t } = useLanguage()
  const isArabic = language === 'ar'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEmailRegister = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError(isArabic ? 'كلمات المرور غير متطابقة' : 'Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError(isArabic ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      const normalizedEmail = normalizeEmail(email)
      await signOut().catch(() => {})
      const data = await signUpWithEmail(normalizedEmail, password, name)
      const userData = {
        id: data.user?.id || normalizedEmail,
        name,
        email: data.user?.email || normalizedEmail,
      }

      rememberRegisteredEmail(normalizedEmail)
      await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email: normalizedEmail }),
      }).catch(() => {})
      login(userData)
      router.refresh()
      window.location.href = '/'
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (isArabic ? 'فشل التسجيل' : 'Registration failed'))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    setLoading(true)
    setError(null)
    try {
      await signOut().catch(() => {})
      await signInWithGoogle()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (isArabic ? 'فشل التسجيل مع جوجل' : 'Google signup failed'))
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-slate-900 dark:to-slate-800">
      <div className="w-full max-w-md px-4">
        <div className="space-y-6 rounded-lg bg-white p-8 shadow-lg dark:bg-slate-900">
          <div className="space-y-2 text-center">
            <div className="mx-auto flex justify-center"><Logo size="xl" /></div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{appName}</h1>
            <p className="text-slate-600 dark:text-slate-400">{isArabic ? 'إنشاء حسابك' : 'Create your account'}</p>
          </div>

          {error && <div className="rounded border border-red-400 bg-red-100 px-4 py-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-900 dark:text-red-200">⚠ {error}</div>}

          <form onSubmit={handleEmailRegister} className="space-y-4">
            <div>
              <Label htmlFor="name">{isArabic ? 'الاسم الكامل' : 'Full Name'}</Label>
              <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required placeholder={isArabic ? 'أحمد محمد' : 'John Smith'} className="mt-1" disabled={loading} />
            </div>
            <div>
              <Label htmlFor="email">{t('email')}</Label>
              <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" className="mt-1" disabled={loading} />
            </div>
            <div>
              <Label htmlFor="password">{t('password')}</Label>
              <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="••••••••" className="mt-1" disabled={loading} />
            </div>
            <div>
              <Label htmlFor="confirm-password">{t('confirmPassword')}</Label>
              <Input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required placeholder="••••••••" className="mt-1" disabled={loading} />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-red-600 text-white hover:bg-red-700">
              {loading ? (isArabic ? 'جاري إنشاء الحساب...' : 'Creating account...') : t('createAccount')}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-300 dark:border-slate-600" /></div>
            <div className="relative flex justify-center text-sm"><span className="bg-white px-2 text-slate-500 dark:bg-slate-900">{isArabic ? 'أو تابع مع' : 'Or continue with'}</span></div>
          </div>

          <Button type="button" variant="outline" onClick={handleGoogleSignup} disabled={loading} className="w-full">
            G {isArabic ? 'التسجيل مع جوجل' : 'Sign up with Google'}
          </Button>

          <p className="text-center text-sm text-slate-600 dark:text-slate-400">
            {t('haveAccount')}{' '}
            <Link href={ROUTES.LOGIN} className="font-medium text-red-600 hover:text-red-700">{t('signInHere')}</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
