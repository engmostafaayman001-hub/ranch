'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/components/language-provider'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true
}

export function FloatingInstallButton() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (isStandaloneMode() || localStorage.getItem('ranch-app-installed') === 'true') {
      return
    }

    const timer = window.setTimeout(() => setVisible(true), 0)
    const beforeInstall = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
      setVisible(true)
    }
    const installed = () => {
      localStorage.setItem('ranch-app-installed', 'true')
      setVisible(false)
    }

    window.addEventListener('beforeinstallprompt', beforeInstall)
    window.addEventListener('appinstalled', installed)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('beforeinstallprompt', beforeInstall)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])

  const install = async () => {
    setMessage('')
    if (isStandaloneMode()) {
      localStorage.setItem('ranch-app-installed', 'true')
      setVisible(false)
      return
    }

    if (!deferredPrompt) {
      setMessage(isArabic ? 'من قائمة المتصفح اختر تثبيت التطبيق أو إضافة للشاشة الرئيسية.' : 'Use the browser menu to install the app or add it to the home screen.')
      return
    }

    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      localStorage.setItem('ranch-app-installed', 'true')
      setVisible(false)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-5 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2 ltr:right-5 rtl:left-5">
      {message && <p className="max-w-xs rounded-md bg-slate-950 px-3 py-2 text-xs text-white shadow-lg">{message}</p>}
      <Button onClick={install} className="h-12 gap-2 rounded-full bg-red-600 px-5 shadow-xl hover:bg-red-700">
        <Download className="h-4 w-4" />
        {isArabic ? 'تنزيل التطبيق' : 'Install App'}
      </Button>
    </div>
  )
}
