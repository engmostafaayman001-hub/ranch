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
import { normalizeEmail } from '@/lib/access'
import { Logo } from '@/components/logo'
import { signInWithEmail, signInWithGoogle } from '@/lib/auth'

function LoginContent() {
  const router = useRouter()
  const { login } = useAuthStore()
  const { language, appName, t } = useLanguage()
  const isArabic = language === 'ar'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!email || !password) {
        throw new Error(isArabic ? `${t('email')} و ${t('password')} مطلوبان` : `${t('email')} and ${t('password')} are required`)
      }

      const normalizedEmail = normalizeEmail(email)
      const data = await signInWithEmail(normalizedEmail, password)
      const authUser = data.user

      const userData = {
        id: authUser.id,
        name: authUser.user_metadata?.name || normalizedEmail.split('@')[0],
        email: authUser.email || normalizedEmail,
      }

      login(userData)
      router.push('/')
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? (isArabic ? 'هذا البريد غير مسجل أو كلمة المرور غير صحيحة. من فضلك سجل حسابًا جديدًا إذا لم يكن لديك حساب.' : 'This email is not registered or the password is incorrect. Please create an account if you do not have one.')
          : (isArabic ? 'فشل تسجيل الدخول' : 'Login failed')
      )
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)

    try {
      await signInWithGoogle()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (isArabic ? 'فشل تسجيل الدخول مع جوجل' : 'Google login failed'))
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-slate-900 dark:to-slate-800">
      <div className="w-full max-w-md px-4">
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-8 space-y-6">
          {/* Logo */}
          <div className="text-center space-y-2">
            <div className="mx-auto flex justify-center">
              <Logo size="xl" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              {appName}
            </h1>
            <p className="text-slate-600 dark:text-slate-400">{t('loginToAccount')}</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded text-sm">
              ⚠️ {error}
            </div>
          )}

          {/* Email Login Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1"
                placeholder="your@example.com"
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
                className="mt-1"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? (isArabic ? 'جاري تسجيل الدخول...' : 'Signing in...') : t('login')}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-300 dark:border-slate-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-slate-900 text-slate-500">{isArabic ? 'أو تابع مع' : 'Or continue with'}</span>
            </div>
          </div>

          {/* Google Login */}
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full"
          >
            <span className="ml-2">🔍</span>
            {isArabic ? 'تسجيل الدخول مع جوجل' : 'Sign in with Google'}
          </Button>

          {/* Forgot Password */}
          <div className="text-center">
            <a href="#" className="text-sm text-red-600 hover:text-red-700">
              {t('forgotPassword')}
            </a>
          </div>

          {/* Register Link */}
          <p className="text-center text-slate-600 dark:text-slate-400 text-sm">
            {t('noAccount')}{' '}
            <Link href={ROUTES.REGISTER} className="text-red-600 hover:text-red-700 font-medium">
              {t('signUpHere')}
            </Link>
          </p>

        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return <LoginContent />
}
