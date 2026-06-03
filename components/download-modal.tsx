'use client'

import { useEffect, useState } from 'react'
import { Bell, Download, HardDrive, MousePointerClick, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/components/language-provider'
import { Logo } from '@/components/logo'

interface DownloadModalProps {
  isOpen: boolean
  onClose: () => void
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function DownloadModal({ isOpen, onClose }: DownloadModalProps) {
  const { language, appName, t } = useLanguage()
  const [downloading, setDownloading] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [canInstall, setCanInstall] = useState(false)
  const [installMessage, setInstallMessage] = useState<string | null>(null)
  const isArabic = language === 'ar'

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      const installEvent = event as BeforeInstallPromptEvent
      setDeferredPrompt(installEvent)
      setCanInstall(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    setInstallMessage(null)
    setDownloading(true)

    if (!deferredPrompt) {
      setDownloading(false)
      setInstallMessage(
        isArabic
          ? 'إذا لم تظهر نافذة التثبيت، افتح قائمة المتصفح ثم اختر تثبيت التطبيق أو Add to Home Screen.'
          : 'If the install prompt does not appear, open the browser menu and choose Install App or Add to Home Screen.'
      )
      return
    }

    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setDeferredPrompt(null)
      setCanInstall(false)
      setTimeout(() => {
        setDownloading(false)
        onClose()
      }, 1500)
    } else {
      setDownloading(false)
    }
  }

  if (!isOpen) return null

  const benefits = [
    { icon: MousePointerClick, text: t('instantAccess') },
    { icon: WifiOff, text: t('offlineSupport') },
    { icon: Bell, text: t('notifications') },
    { icon: HardDrive, text: t('smallSize') },
  ]

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2">
        <div className="space-y-6 rounded-lg bg-white p-6 shadow-xl dark:bg-slate-900">
          <div className="space-y-2 text-center">
            <div className="mx-auto flex justify-center">
              <Logo size="xl" />
            </div>
            <h2 className="text-2xl font-bold">
              {isArabic ? `ثبت تطبيق ${appName}` : `Install ${appName} App`}
            </h2>
            <p className="text-slate-600 dark:text-slate-400">{t('getBestExperience')}</p>
          </div>

          <div className="space-y-3">
            {benefits.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.text} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-red-50 text-red-600 dark:bg-red-950">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>{item.text}</span>
                </div>
              )
            })}
          </div>

          <div className="space-y-3">
            <Button onClick={handleInstall} disabled={downloading} className="w-full gap-2 bg-red-600 text-white hover:bg-red-700">
              <Download className="h-4 w-4" aria-hidden="true" />
              {downloading ? t('installing') : canInstall ? t('installNow') : t('downloadApp')}
            </Button>
            {installMessage && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
                {installMessage}
              </p>
            )}
          </div>

          <Button onClick={onClose} variant="outline" className="w-full">
            {t('notNow')}
          </Button>
        </div>
      </div>
    </>
  )
}
