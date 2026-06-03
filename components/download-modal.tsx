'use client'

import { useState, useEffect } from 'react'
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
    const handler = (e: Event) => {
      e.preventDefault()
      const evt = e as BeforeInstallPromptEvent
      setDeferredPrompt(evt)
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

    deferredPrompt.prompt()
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

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl p-6 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="mx-auto flex justify-center">
              <Logo size="xl" />
            </div>
            <h2 className="text-2xl font-bold">
              {isArabic ? `ثبّت تطبيق ${appName}` : `Install ${appName} App`}
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              {t('getBestExperience')}
            </p>
          </div>

          {/* Benefits */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚡</span>
              <span>{t('instantAccess')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📱</span>
              <span>{t('offlineSupport')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🔔</span>
              <span>{t('notifications')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">💾</span>
              <span>{t('smallSize')}</span>
            </div>
          </div>

          {/* Install Button */}
          <div className="space-y-3">
            <Button
              onClick={handleInstall}
              disabled={downloading}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              {downloading ? t('installing') : `⬇️ ${canInstall ? t('installNow') : t('downloadApp')}`}
            </Button>
            {installMessage && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
                {installMessage}
              </p>
            )}
          </div>

          {/* Close Button */}
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full"
          >
            {t('notNow')}
          </Button>
        </div>
      </div>
    </>
  )
}
