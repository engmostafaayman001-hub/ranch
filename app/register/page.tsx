'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ROUTES } from '@/lib/constants'
import { useAuthStore } from '@/lib/store'
import { useLanguage } from '@/components/language-provider'
import { normalizeEmail, rememberRegisteredEmail } from '@/lib/access'
import { Logo } from '@/components/logo'
import { signInWithGoogle, signUpWithEmail } from '@/lib/auth'

function RegisterContent() {
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

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault()
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
      const data = await signUpWithEmail(normalizedEmail, password, name)

      const userData = {
        id: data.user?.id || normalizedEmail,
        name,
        email: data.user?.email || normalizedEmail,
      }

      rememberRegisteredEmail(normalizedEmail)
      login(userData)
      router.push('/')
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
      await signInWithGoogle()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (isArabic ? 'فشل التسجيل مع جوجل' : 'Google signup failed'))
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-slate-900 dark:to-slate-800">
      <div className="w-full max-w-md px-4">
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto flex justify-center">
              <Logo size="xl" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              {appName}
            </h1>
            <p className="text-slate-600 dark:text-slate-400">{isArabic ? 'إنشاء حسابك' : 'Create your account'}</p>
          </div>

          {error && (
            <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded text-sm">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleEmailRegister} className="space-y-4">
            <div>
              <Label htmlFor="name">{isArabic ? 'الاسم الكامل' : 'Full Name'}</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder={isArabic ? 'أحمد محمد' : 'John Smith'}
                className="mt-1"
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="mt-1"
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="mt-1"
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="confirm-password">{t('confirmPassword')}</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="mt-1"
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? (isArabic ? 'جاري إنشاء الحساب...' : 'Creating account...') : t('createAccount')}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-300 dark:border-slate-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-slate-900 text-slate-500">{isArabic ? 'أو تابع مع' : 'Or continue with'}</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleSignup}
            disabled={loading}
            className="w-full"
          >
            <span className="ml-2">🔍</span>
            {isArabic ? 'التسجيل مع جوجل' : 'Sign up with Google'}
          </Button>

          <p className="text-center text-slate-600 dark:text-slate-400 text-sm">
            {t('haveAccount')}{' '}
            <Link href={ROUTES.LOGIN} className="text-red-600 hover:text-red-700 font-medium">
              {t('signInHere')}
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

export default function RegisterPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return <RegisterContent />
}
