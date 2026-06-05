'use client'

import { ChangeEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileInput } from '@/components/ui/file-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/components/language-provider'
import { PrinterConnection, PrinterRole, useAppStore } from '@/lib/app-store'
import { imageFileToOptimizedDataUrl, isAcceptedImageFile } from '@/lib/client-images'
import { printPrinterTest } from '@/lib/order-print'
import { saveSharedSettings, useSharedAppData } from '@/lib/use-shared-app-data'

export default function DashboardSettingsPage() {
  useSharedAppData({ poll: false })
  const { language, setLanguage } = useLanguage()
  const { settings, updateSettings } = useAppStore()
  const [saveStatus, setSaveStatus] = useState('')
  const [offerImageStatus, setOfferImageStatus] = useState('')
  const [printerStatus, setPrinterStatus] = useState('')
  const [activeSection, setActiveSection] = useState<'general' | 'orders' | 'payments' | 'invoice' | 'printers'>('general')
  const isArabic = language === 'ar'

  const text = {
    title: isArabic ? 'الإعدادات' : 'Settings',
    subtitle: isArabic ? 'تحكم في بيانات التطبيق، اللغة، وصور العروض المتحركة.' : 'Manage app details, language, and the rotating offer images.',
    save: isArabic ? 'حفظ التغييرات' : 'Save Changes',
    saved: isArabic ? 'تم حفظ التغييرات وظهورها للجميع.' : 'Changes saved and published to everyone.',
    failed: isArabic ? 'تعذر حفظ التغييرات.' : 'Could not save changes.',
    appLanguage: isArabic ? 'لغة التطبيق' : 'App Language',
    languageHint: isArabic ? 'يتم حفظ اللغة واستخدامها في لوحة التحكم والتطبيق.' : 'The language is saved and used across the dashboard and app.',
    restaurantInfo: isArabic ? 'بيانات المطعم' : 'Restaurant Information',
    hero: isArabic ? 'بداية الصفحة الرئيسية' : 'Homepage Hero',
    orderDelivery: isArabic ? 'إعدادات الطلب والتوصيل' : 'Order and Delivery Settings',
    payments: isArabic ? 'طرق الدفع' : 'Payment Methods',
    printer: isArabic ? 'إعدادات الطابعة' : 'Printer Settings',
    invoice: isArabic ? 'بيانات الفاتورة' : 'Invoice Details',
  }

  const sections = [
    { id: 'general' as const, label: isArabic ? 'عام' : 'General' },
    { id: 'orders' as const, label: isArabic ? 'الطلب والتوصيل' : 'Orders' },
    { id: 'payments' as const, label: text.payments },
    { id: 'invoice' as const, label: text.invoice },
    { id: 'printers' as const, label: isArabic ? 'الطابعات' : 'Printers' },
  ]

  const handleOfferFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return
    const invalid = files.find((file) => !isAcceptedImageFile(file))
    if (invalid) {
      setOfferImageStatus(isArabic ? 'اختر ملفات صور فقط.' : 'Choose image files only.')
      return
    }

    setOfferImageStatus(isArabic ? 'جاري تجهيز صور العروض...' : 'Preparing offer images...')
    try {
      const images = await Promise.all(files.map((file) => imageFileToOptimizedDataUrl(file, { maxSize: 1800, quality: 0.88 })))
      updateSettings({ offerImages: [...(settings.offerImages || []), ...images] })
      setOfferImageStatus(isArabic ? `تم رفع ${images.length} صورة عروض.` : `${images.length} offer images uploaded.`)
    } catch {
      setOfferImageStatus(isArabic ? 'تعذر رفع صور العروض. حاول مرة أخرى.' : 'Could not upload offer images. Try again.')
    }
  }

  const removeOfferImage = (index: number) => {
    updateSettings({ offerImages: (settings.offerImages || []).filter((_, itemIndex) => itemIndex !== index) })
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

  const updatePrinter = (role: PrinterRole, updates: Partial<PrinterConnection>) => {
    updateSettings({
      printers: {
        ...settings.printers,
        [role]: { ...settings.printers[role], ...updates },
      },
    })
  }

  const testPrinter = (role: PrinterRole) => {
    const printer = settings.printers[role]
    const opened = printPrinterTest({
      isArabic,
      printerMethod: printerMethodLabel(printer.method, isArabic),
      paperWidth: printer.paperWidth || '80mm',
      printerName: printer.name || printer.ip,
      invoiceName: isArabic ? settings.invoiceNameAr : settings.invoiceNameEn,
      invoiceQrUrl: settings.invoiceQrUrl,
      invoiceMessage: isArabic ? settings.invoiceWelcomeAr : settings.invoiceWelcomeEn,
      printsMainInvoice: printer.printsMainInvoice,
      printsQr: printer.printsQr,
    })
    setPrinterStatus(opened
      ? (isArabic ? 'تم فتح فاتورة اختبار. اختر الطابعة المناسبة من نافذة الطباعة للتأكد من الاتصال.' : 'Test receipt opened. Choose the target printer in the print dialog to confirm connection.')
      : (isArabic ? 'المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى.' : 'The browser blocked the print window. Allow popups and try again.'))
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

      <div className="flex flex-wrap gap-2 rounded-md border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950">
        {sections.map((section) => (
          <Button
            key={section.id}
            type="button"
            variant={activeSection === section.id ? 'default' : 'ghost'}
            className={activeSection === section.id ? 'bg-red-600 hover:bg-red-700' : ''}
            onClick={() => setActiveSection(section.id)}
          >
            {section.label}
          </Button>
        ))}
      </div>

      {activeSection === 'general' && <Card>
        <CardHeader><CardTitle>{text.appLanguage}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button type="button" className={language === 'ar' ? 'bg-red-600 hover:bg-red-700' : ''} variant={language === 'ar' ? 'default' : 'outline'} onClick={() => { setLanguage('ar'); updateSettings({ defaultLanguage: 'ar' }) }}>العربية</Button>
            <Button type="button" className={language === 'en' ? 'bg-red-600 hover:bg-red-700' : ''} variant={language === 'en' ? 'default' : 'outline'} onClick={() => { setLanguage('en'); updateSettings({ defaultLanguage: 'en' }) }}>English</Button>
          </div>
          <p className="text-sm text-slate-500">{text.languageHint}</p>
        </CardContent>
      </Card>}

      {activeSection === 'general' && <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{text.restaurantInfo}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field id="name-ar" label={isArabic ? 'اسم التطبيق بالعربية' : 'App name in Arabic'} value={settings.restaurantNameAr} onChange={(value) => updateSettings({ restaurantNameAr: value })} />
            <Field id="name-en" label={isArabic ? 'اسم التطبيق بالإنجليزية' : 'App name in English'} value={settings.restaurantNameEn} onChange={(value) => updateSettings({ restaurantNameEn: value })} />
            <Field id="email" label={isArabic ? 'البريد الإلكتروني' : 'Email'} value={settings.email} onChange={(value) => updateSettings({ email: value })} type="email" />
            <Field id="phone" label={isArabic ? 'رقم الهاتف' : 'Phone'} value={settings.phone} onChange={(value) => updateSettings({ phone: value })} />
            <Field id="address-ar" label={isArabic ? 'العنوان بالعربية' : 'Address in Arabic'} value={settings.addressAr} onChange={(value) => updateSettings({ addressAr: value })} />
            <Field id="address-en" label={isArabic ? 'العنوان بالإنجليزية' : 'Address in English'} value={settings.addressEn} onChange={(value) => updateSettings({ addressEn: value })} />
            <Field id="hours-ar" label={isArabic ? 'أوقات العمل بالعربية' : 'Working hours in Arabic'} value={settings.workingHoursAr} onChange={(value) => updateSettings({ workingHoursAr: value })} />
            <Field id="hours-en" label={isArabic ? 'أوقات العمل بالإنجليزية' : 'Working hours in English'} value={settings.workingHoursEn} onChange={(value) => updateSettings({ workingHoursEn: value })} />
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
              <Label htmlFor="offer-images">{isArabic ? 'صور العروض المتحركة' : 'Offer Slider Images'}</Label>
              <FileInput id="offer-images" accept="image/*" multiple onChange={handleOfferFiles} className="mt-1" />
              <p className="mt-2 text-xs text-slate-500">{isArabic ? 'يمكنك رفع أكثر من صورة، وستظهر تلقائيا في بداية الصفحة الرئيسية.' : 'Upload multiple images; they will rotate automatically on the homepage.'}</p>
              {offerImageStatus && <p className="mt-2 text-sm text-slate-500">{offerImageStatus}</p>}
            </div>
            <OfferImagesPreview images={settings.offerImages || []} onRemove={removeOfferImage} isArabic={isArabic} />
          </CardContent>
        </Card>
      </div>}

      {activeSection === 'orders' && <Card>
        <CardHeader><CardTitle>{text.orderDelivery}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field id="delivery-fee" label={isArabic ? 'رسوم التوصيل' : 'Delivery Fee'} value={String(settings.deliveryFee)} onChange={(value) => updateSettings({ deliveryFee: Number(value) })} type="number" />
          <Field id="tax-rate" label={isArabic ? 'الضريبة %' : 'Tax %'} value={String(settings.taxRate * 100)} onChange={(value) => updateSettings({ taxRate: Number(value) / 100 })} type="number" />
          <Field id="delivery-time" label={isArabic ? 'وقت التوصيل بالدقائق' : 'Delivery Time in Minutes'} value={String(settings.deliveryTime)} onChange={(value) => updateSettings({ deliveryTime: Number(value) })} type="number" />
        </CardContent>
      </Card>}

      {activeSection === 'payments' && <Card>
        <CardHeader><CardTitle>{text.payments}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              id="vodafone-cash-number"
              label={isArabic ? 'رقم Vodafone Cash' : 'Vodafone Cash number'}
              value={settings.vodafoneCashNumber || '01090886364'}
              onChange={(value) => updateSettings({ vodafoneCashNumber: value })}
            />
            <Field
              id="instapay-number"
              label={isArabic ? 'رقم InstaPay' : 'InstaPay number'}
              value={settings.instapayNumber || '01090886364'}
              onChange={(value) => updateSettings({ instapayNumber: value })}
            />
          </div>
          <p className="text-sm text-slate-500">
            {isArabic
              ? 'هذه الأرقام تظهر للعميل في صفحة الدفع عند اختيار فودافون كاش أو إنستا باي، ويمكن تعديلها في أي وقت.'
              : 'These numbers appear on checkout when customers choose Vodafone Cash or InstaPay, and can be changed anytime.'}
          </p>
        </CardContent>
      </Card>}

      {activeSection === 'invoice' && <Card>
        <CardHeader><CardTitle>{text.invoice}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field id="invoice-name-ar" label={isArabic ? 'اسم المطعم في الفاتورة بالعربية' : 'Invoice restaurant name in Arabic'} value={settings.invoiceNameAr || ''} onChange={(value) => updateSettings({ invoiceNameAr: value })} />
            <Field id="invoice-name-en" label={isArabic ? 'اسم المطعم في الفاتورة بالإنجليزية' : 'Invoice restaurant name in English'} value={settings.invoiceNameEn || ''} onChange={(value) => updateSettings({ invoiceNameEn: value })} />
          </div>
          <Field id="invoice-qr-url" label={isArabic ? 'رابط يظهر QR في الفاتورة' : 'QR link shown on invoice'} value={settings.invoiceQrUrl || ''} onChange={(value) => updateSettings({ invoiceQrUrl: value })} />
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="invoice-welcome-ar">{isArabic ? 'رسالة الفاتورة بالعربية' : 'Invoice message in Arabic'}</Label>
              <Textarea id="invoice-welcome-ar" value={settings.invoiceWelcomeAr || ''} onChange={(event) => updateSettings({ invoiceWelcomeAr: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="invoice-welcome-en">{isArabic ? 'رسالة الفاتورة بالإنجليزية' : 'Invoice message in English'}</Label>
              <Textarea id="invoice-welcome-en" value={settings.invoiceWelcomeEn || ''} onChange={(event) => updateSettings({ invoiceWelcomeEn: event.target.value })} />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            {isArabic ? 'الرابط يتحول تلقائيا إلى QR في الفاتورة المطبوعة. استخدم رابط المنيو أو صفحة التتبع أو حسابات التواصل.' : 'The link is automatically rendered as a QR code on printed invoices. Use a menu, tracking, or social link.'}
          </p>
        </CardContent>
      </Card>}

      {activeSection === 'printers' && <Card>
        <CardHeader><CardTitle>{text.printer}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <PrinterCard
              role="cashier"
              title={isArabic ? 'طابعة الكاشير' : 'Cashier Printer'}
              description={isArabic ? 'الفاتورة الرئيسية وبها QR.' : 'Main invoice with QR.'}
              printer={settings.printers.cashier}
              isArabic={isArabic}
              onChange={updatePrinter}
              onTest={testPrinter}
            />
            <PrinterCard
              role="kitchen"
              title={isArabic ? 'طابعة المطبخ' : 'Kitchen Printer'}
              description={isArabic ? 'ورقة صغيرة بدون QR.' : 'Small ticket without QR.'}
              printer={settings.printers.kitchen}
              isArabic={isArabic}
              onChange={updatePrinter}
              onTest={testPrinter}
            />
            <PrinterCard
              role="hall"
              title={isArabic ? 'طابعة الصالة' : 'Hall Printer'}
              description={isArabic ? 'ورقة صغيرة بدون QR.' : 'Small ticket without QR.'}
              printer={settings.printers.hall}
              isArabic={isArabic}
              onChange={updatePrinter}
              onTest={testPrinter}
            />
          </div>
          <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            {isArabic
              ? 'الطباعة تتم من نافذة المتصفح. عرّف كل طابعة على الجهاز ثم اختر الطابعة المناسبة من نافذة الطباعة.'
              : 'Printing uses the browser print dialog. Install each printer on the device, then choose the target printer in the print dialog.'}
          </div>
          {printerStatus && <p className="text-sm text-slate-500">{printerStatus}</p>}
        </CardContent>
      </Card>}

      <div className="flex justify-end">
        <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700">{text.save}</Button>
      </div>
    </div>
  )
}

function OfferImagesPreview({ images, onRemove, isArabic }: { images: string[]; onRemove: (index: number) => void; isArabic: boolean }) {
  if (images.length === 0) {
    return <p className="rounded-md border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500 dark:border-slate-800">{isArabic ? 'لا توجد صور عروض بعد.' : 'No offer images yet.'}</p>
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {images.map((image, index) => (
        <OfferImageTile key={`${image.slice(0, 24)}-${index}`} image={image} index={index} isArabic={isArabic} onRemove={onRemove} />
      ))}
    </div>
  )
}

function OfferImageTile({ image, index, isArabic, onRemove }: { image: string; index: number; isArabic: boolean; onRemove: (index: number) => void }) {
  const [failedImage, setFailedImage] = useState('')
  const failed = failedImage === image

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 dark:border-slate-800">
      <div className="flex h-32 items-center justify-center bg-slate-50 p-2 text-sm text-slate-500 dark:bg-slate-900">
        {!failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={`Offer ${index + 1}`} className="h-full w-full object-contain" onError={() => setFailedImage(image)} />
        ) : (
          <span>{isArabic ? 'الصورة غير قابلة للعرض' : 'Image cannot be displayed'}</span>
        )}
      </div>
      <Button type="button" variant="destructive" size="sm" className="w-full rounded-none" onClick={() => onRemove(index)}>
        {isArabic ? 'حذف الصورة' : 'Remove Image'}
      </Button>
    </div>
  )
}

function PrinterCard({
  role,
  title,
  description,
  printer,
  isArabic,
  onChange,
  onTest,
}: {
  role: PrinterRole
  title: string
  description: string
  printer: PrinterConnection
  isArabic: boolean
  onChange: (role: PrinterRole, updates: Partial<PrinterConnection>) => void
  onTest: (role: PrinterRole) => void
}) {
  return (
    <div className="rounded-md border border-slate-200 p-4 dark:border-slate-800">
      <div className="mb-4">
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      <div className="space-y-3">
        <Field id={`printer-${role}-name`} label={isArabic ? 'اسم الطابعة أو ملاحظة الربط' : 'Printer name or connection note'} value={printer.name || ''} onChange={(value) => onChange(role, { name: value })} />
        <div>
          <Label htmlFor={`printer-${role}-method`}>{isArabic ? 'طريقة الربط' : 'Connection method'}</Label>
          <select
            id={`printer-${role}-method`}
            value={printer.method || 'browser'}
            onChange={(event) => onChange(role, { method: event.target.value as PrinterConnection['method'] })}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
          >
            <option value="browser">{isArabic ? 'طباعة المتصفح' : 'Browser print'}</option>
            <option value="usb">USB</option>
            <option value="bluetooth">Bluetooth</option>
            <option value="network">{isArabic ? 'شبكة / IP' : 'Network / IP'}</option>
          </select>
        </div>
        <div>
          <Label htmlFor={`printer-${role}-paper`}>{isArabic ? 'مقاس الورق' : 'Paper width'}</Label>
          <select
            id={`printer-${role}-paper`}
            value={printer.paperWidth || '80mm'}
            onChange={(event) => onChange(role, { paperWidth: event.target.value as PrinterConnection['paperWidth'] })}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
          >
            <option value="80mm">80mm</option>
            <option value="58mm">58mm</option>
          </select>
        </div>
        <Field id={`printer-${role}-ip`} label={isArabic ? 'IP الطابعة الشبكية' : 'Network printer IP'} value={printer.ip || ''} onChange={(value) => onChange(role, { ip: value })} />
        <Button type="button" variant="outline" className="w-full" onClick={() => onTest(role)}>
          {isArabic ? 'تأكيد الاتصال' : 'Test Connection'}
        </Button>
      </div>
    </div>
  )
}

function printerMethodLabel(method: string | undefined, isArabic: boolean) {
  const labels: Record<string, { ar: string; en: string }> = {
    browser: { ar: 'طباعة المتصفح', en: 'Browser print' },
    usb: { ar: 'USB', en: 'USB' },
    bluetooth: { ar: 'Bluetooth', en: 'Bluetooth' },
    network: { ar: 'شبكة / IP', en: 'Network / IP' },
  }
  return labels[method || 'browser']?.[isArabic ? 'ar' : 'en'] || method || labels.browser[isArabic ? 'ar' : 'en']
}

function Field({ id, label, value, onChange, type = 'text' }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}
