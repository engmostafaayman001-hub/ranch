'use client'

import type { MenuCategory, MenuProduct, AppSettings } from '@/lib/app-store'

const OFFLINE_DATA_KEY = 'ranch-offline-data-v1'
const OFFLINE_STATUS_KEY = 'ranch-offline-status-v1'
const LAST_SYNC_KEY = 'ranch-last-sync-v1'

export type OfflineData = {
  categories: MenuCategory[]
  products: MenuProduct[]
  settings: AppSettings
  lastUpdated: string
}

export type OfflineStatus = {
  isOnline: boolean
  lastChecked: string
  failedAttempts: number
}

/**
 * قراءة البيانات المحلية
 */
export function readOfflineData(): OfflineData | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(OFFLINE_DATA_KEY)
    return raw ? JSON.parse(raw) as OfflineData : null
  } catch {
    return null
  }
}

/**
 * حفظ البيانات المحلية
 */
export function writeOfflineData(data: OfflineData) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(OFFLINE_DATA_KEY, JSON.stringify({
    ...data,
    lastUpdated: new Date().toISOString(),
  }))
}

/**
 * تحديث البيانات المحلية جزئيًا
 */
export function updateOfflineData(partial: Partial<OfflineData>) {
  const current = readOfflineData()
  if (!current) return

  const next: OfflineData = {
    categories: partial.categories ?? current.categories,
    products: partial.products ?? current.products,
    settings: partial.settings ?? current.settings,
    lastUpdated: new Date().toISOString(),
  }

  writeOfflineData(next)
}

/**
 * قراءة حالة الاتصال
 */
export function readOfflineStatus(): OfflineStatus {
  if (typeof window === 'undefined') {
    return { isOnline: true, lastChecked: new Date().toISOString(), failedAttempts: 0 }
  }

  try {
    const raw = window.localStorage.getItem(OFFLINE_STATUS_KEY)
    return raw ? JSON.parse(raw) as OfflineStatus : {
      isOnline: window.navigator.onLine,
      lastChecked: new Date().toISOString(),
      failedAttempts: 0,
    }
  } catch {
    return { isOnline: window.navigator.onLine, lastChecked: new Date().toISOString(), failedAttempts: 0 }
  }
}

/**
 * تحديث حالة الاتصال
 */
export function writeOfflineStatus(status: OfflineStatus) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(OFFLINE_STATUS_KEY, JSON.stringify({
    ...status,
    lastChecked: new Date().toISOString(),
  }))
}

/**
 * حفظ آخر وقت مزامنة
 */
export function writeLastSyncTime(timestamp: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LAST_SYNC_KEY, timestamp)
}

/**
 * قراءة آخر وقت مزامنة
 */
export function readLastSyncTime(): string | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage.getItem(LAST_SYNC_KEY)
  } catch {
    return null
  }
}

/**
 * التحقق من حالة الاتصال الفعلية
 */
export async function checkOnlineStatus(): Promise<boolean> {
  if (typeof window === 'undefined') return true

  try {
    const response = await fetch('/api/health', { method: 'HEAD', cache: 'no-store' })
    return response.ok
  } catch {
    return false
  }
}

/**
 * مراقبة تغييرات حالة الاتصال
 */
export function onOnlineStatusChange(callback: (isOnline: boolean) => void) {
  if (typeof window === 'undefined') return () => {}

  const handleOnline = () => {
    callback(true)
    writeOfflineStatus({ isOnline: true, lastChecked: new Date().toISOString(), failedAttempts: 0 })
  }

  const handleOffline = () => {
    callback(false)
    writeOfflineStatus({ isOnline: false, lastChecked: new Date().toISOString(), failedAttempts: 0 })
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}

/**
 * مسح جميع البيانات المحلية
 */
export function clearOfflineData() {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(OFFLINE_DATA_KEY)
    window.localStorage.removeItem(OFFLINE_STATUS_KEY)
    window.localStorage.removeItem(LAST_SYNC_KEY)
  } catch {
    // ignore
  }
}
