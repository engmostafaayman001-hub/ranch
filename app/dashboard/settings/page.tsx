'use client'

import { ChangeEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileInput } from '@/components/ui/file-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/components/language-provider'
import { useAppStore } from '@/lib/app-store'
import { saveSharedSettings, useSharedAppData } from '@/lib/use-shared-app-data'

export default function DashboardSettingsPage() {
  useSharedAppData()
  const { language, setLanguage } = useLanguage()
  const { settings, updateSettings } = useAppStore()
  const [saveStatus, setSaveStatus] = useState('')
  const isArabic = language === 'ar'

  const text = {
    title: isArabic ? 'الإعدادات' : 'Settings',
    subtitle: isArabic ? 'تحكم في بيانات التطبيق، اللغة، وصورة الصفحة الرئيسية.' : 'Manage app details, language, and the homepage hero image.',
    save: isArabic ? 'حفظ التغييرات' : 'Save Changes',
    saved: isArabic ? 'تم حفظ التغييرات وظهورها للجميع.' : 'Changes saved and published to everyone.',
    failed: isArabic ? 'تعذر حفظ التغييرات.' : 'Could not save changes.',
    appLanguage: isArabic ? 'لغة التطبيق' : 'App Language',
    languageHint: isArabic ? 'يتم حفظ اللغة واستخدامها في لوحة التحكم والتطبيق.' : 'The language is saved and used across the dashboard and app.',
    restaurantInfo: isArabic ? 'بيانات المطعم' : 'Restaurant Information',
    hero: isArabic ? 'بداية الصفحة الرئيسية' : 'Homepage Hero',
    orderDelivery: isArabic ? 'إعدادات الطلب والتوصيل' : 'Order and Delivery Settings',
  }

  const handleHeroFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => updateSettings({ heroImage: String(reader.result) })
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    try {
      const data = await saveSharedSettings(settings)
      if (data.settings) updateSettings(data.settings)
      setSaveStatus(text.saved)
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : text.failed)
    }
    window.setTimeout(() => setSaveStatus(''), 3000)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold">{text.title}</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">{text.subtitle}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700">{text.save}</Button>
          {saveStatus && <p className="text-sm font-medium text-green-600">{saveStatus}</p>}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>{text.appLanguage}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button type="button" className={language === 'ar' ? 'bg-red-600 hover:bg-red-700' : ''} variant={language === 'ar' ? 'default' : 'outline'} onClick={() => setLanguage('ar')}>العربية</Button>
            <Button type="button" className={language === 'en' ? 'bg-red-600 hover:bg-red-700' : ''} variant={language === 'en' ? 'default' : 'outline'} onClick={() => setLanguage('en')}>English</Button>
          </div>
          <p className="text-sm text-slate-500">{text.languageHint}</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{text.restaurantInfo}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field id="name-ar" label={isArabic ? 'اسم التطبيق بالعربية' : 'App name in Arabic'} value={settings.restaurantNameAr} onChange={(value) => updateSettings({ restaurantNameAr: value })} />
            <Field id="name-en" label={isArabic ? 'اسم التطبيق بالإنجليزية' : 'App name in English'} value={settings.restaurantNameEn} onChange={(value) => updateSettings({ restaurantNameEn: value })} />
            <Field id="email" label={isArabic ? 'البريد الإلكتروني' : 'Email'} value={settings.email} onChange={(value) => updateSettings({ email: value })} type="email" />
            <Field id="phone" label={isArabic ? 'رقم الهاتف' : 'Phone'} value={settings.phone} onChange={(value) => updateSettings({ phone: value })} />
            <Field id="address-ar" label={isArabic ? 'العنوان بالعربية' : 'Address in Arabic'} value={settings.addressAr} onChange={(value) => updateSettings({ addressAr: value })} />
            <Field id="address-en" label={isArabic ? 'العنوان بالإنجليزية' : 'Address in English'} value={settings.addressEn} onChange={(value) => updateSettings({ addressEn: value })} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{text.hero}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field id="hero-title-ar" label={isArabic ? 'العنوان بالعربية' : 'Hero title in Arabic'} value={settings.heroTitleAr} onChange={(value) => updateSettings({ heroTitleAr: value })} />
            <Field id="hero-title-en" label={isArabic ? 'العنوان بالإنجليزية' : 'Hero title in English'} value={settings.heroTitleEn} onChange={(value) => updateSettings({ heroTitleEn: value })} />
            <div>
              <Label htmlFor="hero-subtitle-ar">{isArabic ? 'الوصف بالعربية' : 'Hero description in Arabic'}</Label>
              <Textarea id="hero-subtitle-ar" value={settings.heroSubtitleAr} onChange={(event) => updateSettings({ heroSubtitleAr: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="hero-subtitle-en">{isArabic ? 'الوصف بالإنجليزية' : 'Hero description in English'}</Label>
              <Textarea id="hero-subtitle-en" value={settings.heroSubtitleEn} onChange={(event) => updateSettings({ heroSubtitleEn: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="hero-image">{isArabic ? 'صورة الصفحة الرئيسية' : 'Hero Image'}</Label>
              <FileInput id="hero-image" accept="image/*" onChange={handleHeroFile} className="mt-1" />
              <p className="mt-2 text-xs text-slate-500">{isArabic ? 'ارفع صورة، أو اكتب رابط/رمز في الحقل التالي.' : 'Upload an image, or set an emoji/link in the field below.'}</p>
            </div>
            <Field id="hero-image-text" label={isArabic ? 'الصورة الحالية أو الرابط' : 'Current image or emoji'} value={settings.heroImage} onChange={(value) => updateSettings({ heroImage: value })} />
            <HeroPreview value={settings.heroImage} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{text.orderDelivery}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field id="delivery-fee" label={isArabic ? 'رسوم التوصيل' : 'Delivery Fee'} value={String(settings.deliveryFee)} onChange={(value) => updateSettings({ deliveryFee: Number(value) })} type="number" />
          <Field id="tax-rate" label={isArabic ? 'الضريبة %' : 'Tax %'} value={String(settings.taxRate * 100)} onChange={(value) => updateSettings({ taxRate: Number(value) / 100 })} type="number" />
          <Field id="delivery-time" label={isArabic ? 'وقت التوصيل بالدقائق' : 'Delivery Time in Minutes'} value={String(settings.deliveryTime)} onChange={(value) => updateSettings({ deliveryTime: Number(value) })} type="number" />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700">{text.save}</Button>
      </div>
    </div>
  )
}

function Field({ id, label, value, onChange, type = 'text' }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
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
        <div className="flex h-48 items-center justify-center text-7xl">{value || '🍽️'}</div>
      )}
    </div>
  )
}
