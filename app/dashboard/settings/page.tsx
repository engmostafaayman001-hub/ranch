'use client'

import { ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileInput } from '@/components/ui/file-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/components/language-provider'
import { useAppStore } from '@/lib/app-store'

export default function DashboardSettingsPage() {
  const { language, setLanguage } = useLanguage()
  const { settings, updateSettings } = useAppStore()
  const isArabic = language === 'ar'

  const handleHeroFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      updateSettings({ heroImage: String(reader.result) })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">{isArabic ? 'الإعدادات' : 'Settings'}</h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          {isArabic ? 'تحكم في بيانات التطبيق، اللغة، وصورة بداية الصفحة.' : 'Manage app details, language, and the homepage hero image.'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isArabic ? 'لغة التطبيق' : 'App Language'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button type="button" className={language === 'ar' ? 'bg-red-600 hover:bg-red-700' : ''} variant={language === 'ar' ? 'default' : 'outline'} onClick={() => setLanguage('ar')}>
              العربية
            </Button>
            <Button type="button" className={language === 'en' ? 'bg-red-600 hover:bg-red-700' : ''} variant={language === 'en' ? 'default' : 'outline'} onClick={() => setLanguage('en')}>
              English
            </Button>
          </div>
          <p className="text-sm text-slate-500">
            {isArabic ? 'سيتم حفظ اللغة واستخدامها في لوحة التحكم والتطبيق.' : 'The language is saved and used across the dashboard and app.'}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{isArabic ? 'بيانات المطعم' : 'Restaurant Information'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name-ar">اسم التطبيق بالعربي</Label>
              <Input id="name-ar" value={settings.restaurantNameAr} onChange={(event) => updateSettings({ restaurantNameAr: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="name-en">App name in English</Label>
              <Input id="name-en" value={settings.restaurantNameEn} onChange={(event) => updateSettings({ restaurantNameEn: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="email">{isArabic ? 'البريد الإلكتروني' : 'Email'}</Label>
              <Input id="email" type="email" value={settings.email} onChange={(event) => updateSettings({ email: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="phone">{isArabic ? 'رقم الهاتف' : 'Phone'}</Label>
              <Input id="phone" value={settings.phone} onChange={(event) => updateSettings({ phone: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="address-ar">العنوان بالعربي</Label>
              <Input id="address-ar" value={settings.addressAr} onChange={(event) => updateSettings({ addressAr: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="address-en">Address in English</Label>
              <Input id="address-en" value={settings.addressEn} onChange={(event) => updateSettings({ addressEn: event.target.value })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isArabic ? 'بداية الصفحة الرئيسية' : 'Homepage Hero'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="hero-title-ar">العنوان بالعربي</Label>
              <Input id="hero-title-ar" value={settings.heroTitleAr} onChange={(event) => updateSettings({ heroTitleAr: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="hero-title-en">Hero title in English</Label>
              <Input id="hero-title-en" value={settings.heroTitleEn} onChange={(event) => updateSettings({ heroTitleEn: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="hero-subtitle-ar">الوصف بالعربي</Label>
              <Textarea id="hero-subtitle-ar" value={settings.heroSubtitleAr} onChange={(event) => updateSettings({ heroSubtitleAr: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="hero-subtitle-en">Hero description in English</Label>
              <Textarea id="hero-subtitle-en" value={settings.heroSubtitleEn} onChange={(event) => updateSettings({ heroSubtitleEn: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="hero-image">{isArabic ? 'صورة بداية الصفحة' : 'Hero Image'}</Label>
              <FileInput id="hero-image" accept="image/*" onChange={handleHeroFile} className="mt-1" />
              <p className="mt-2 text-xs text-slate-500">
                {isArabic ? 'يمكنك رفع صورة طعام، أو وضع رمز/رابط في الحقل التالي.' : 'Upload a food image, or set an emoji/link in the field below.'}
              </p>
            </div>
            <div>
              <Label htmlFor="hero-image-text">{isArabic ? 'الصورة الحالية أو الرمز' : 'Current image or emoji'}</Label>
              <Input id="hero-image-text" value={settings.heroImage} onChange={(event) => updateSettings({ heroImage: event.target.value })} />
            </div>
            <HeroPreview value={settings.heroImage} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isArabic ? 'إعدادات الطلب والتوصيل' : 'Order and Delivery Settings'}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="delivery-fee">{isArabic ? 'رسوم التوصيل' : 'Delivery Fee'}</Label>
            <Input id="delivery-fee" type="number" min="0" step="0.01" value={settings.deliveryFee} onChange={(event) => updateSettings({ deliveryFee: Number(event.target.value) })} />
          </div>
          <div>
            <Label htmlFor="tax-rate">{isArabic ? 'الضريبة %' : 'Tax %'}</Label>
            <Input id="tax-rate" type="number" min="0" step="1" value={settings.taxRate * 100} onChange={(event) => updateSettings({ taxRate: Number(event.target.value) / 100 })} />
          </div>
          <div>
            <Label htmlFor="delivery-time">{isArabic ? 'وقت التوصيل بالدقائق' : 'Delivery Time in Minutes'}</Label>
            <Input id="delivery-time" type="number" min="1" value={settings.deliveryTime} onChange={(event) => updateSettings({ deliveryTime: Number(event.target.value) })} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function HeroPreview({ value }: { value: string }) {
  const isImage = value.startsWith('data:image') || value.startsWith('http') || value.startsWith('/')
  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="Hero preview" className="h-48 w-full object-cover" />
      ) : (
        <div className="flex h-48 items-center justify-center text-7xl">{value || '🍔'}</div>
      )}
    </div>
  )
}
