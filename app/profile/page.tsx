'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Navbar } from '@/components/navbar'
import { Sidebar } from '@/components/sidebar'
import { useLanguage } from '@/components/language-provider'
import { useAuthStore } from '@/lib/store'
import { resetPassword } from '@/lib/auth'

type ProfileData = {
  fullName: string
  email: string
  phone: string
  address: string
}

export default function ProfilePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [status, setStatus] = useState('')
  const { user, isLoggedIn, logout, setUser } = useAuthStore()
  const { language } = useLanguage()
  const isArabic = language === 'ar'

  const storageKey = useMemo(() => `ranch-profile:${user?.email || 'guest'}`, [user?.email])
  const [formData, setFormData] = useState<ProfileData>({
    fullName: user?.name || '',
    email: user?.email || '',
    phone: '',
    address: '',
  })

  useEffect(() => {
    const base = {
      fullName: user?.name || '',
      email: user?.email || '',
      phone: '',
      address: '',
    }

    if (!user?.email) {
      queueMicrotask(() => setFormData(base))
      return
    }

    try {
      const stored = localStorage.getItem(storageKey)
      const nextData = stored ? { ...base, ...JSON.parse(stored), email: user.email } : base
      queueMicrotask(() => setFormData(nextData))
    } catch {
      queueMicrotask(() => setFormData(base))
    }
  }, [storageKey, user])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [event.target.name]: event.target.value })
  }

  const handleSave = () => {
    if (!user) return
    localStorage.setItem(storageKey, JSON.stringify(formData))
    setUser({ ...user, name: formData.fullName || user.name, email: formData.email || user.email })
    fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
      }),
    }).catch(() => {})
    setIsEditing(false)
    setStatus(isArabic ? 'تم حفظ بيانات الحساب.' : 'Account details saved.')
  }

  const handlePasswordReset = async () => {
    if (!formData.email) return
    setStatus('')
    try {
      await resetPassword(formData.email)
      setStatus(isArabic ? 'تم إرسال رابط تغيير كلمة المرور إلى بريدك.' : 'Password reset link sent to your email.')
    } catch {
      setStatus(isArabic ? 'تعذر إرسال رابط تغيير كلمة المرور الآن.' : 'Could not send the password reset link right now.')
    }
  }

  const handleDeleteLocalAccount = () => {
    localStorage.removeItem(storageKey)
    logout()
  }

  const handleLogout = () => {
    logout()
    setSidebarOpen(false)
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isLoggedIn={isLoggedIn} onLogout={handleLogout} />
      <Navbar onMenuOpen={() => setSidebarOpen(true)} isLoggedIn={isLoggedIn} onLogout={handleLogout} />

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-8 text-3xl font-bold">{isArabic ? 'ملفي الشخصي' : 'My Profile'}</h1>

        {!isLoggedIn ? (
          <Card>
            <CardContent className="space-y-4 pt-6 text-center">
              <p className="text-slate-600 dark:text-slate-400">{isArabic ? 'سجل الدخول لعرض بيانات حسابك.' : 'Sign in to view your account details.'}</p>
              <Link href="/login"><Button className="bg-red-600 hover:bg-red-700">{isArabic ? 'تسجيل الدخول' : 'Login'}</Button></Link>
            </CardContent>
          </Card>
        ) : (
          <>
            {status && <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-200">{status}</div>}

            <Card className="mb-8">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{isArabic ? 'البيانات الشخصية' : 'Personal Information'}</CardTitle>
                <Button variant={isEditing ? 'default' : 'outline'} className={isEditing ? 'bg-red-600 hover:bg-red-700' : ''} onClick={() => (isEditing ? handleSave() : setIsEditing(true))}>
                  {isEditing ? (isArabic ? 'حفظ' : 'Save') : (isArabic ? 'تعديل' : 'Edit')}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="fullName">{isArabic ? 'الاسم الكامل' : 'Full Name'}</Label>
                  <Input id="fullName" name="fullName" value={formData.fullName} onChange={handleChange} disabled={!isEditing} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="email">{isArabic ? 'البريد الإلكتروني' : 'Email'}</Label>
                  <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} disabled className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="phone">{isArabic ? 'رقم الهاتف' : 'Phone Number'}</Label>
                  <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} disabled={!isEditing} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="address">{isArabic ? 'العنوان' : 'Address'}</Label>
                  <Input id="address" name="address" value={formData.address} onChange={handleChange} disabled={!isEditing} className="mt-1" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{isArabic ? 'إعدادات الحساب' : 'Account Settings'}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full" onClick={handlePasswordReset}>{isArabic ? 'تغيير كلمة المرور' : 'Change Password'}</Button>
                <Link href="/notifications" className="block"><Button variant="outline" className="w-full">{isArabic ? 'تفضيلات الإشعارات' : 'Notification Preferences'}</Button></Link>
                <Link href="/checkout" className="block"><Button variant="outline" className="w-full">{isArabic ? 'طرق الدفع' : 'Payment Methods'}</Button></Link>
                <Button variant="destructive" className="w-full" onClick={handleDeleteLocalAccount}>{isArabic ? 'حذف بيانات الحساب المحلية' : 'Delete Local Account Data'}</Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  )
}
