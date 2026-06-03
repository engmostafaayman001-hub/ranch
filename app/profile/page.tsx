'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sidebar } from '@/components/sidebar'
import { useAuthStore } from '@/lib/store'
import { useLanguage } from '@/components/language-provider'
import { Logo } from '@/components/logo'

export default function ProfilePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { isLoggedIn, logout } = useAuthStore()
  const { language, appName, t } = useLanguage()
  const isArabic = language === 'ar'
  const [formData, setFormData] = useState({
    fullName: 'أحمد محمد',
    email: 'ahmed@example.com',
    phone: '01234567890',
    address: '123 شارع النيل، القاهرة، مصر 12345',
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSave = () => {
    setIsEditing(false)
  }

  const handleLogout = () => {
    logout()
    setSidebarOpen(false)
  }

  if (!mounted) return null

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isLoggedIn={isLoggedIn}
        onLogout={handleLogout}
      />

      {/* Navigation */}
      <nav className="sticky top-0 z-40 w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3 flex-row-reverse">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden"
              >
                ☰
              </Button>
              <Link href="/" className="flex items-center space-x-3 flex-row-reverse">
                <Logo size="md" />
                <span className="font-bold text-lg text-red-600 hidden sm:inline">{appName}</span>
              </Link>
            </div>
            <div className="hidden lg:flex gap-2 flex-row-reverse">
              {isLoggedIn && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  ✓ {isArabic ? 'تم تسجيل الدخول' : 'Logged in'}
                </span>
              )}
              <Button onClick={handleLogout} variant="destructive">
                {t('logout')}
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-8">{isArabic ? 'ملفي الشخصي' : 'My Profile'}</h1>

        {/* Profile Information */}
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between flex-row-reverse">
            <CardTitle>{isArabic ? 'البيانات الشخصية' : 'Personal Information'}</CardTitle>
            <Button
              variant={isEditing ? 'default' : 'outline'}
              onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
            >
              {isEditing ? (isArabic ? 'حفظ' : 'Save') : (isArabic ? 'تعديل' : 'Edit')}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="fullName">{isArabic ? 'الاسم الكامل' : 'Full Name'}</Label>
              <Input
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                disabled={!isEditing}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                disabled={!isEditing}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="phone">{isArabic ? 'رقم الهاتف' : 'Phone Number'}</Label>
              <Input
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                disabled={!isEditing}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="address">{isArabic ? 'العنوان' : 'Address'}</Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                disabled={!isEditing}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Account Settings */}
        <Card>
          <CardHeader>
            <CardTitle>{isArabic ? 'إعدادات الحساب' : 'Account Settings'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full">
              {isArabic ? 'تغيير كلمة المرور' : 'Change Password'}
            </Button>
            <Button variant="outline" className="w-full">
              {isArabic ? 'تفضيلات الإخطارات' : 'Notification Preferences'}
            </Button>
            <Button variant="outline" className="w-full">
              {isArabic ? 'طرق الدفع' : 'Payment Methods'}
            </Button>
            <Button variant="destructive" className="w-full">
              {isArabic ? 'حذف الحساب' : 'Delete Account'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
