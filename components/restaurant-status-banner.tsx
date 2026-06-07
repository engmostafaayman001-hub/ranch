'use client'

import { Clock, Store } from 'lucide-react'
import { useLanguage } from '@/components/language-provider'
import { useAppStore } from '@/lib/app-store'

export function RestaurantStatusBanner() {
  const { language } = useLanguage()
  const settings = useAppStore((state) => state.settings)
  const isArabic = language === 'ar'
  const isOpen = settings.restaurantOpen !== false

  if (isOpen) return null

  const hours = isArabic ? settings.workingHoursAr : settings.workingHoursEn

  return (
    <div className="border-b border-red-300 bg-red-600 text-white shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 font-bold">
          <Store className="h-4 w-4 shrink-0" />
          <span>{isArabic ? 'المطعم مغلق حاليا' : 'The restaurant is currently closed'}</span>
        </div>
        <div className="flex items-center gap-2 text-white/95">
          <Clock className="h-4 w-4 shrink-0" />
          <span>{isArabic ? `سيبدأ العمل حسب ساعات العمل: ${hours}` : `Ordering resumes during working hours: ${hours}`}</span>
        </div>
      </div>
    </div>
  )
}
