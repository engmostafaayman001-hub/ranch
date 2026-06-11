'use client'

import { ChangeEvent, useState } from 'react'
import { AlertCircle, Bluetooth, CheckCircle2, ClipboardCheck, PrinterCheck, QrCode, ReceiptText, Usb, Utensils, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileInput } from '@/components/ui/file-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/components/language-provider'
import { defaultPrinters, PrinterConnection, PrinterMethod, PrinterRole, useAppStore } from '@/lib/app-store'
import { imageFileToOptimizedDataUrl, isAcceptedImageFile } from '@/lib/client-images'
import {
  printerManager,
  syncPrinterManagerSettings,
  type AvailablePrinterDevice,
  type PrinterRuntimeDiagnostic,
  type ThermalPrinterSettings,
} from '@/lib/printer'
import { saveSharedSettings, useSharedAppData } from '@/lib/use-shared-app-data'

const APP_LOGO_URL = '/logo.png'

export default function DashboardSettingsPage() {
  const { loading: settingsLoading } = useSharedAppData({ poll: false })
  const { language, setLanguage } = useLanguage()
  const { settings, updateSettings } = useAppStore()
  const [saveStatus, setSaveStatus] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [offerImageStatus, setOfferImageStatus] = useState('')
  const [printerStatus, setPrinterStatus] = useState<Partial<Record<PrinterRole, string>>>({})
  const [discoveredPrinters, setDiscoveredPrinters] = useState<AvailablePrinterDevice[]>([])
  const [isDiscoveringPrinters, setIsDiscoveringPrinters] = useState(false)
  const [printerDiscoveryStatus, setPrinterDiscoveryStatus] = useState('')
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

  const handleInvoiceLogoFile = async (event: ChangeEvent<HTMLInputElement>) => {
    if (settingsLoading) {
      event.target.value = ''
      setOfferImageStatus(isArabic ? 'انتظر لحظة حتى تنتهي الإعدادات من التحميل.' : 'Wait a moment for settings to finish loading.')
      return
    }
    const file = event.target.files?.[0]
    if (!file) return
    if (!isAcceptedImageFile(file)) {
      setOfferImageStatus(isArabic ? 'اختر ملف صورة للوجو.' : 'Choose an image file for the logo.')
      return
    }

    setOfferImageStatus(isArabic ? 'جاري تجهيز لوجو الفاتورة...' : 'Preparing invoice logo...')
    try {
      const logo = await imageFileToOptimizedDataUrl(file, { maxSize: 700, quality: 0.9 })
      updateSettings({ invoiceLogo: logo })
      event.target.value = ''
      setOfferImageStatus(isArabic ? 'تم تجهيز لوجو الفاتورة. اضغط حفظ التغييرات لاعتماده.' : 'Invoice logo is ready. Press Save Changes to publish it.')
    } catch {
      setOfferImageStatus(isArabic ? 'تعذر رفع لوجو الفاتورة.' : 'Could not upload invoice logo.')
    }
  }

  const useAppLogo = () => {
    updateSettings({ invoiceLogo: APP_LOGO_URL })
    setOfferImageStatus(isArabic ? 'تم اختيار لوجو التطبيق. اضغط حفظ التغييرات لاعتماده.' : 'App logo selected. Press Save Changes to publish it.')
  }

  const updateInvoiceQr = (key: 'invoiceQrUrl' | 'invoiceQrUrl2', value: string) => {
    if (!value.trim()) {
      updateSettings({ [key]: value })
      return
    }
    const printers = {
      ...settings.printers,
      cashier: { ...settings.printers.cashier, printsQr: true },
    }
    updateSettings({ [key]: value, printers })
    syncPrinterManagerSettings(printers)
  }

  const handleSave = async () => {
    if (isSaving || settingsLoading) return
    setIsSaving(true)
    setSaveStatus(isArabic ? 'جاري حفظ التغييرات...' : 'Saving changes...')
    try {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
      let latestSettings = useAppStore.getState().settings
      const hasQrLinks = Boolean(latestSettings.invoiceQrUrl?.trim() || latestSettings.invoiceQrUrl2?.trim())
      if (hasQrLinks && latestSettings.printers.cashier.printsQr === false) {
        const printers = {
          ...latestSettings.printers,
          cashier: { ...latestSettings.printers.cashier, printsQr: true },
        }
        latestSettings = { ...latestSettings, printers }
        updateSettings({ printers })
        syncPrinterManagerSettings(printers)
      }
      const data = await saveSharedSettings(latestSettings)
      if (data.settings) updateSettings(data.settings)
      setSaveStatus(text.saved)
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : text.failed)
    } finally {
      setIsSaving(false)
    }
    window.setTimeout(() => setSaveStatus(''), 3000)
  }

  const updatePrinter = (role: PrinterRole, updates: Partial<PrinterConnection>) => {
    const currentPrinters = useAppStore.getState().settings.printers
    const currentPrinter = currentPrinters[role]
    const normalizedUpdates = updates.method
      ? { ...updates, connectionType: updates.method }
      : updates.connectionType
        ? { ...updates, method: updates.connectionType }
        : updates
    const nextMethod = normalizedUpdates.method || normalizedUpdates.connectionType
    const methodChanged = Boolean(nextMethod && nextMethod !== (currentPrinter.method || currentPrinter.connectionType))
    const hasVerifiedConnection = Boolean(normalizedUpdates.lastConnected || normalizedUpdates.lastConnectedMethod)
    const isolatedUpdates: Partial<PrinterConnection> = methodChanged && !hasVerifiedConnection
      ? {
          ...normalizedUpdates,
          lastConnected: '',
          lastConnectedMethod: '',
          ...(nextMethod === 'network'
            ? { deviceId: '', deviceName: currentPrinter.name, deviceAddress: currentPrinter.ip || currentPrinter.deviceAddress || '' }
            : { ip: '', deviceAddress: '', deviceId: '', deviceName: currentPrinter.name }),
        }
      : normalizedUpdates
    const printers = {
      ...currentPrinters,
      [role]: { ...currentPrinter, ...isolatedUpdates },
    }
    updateSettings({ printers: { ...printers } })
    syncPrinterManagerSettings(printers)
  }

  const resetPrinter = (role: PrinterRole) => {
    const currentPrinters = useAppStore.getState().settings.printers
    const printers = {
      ...currentPrinters,
      [role]: { ...defaultPrinters[role] },
    }
    updateSettings({ printers })
    syncPrinterManagerSettings(printers)
    setPrinterStatus((current) => ({
      ...current,
      [role]: isArabic ? 'تم مسح بيانات هذه الطابعة من هذا الجهاز.' : 'This printer was reset on this device.',
    }))
  }

  const discoverPrinters = async () => {
    if (isDiscoveringPrinters) return
    setIsDiscoveringPrinters(true)
    setPrinterDiscoveryStatus(isArabic ? 'جاري فحص الأجهزة المتاحة...' : 'Scanning available printer devices...')
    try {
      syncPrinterManagerSettings(useAppStore.getState().settings.printers)
      const devices = await printerManager.discoverAvailablePrinters()
      setDiscoveredPrinters(devices)
      setPrinterDiscoveryStatus(devices.length
        ? (isArabic ? `تم العثور على ${devices.length} جهاز/مسار طباعة.` : `Found ${devices.length} printer device/path(s).`)
        : (isArabic ? 'لم يتم العثور على أجهزة مصرح بها. اربط USB/Bluetooth أو شغل Network Bridge.' : 'No authorized devices found. Pair USB/Bluetooth or start Network Bridge.'))
    } catch (error) {
      setPrinterDiscoveryStatus(error instanceof Error ? error.message : (isArabic ? 'تعذر فحص الطابعات.' : 'Could not scan printers.'))
    } finally {
      setIsDiscoveringPrinters(false)
    }
  }

  const connectPrinter = async (role: PrinterRole, selectedMethod?: PrinterMethod) => {
    const currentPrinters = useAppStore.getState().settings.printers
    const currentPrinter = currentPrinters[role]
    const method = selectedMethod || currentPrinter.method || currentPrinter.connectionType || 'network'
    const printers = {
      ...currentPrinters,
      [role]: { ...currentPrinter, method, connectionType: method, isEnabled: true },
    }
    updateSettings({ printers: { ...printers } })
    syncPrinterManagerSettings(printers)
    setPrinterStatus((current) => ({ ...current, [role]: isArabic ? 'جاري ربط الطابعة...' : 'Connecting printer...' }))
    try {
      const result = await printerManager.connectPrinter(role)
      updatePrinter(role, {
        method,
        connectionType: method,
        deviceId: result.printer.deviceId || '',
        deviceName: result.printer.deviceName || result.printer.name || useAppStore.getState().settings.printers[role].deviceName,
        deviceAddress: method === 'network' ? result.printer.deviceAddress || useAppStore.getState().settings.printers[role].deviceAddress : '',
        ip: method === 'network' ? result.printer.ip || useAppStore.getState().settings.printers[role].ip : '',
        lastConnected: result.printer.lastConnected || new Date().toISOString(),
        lastConnectedMethod: method,
        failedAttempts: result.printer.failedAttempts || 0,
        lastError: result.printer.lastError || '',
      })
      setPrinterStatus((current) => ({ ...current, [role]: isArabic ? 'تم ربط الطابعة. ستتم الطباعة تلقائيا في الطلبات التالية.' : 'Printer connected. Future orders will print automatically.' }))
    } catch (error) {
      setPrinterStatus((current) => ({ ...current, [role]: error instanceof Error ? error.message : (isArabic ? 'تعذر ربط الطابعة.' : 'Could not connect printer.') }))
    }
  }

  const testPrinter = async (role: PrinterRole, kind: 'connection' | 'arabic' | 'qr' | 'kitchen' | 'hall' = 'arabic', selectedMethod?: PrinterMethod) => {
    const latestSettings = useAppStore.getState().settings
    const currentPrinter = latestSettings.printers[role]
    const method = selectedMethod || currentPrinter.method || currentPrinter.connectionType || 'network'
    const printers = {
      ...latestSettings.printers,
      [role]: { ...currentPrinter, method, connectionType: method, isEnabled: true },
    }
    updateSettings({ printers: { ...printers } })
    syncPrinterManagerSettings(printers)
    setPrinterStatus((current) => ({ ...current, [role]: isArabic ? 'جاري اختبار الطابعة...' : 'Testing printer...' }))
    try {
      let testedPrinter: ThermalPrinterSettings = useAppStore.getState().settings.printers[role]
      if (kind === 'connection') {
        const result = await printerManager.testConnection(role)
        testedPrinter = result.printer || printerManager.getPrinters()[role]
      } else {
        const printSettings = useAppStore.getState().settings
        await printerManager.printTest(role, kind === 'kitchen' ? 'kitchen' : kind === 'hall' ? 'hall' : 'diagnostic', {
          invoiceName: isArabic ? printSettings.invoiceNameAr : printSettings.invoiceNameEn,
          invoiceAddress: isArabic ? printSettings.addressAr : printSettings.addressEn,
          invoicePhone: printSettings.phone,
          invoiceQrUrl: kind === 'qr' ? printSettings.invoiceQrUrl || 'https://markode.co' : '',
          invoiceQrUrl2: kind === 'qr' ? printSettings.invoiceQrUrl2 : '',
          invoiceMessage: isArabic ? printSettings.invoiceWelcomeAr : printSettings.invoiceWelcomeEn,
          logoUrl: printSettings.invoiceLogo,
          isArabic,
        })
        testedPrinter = printerManager.getPrinters()[role]
      }
      updatePrinter(role, {
        method,
        connectionType: method,
        deviceId: testedPrinter.deviceId || useAppStore.getState().settings.printers[role].deviceId || '',
        deviceName: testedPrinter.deviceName || testedPrinter.name || useAppStore.getState().settings.printers[role].deviceName,
        deviceAddress: method === 'network' ? testedPrinter.deviceAddress || useAppStore.getState().settings.printers[role].deviceAddress : '',
        ip: method === 'network' ? testedPrinter.ip || useAppStore.getState().settings.printers[role].ip : '',
        lastConnected: testedPrinter.lastConnected || new Date().toISOString(),
        lastConnectedMethod: method,
        lastPrinted: testedPrinter.lastPrinted || useAppStore.getState().settings.printers[role].lastPrinted || '',
        failedAttempts: testedPrinter.failedAttempts || 0,
        lastError: testedPrinter.lastError || '',
      })
      setPrinterStatus((current) => ({ ...current, [role]: isArabic ? 'تم إرسال أمر الاختبار بنجاح.' : 'Test command sent successfully.' }))
    } catch (error) {
      setPrinterStatus((current) => ({ ...current, [role]: error instanceof Error ? error.message : (isArabic ? 'تعذر اختبار الطابعة.' : 'Could not test printer.') }))
    }
  }

  const invoiceLogoPreview = settings.invoiceLogo || APP_LOGO_URL
  const printerDiagnostics = printerManager.getDiagnostics()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold">{text.title}</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">{text.subtitle}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button onClick={handleSave} disabled={isSaving || settingsLoading} className="bg-red-600 hover:bg-red-700">
            {isSaving ? (isArabic ? 'جاري الحفظ...' : 'Saving...') : text.save}
          </Button>
          {saveStatus && <p className={`text-sm font-medium ${isSaving ? 'text-slate-500' : 'text-green-600'}`}>{saveStatus}</p>}
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
          <div className="grid gap-4 md:grid-cols-[12rem_1fr]">
            <div className="flex h-36 items-center justify-center rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
              {invoiceLogoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={invoiceLogoPreview} alt="Invoice logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-sm text-slate-500">{isArabic ? 'لا يوجد لوجو' : 'No logo'}</span>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="invoice-logo">{isArabic ? 'لوجو الفاتورة' : 'Invoice logo'}</Label>
                <FileInput id="invoice-logo" accept="image/*" onChange={handleInvoiceLogoFile} disabled={settingsLoading || isSaving} className="mt-1" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={useAppLogo} disabled={settingsLoading || isSaving}>
                  {isArabic ? 'استخدام لوجو التطبيق' : 'Use app logo'}
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                {isArabic ? 'سيظهر هذا اللوجو أعلى فاتورة الكاشير فقط، ولا يظهر في تذاكر المطبخ أو الصالة.' : 'This logo appears at the top of cashier receipts only, not kitchen or hall tickets.'}
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field id="invoice-name-ar" label={isArabic ? 'اسم المطعم في الفاتورة بالعربية' : 'Invoice restaurant name in Arabic'} value={settings.invoiceNameAr || ''} onChange={(value) => updateSettings({ invoiceNameAr: value })} />
            <Field id="invoice-name-en" label={isArabic ? 'اسم المطعم في الفاتورة بالإنجليزية' : 'Invoice restaurant name in English'} value={settings.invoiceNameEn || ''} onChange={(value) => updateSettings({ invoiceNameEn: value })} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field id="invoice-qr-url" label={isArabic ? 'رابط QR الأول في الفاتورة' : 'First invoice QR link'} value={settings.invoiceQrUrl || ''} onChange={(value) => updateInvoiceQr('invoiceQrUrl', value)} />
            <Field id="invoice-qr-url-2" label={isArabic ? 'رابط QR الثاني في الفاتورة' : 'Second invoice QR link'} value={settings.invoiceQrUrl2 || ''} onChange={(value) => updateInvoiceQr('invoiceQrUrl2', value)} />
          </div>
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
          <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm leading-7 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-100">
            {isArabic
              ? 'للطباعة المباشرة على XPrinter بدون نافذة شغّل npm run print-bridge ثم اختر Network Bridge واستخدم http://127.0.0.1:17878/print. Bluetooth وUSB يطلبان اختيار الجهاز من المتصفح.'
              : 'For silent XPrinter printing, run npm run print-bridge, choose Network Bridge, and use http://127.0.0.1:17878/print. Bluetooth and USB use the browser device picker.'}
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">{isArabic ? 'كشف الطابعات والتشخيص' : 'Printer Discovery and Diagnostics'}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {isArabic ? 'يعرض USB/Bluetooth المصرح بها وطابعات Windows من Network Bridge إن كان يعمل.' : 'Shows authorized USB/Bluetooth devices and Windows printers exposed by Network Bridge.'}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" disabled={isDiscoveringPrinters} onClick={discoverPrinters}>
                {isDiscoveringPrinters ? (isArabic ? 'جاري الفحص...' : 'Scanning...') : (isArabic ? 'فحص الأجهزة' : 'Scan Devices')}
              </Button>
            </div>
            {printerDiscoveryStatus && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{printerDiscoveryStatus}</p>}
            {discoveredPrinters.length > 0 && <DiscoveredPrinters devices={discoveredPrinters} isArabic={isArabic} />}
          </div>
          <div className="space-y-4">
            <PrinterCard
              role="cashier"
              title={isArabic ? 'طابعة الكاشير' : 'Cashier Printer'}
              description={isArabic ? 'الفاتورة الرئيسية وبها QR.' : 'Main invoice with QR.'}
              printer={settings.printers.cashier}
              diagnostic={printerDiagnostics.cashier}
              isArabic={isArabic}
              statusMessage={printerStatus.cashier}
              onChange={updatePrinter}
              onReset={resetPrinter}
              onConnect={connectPrinter}
              onTest={testPrinter}
            />
            <PrinterCard
              role="kitchen"
              title={isArabic ? 'طابعة المطبخ' : 'Kitchen Printer'}
              description={isArabic ? 'ورقة صغيرة بدون QR.' : 'Small ticket without QR.'}
              printer={settings.printers.kitchen}
              diagnostic={printerDiagnostics.kitchen}
              isArabic={isArabic}
              statusMessage={printerStatus.kitchen}
              onChange={updatePrinter}
              onReset={resetPrinter}
              onConnect={connectPrinter}
              onTest={testPrinter}
            />
            <PrinterCard
              role="hall"
              title={isArabic ? 'طابعة الصالة' : 'Hall Printer'}
              description={isArabic ? 'ورقة صغيرة بدون QR.' : 'Small ticket without QR.'}
              printer={settings.printers.hall}
              diagnostic={printerDiagnostics.hall}
              isArabic={isArabic}
              statusMessage={printerStatus.hall}
              onChange={updatePrinter}
              onReset={resetPrinter}
              onConnect={connectPrinter}
              onTest={testPrinter}
            />
          </div>
        </CardContent>
      </Card>}
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
  diagnostic,
  isArabic,
  statusMessage,
  onChange,
  onReset,
  onConnect,
  onTest,
}: {
  role: PrinterRole
  title: string
  description: string
  printer: PrinterConnection
  diagnostic: PrinterRuntimeDiagnostic
  isArabic: boolean
  statusMessage?: string
  onChange: (role: PrinterRole, updates: Partial<PrinterConnection>) => void
  onReset: (role: PrinterRole) => void
  onConnect: (role: PrinterRole, method?: PrinterMethod) => void
  onTest: (role: PrinterRole, kind?: 'connection' | 'arabic' | 'qr' | 'kitchen' | 'hall', method?: PrinterMethod) => void
}) {
  const method = printer.method || 'network'
  const enabled = printer.isEnabled === true
  const networkReady = Boolean((printer.ip || printer.deviceAddress || '').trim())
  const savedDeviceName = (printer.deviceName || '').trim()
  const genericDeviceNames = new Set(['Cashier Printer', 'Kitchen Printer', 'Hall Printer', printer.name || ''])
  const methodConnected = printer.lastConnectedMethod === method
  const deviceConnected = Boolean(methodConnected && printer.lastConnected && (printer.deviceId || (savedDeviceName && !genericDeviceNames.has(savedDeviceName))))
  const ready = enabled && (method === 'network' ? networkReady : method === 'system' ? true : deviceConnected)
  const status = !enabled
    ? { label: isArabic ? 'غير مفعلة' : 'Disabled', className: 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300', icon: AlertCircle }
    : ready
      ? { label: method === 'network' ? (isArabic ? 'جاهزة للطباعة' : 'Ready') : (isArabic ? 'جاهزة لاختيار الجهاز' : 'Ready to pair'), className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200', icon: CheckCircle2 }
      : { label: isArabic ? 'تحتاج عنوان الشبكة' : 'Needs bridge URL', className: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-200', icon: AlertCircle }
  const displayStatus = !enabled
    ? { label: isArabic ? 'غير مفعلة' : 'Disabled', className: 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300', icon: AlertCircle }
    : ready
      ? { label: method === 'network' ? (isArabic ? 'جاهزة للطباعة' : 'Ready') : (isArabic ? 'مربوطة' : 'Connected'), className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200', icon: CheckCircle2 }
      : { label: method === 'network' ? (isArabic ? 'تحتاج عنوان الشبكة' : 'Needs bridge URL') : (isArabic ? 'تحتاج ربط' : 'Needs pairing'), className: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-200', icon: AlertCircle }
  void status
  const StatusIcon = displayStatus.icon
  const connectionOptions = [
    { value: 'bluetooth' as const, label: 'Bluetooth', hint: isArabic ? 'اختيار مباشر من المتصفح' : 'Browser device picker', icon: Bluetooth },
    { value: 'usb' as const, label: 'USB / OTG', hint: isArabic ? 'كابل أو محول OTG' : 'Cable or OTG adapter', icon: Usb },
    { value: 'system' as const, label: 'Windows / XPrinter', hint: 'Installed Windows printer', icon: PrinterCheck },
    { value: 'network' as const, label: isArabic ? 'Network Bridge' : 'Network Bridge', hint: isArabic ? 'خدمة http://IP:PORT/print' : 'http://IP:PORT/print service', icon: Wifi },
  ]
  const fontLabels: Record<string, string> = {
    '0.9': isArabic ? 'صغير' : 'Small',
    '1': isArabic ? 'عادي' : 'Normal',
    '1.15': isArabic ? 'كبير' : 'Large',
    '1.3': isArabic ? 'كبير جدا' : 'Extra large',
  }

  return (
    <div className={`rounded-md border p-5 transition ${enabled ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950' : 'border-dashed border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/60'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold">{title}</h3>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${displayStatus.className}`}>
              <StatusIcon className="h-3.5 w-3.5" />
              {displayStatus.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
          <p className="mt-1 text-xs font-medium text-slate-400">{role}_printer</p>
        </div>
        <label className="inline-flex select-none items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium dark:border-slate-800 dark:bg-slate-950">
          <input type="checkbox" checked={enabled} onChange={(event) => onChange(role, { isEnabled: event.target.checked })} />
          {isArabic ? 'تفعيل' : 'Enable'}
        </label>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {connectionOptions.map((option) => {
          const Icon = option.icon
          const active = method === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(role, { method: option.value, connectionType: option.value, isEnabled: true, lastConnected: method === option.value ? printer.lastConnected : '', lastConnectedMethod: method === option.value ? printer.lastConnectedMethod : '' })}
              className={`min-h-20 rounded-md border p-3 text-start transition ${active ? 'border-blue-500 bg-blue-50 text-blue-950 ring-1 ring-blue-500 dark:bg-blue-950/40 dark:text-blue-100' : 'border-slate-200 bg-white hover:border-blue-200 dark:border-slate-800 dark:bg-slate-950'}`}
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                <Icon className="h-4 w-4 text-blue-600" />
                {option.label}
              </span>
              <span className="mt-2 block text-xs text-slate-500">{option.hint}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Field id={`printer-${role}-name`} label={isArabic ? 'اسم الطابعة' : 'Printer name'} value={printer.deviceName || printer.name || ''} onChange={(value) => onChange(role, { name: value, deviceName: value })} />
        <div>
          <Label htmlFor={`printer-${role}-paper`}>{isArabic ? 'عرض الورق' : 'Paper width'}</Label>
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
        <div>
          <Label htmlFor={`printer-${role}-font`}>{isArabic ? 'مقاس الكلام' : 'Text size'}</Label>
          <select
            id={`printer-${role}-font`}
            value={String(printer.fontScale || 1)}
            onChange={(event) => onChange(role, { fontScale: Number(event.target.value) })}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
          >
            {Object.entries(fontLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>

      {method === 'network' ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Field id={`printer-${role}-ip`} label={isArabic ? 'رابط Network Bridge أو IP' : 'Network Bridge URL or IP'} value={printer.ip || printer.deviceAddress || ''} onChange={(value) => onChange(role, { ip: value, deviceAddress: value })} />
          <Field id={`printer-${role}-port`} label={isArabic ? 'Port' : 'Port'} value={printer.port || '9100'} onChange={(value) => onChange(role, { port: value })} />
        </div>
      ) : method === 'system' ? (
        <div className="mt-4 rounded-md bg-blue-50 p-3 text-xs leading-6 text-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
          {'Use this when the printer appears in XPrinter or Windows printers. Testing opens the print dialog; choose XPrinter there.'}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Field id={`printer-${role}-device-id`} label={isArabic ? 'Device ID / Address اختياري' : 'Optional Device ID / Address'} value={printer.deviceId || printer.deviceAddress || ''} onChange={(value) => onChange(role, { deviceId: value, deviceAddress: value })} />
          <Field id={`printer-${role}-retry`} label={isArabic ? 'عدد المحاولات' : 'Retry attempts'} value={String(printer.retryAttempts || 3)} type="number" onChange={(value) => onChange(role, { retryAttempts: Number(value) })} />
        </div>
      )}

      {method === 'network' && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Field id={`printer-${role}-retry`} label={isArabic ? 'عدد المحاولات' : 'Retry attempts'} value={String(printer.retryAttempts || 3)} type="number" onChange={(value) => onChange(role, { retryAttempts: Number(value) })} />
          <div className="rounded-md bg-slate-50 p-3 text-xs leading-6 text-slate-500 dark:bg-slate-900">
            {isArabic ? 'لـ XPrinter المحلي استخدم http://127.0.0.1:17878/print بعد تشغيل npm run print-bridge. لو كتبت IP فقط سيتم استخدام /print تلقائيا.' : 'For local XPrinter, use http://127.0.0.1:17878/print after running npm run print-bridge. If you enter only an IP, /print is added automatically.'}
          </div>
        </div>
      )}

      {printer.lastConnected && <p className="mt-3 text-xs text-slate-500">{isArabic ? 'آخر اتصال' : 'Last connected'}: {new Date(printer.lastConnected).toLocaleString(isArabic ? 'ar-EG' : 'en-US')}</p>}
      <PrinterDiagnosticPanel diagnostic={diagnostic} isArabic={isArabic} />

      <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        {(method === 'bluetooth' || method === 'usb') && (
          <Button type="button" size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => onConnect(role, method)}>
            {method === 'bluetooth' ? <Bluetooth className="h-4 w-4" /> : <Usb className="h-4 w-4" />}
            {deviceConnected ? (isArabic ? 'إعادة ربط الطابعة' : 'Reconnect Printer') : (isArabic ? 'ربط الطابعة' : 'Connect Printer')}
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => onTest(role, 'connection', method)}>
          <PrinterCheck className="h-4 w-4" />
          {isArabic ? 'اختبار اتصال' : 'Connection'}
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => onTest(role, 'arabic', method)}>
          <ClipboardCheck className="h-4 w-4" />
          {isArabic ? 'اختبار عربي' : 'Arabic'}
        </Button>
        {role === 'cashier' && <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => onTest(role, 'qr', method)}>
          <QrCode className="h-4 w-4" />
          QR
        </Button>}
        {role === 'kitchen' && <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => onTest(role, 'kitchen', method)}>
          <Utensils className="h-4 w-4" />
          Kitchen
        </Button>}
        {role === 'hall' && <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => onTest(role, 'hall', method)}>
          <ReceiptText className="h-4 w-4" />
          Hall
        </Button>}
        <Button type="button" variant="outline" size="sm" onClick={() => onReset(role)}>
          {isArabic ? 'مسح بيانات الطابعة' : 'Reset Printer'}
        </Button>
      </div>
      {statusMessage && (
        <p className="mt-3 rounded-md bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {statusMessage}
        </p>
      )}
    </div>
  )
}

function DiscoveredPrinters({ devices, isArabic }: { devices: AvailablePrinterDevice[]; isArabic: boolean }) {
  return (
    <div className="mt-3 grid gap-2 md:grid-cols-2">
      {devices.map((device) => (
        <div key={`${device.method}-${device.id}`} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-slate-900 dark:text-slate-100">{device.name}</span>
            <span className={`rounded-full px-2 py-0.5 font-semibold ${device.paired ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200'}`}>
              {device.paired ? (isArabic ? 'متاح' : 'Available') : (isArabic ? 'غير جاهز' : 'Not ready')}
            </span>
          </div>
          <div className="mt-2 grid gap-1 text-slate-500">
            <span>{isArabic ? 'الطريقة' : 'Method'}: {device.method}</span>
            {device.address && <span>{isArabic ? 'العنوان' : 'Address'}: {device.address}</span>}
            {device.detail && <span>{device.detail}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

function PrinterDiagnosticPanel({ diagnostic, isArabic }: { diagnostic: PrinterRuntimeDiagnostic; isArabic: boolean }) {
  const statusLabels: Record<PrinterRuntimeDiagnostic['status'], string> = {
    disabled: isArabic ? 'غير مفعلة' : 'Disabled',
    not_configured: isArabic ? 'إعداد غير مكتمل' : 'Not configured',
    ready: isArabic ? 'جاهزة' : 'Ready',
    needs_reconnect: isArabic ? 'تحتاج إعادة ربط' : 'Needs reconnect',
    unknown: isArabic ? 'غير معروف' : 'Unknown',
  }
  const recentEvents = diagnostic.recentEvents.slice(0, 4)

  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-2 md:grid-cols-3">
        <DiagnosticItem label={isArabic ? 'نوع الاتصال' : 'Connection'} value={diagnostic.method || '-'} />
        <DiagnosticItem label={isArabic ? 'الحالة' : 'Status'} value={statusLabels[diagnostic.status]} />
        <DiagnosticItem label={isArabic ? 'المحاولات الفاشلة' : 'Failed attempts'} value={String(diagnostic.failedAttempts || 0)} />
        <DiagnosticItem label={isArabic ? 'IP / URL' : 'IP / URL'} value={diagnostic.endpoint || diagnostic.ip || '-'} />
        <DiagnosticItem label={isArabic ? 'المنفذ' : 'Port'} value={diagnostic.port || '-'} />
        <DiagnosticItem label={isArabic ? 'الجهاز' : 'Device'} value={diagnostic.deviceName || diagnostic.deviceId || diagnostic.deviceAddress || '-'} />
        <DiagnosticItem label={isArabic ? 'آخر اتصال' : 'Last connected'} value={formatMaybeDate(diagnostic.lastConnected, isArabic)} />
        <DiagnosticItem label={isArabic ? 'آخر طباعة' : 'Last print'} value={formatMaybeDate(diagnostic.lastPrinted, isArabic)} />
        <DiagnosticItem label={isArabic ? 'آخر خطأ' : 'Last error'} value={diagnostic.lastError || '-'} />
      </div>
      {recentEvents.length > 0 && (
        <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
          <p className="font-bold text-slate-700 dark:text-slate-200">{isArabic ? 'آخر سجل تشخيص' : 'Recent debug log'}</p>
          <div className="mt-2 space-y-2">
            {recentEvents.map((event) => (
              <div key={event.id} className="rounded-md bg-white p-2 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                <div className="flex flex-wrap gap-2 font-semibold">
                  <span>{formatMaybeDate(event.at, isArabic)}</span>
                  <span>{event.action}</span>
                  <span className={event.status === 'failed' ? 'text-red-600' : event.status === 'ok' ? 'text-emerald-600' : 'text-slate-500'}>{event.status}</span>
                  {event.attempt && <span>{isArabic ? 'محاولة' : 'Attempt'} {event.attempt}</span>}
                </div>
                {(event.message || event.error) && <p className="mt-1 break-words">{event.message || event.error}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DiagnosticItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="font-semibold text-slate-500">{label}</p>
      <p className="mt-1 break-words text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  )
}

function formatMaybeDate(value: string | undefined, isArabic: boolean) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(isArabic ? 'ar-EG' : 'en-US')
}

function Field({ id, label, value, onChange, type = 'text' }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}
