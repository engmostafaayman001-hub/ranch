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
import { normalizeEmail } from '@/lib/access'
import { signInWithEmail, signInWithGoogle } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuthStore()
  const { language, appName, t } = useLanguage()
  const isArabic = language === 'ar'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEmailLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!email || !password) {
        throw new Error(isArabic ? 'البريد الإلكتروني وكلمة المرور مطلوبان' : 'Email and password are required')
      }

      const normalizedEmail = normalizeEmail(email)
      const data = await signInWithEmail(normalizedEmail, password)
      const authUser = data.user
      login({
        id: authUser.id,
        name: authUser.user_metadata?.name || normalizedEmail.split('@')[0],
        email: authUser.email || normalizedEmail,
      })
      router.refresh()
      window.location.href = '/'
    } catch {
      setError(isArabic ? 'هذا البريد غير مسجل أو كلمة المرور غير صحيحة. من فضلك سجل حسابًا جديدًا إذا لم يكن لديك حساب.' : 'This email is not registered or the password is incorrect. Please create an account if you do not have one.')
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
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-slate-900 dark:to-slate-800">
      <div className="w-full max-w-md px-4">
        <div className="space-y-6 rounded-lg bg-white p-8 shadow-lg dark:bg-slate-900">
          <div className="space-y-2 text-center">
            <div className="mx-auto flex justify-center"><Logo size="xl" /></div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{appName}</h1>
            <p className="text-slate-600 dark:text-slate-400">{t('loginToAccount')}</p>
          </div>

          {error && <div className="rounded border border-red-400 bg-red-100 px-4 py-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-900 dark:text-red-200">⚠ {error}</div>}

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">{t('email')}</Label>
              <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="mt-1" placeholder="your@example.com" disabled={loading} />
            </div>
            <div>
              <Label htmlFor="password">{t('password')}</Label>
              <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required className="mt-1" placeholder="••••••••" disabled={loading} />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-red-600 text-white hover:bg-red-700">
              {loading ? (isArabic ? 'جاري تسجيل الدخول...' : 'Signing in...') : t('login')}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-300 dark:border-slate-600" /></div>
            <div className="relative flex justify-center text-sm"><span className="bg-white px-2 text-slate-500 dark:bg-slate-900">{isArabic ? 'أو تابع مع' : 'Or continue with'}</span></div>
          </div>

          <Button type="button" variant="outline" onClick={handleGoogleLogin} disabled={loading} className="w-full">
            G {isArabic ? 'تسجيل الدخول مع جوجل' : 'Sign in with Google'}
          </Button>

          <p className="text-center text-sm text-slate-600 dark:text-slate-400">
            {t('noAccount')}{' '}
            <Link href={ROUTES.REGISTER} className="font-medium text-red-600 hover:text-red-700">{t('signUpHere')}</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
