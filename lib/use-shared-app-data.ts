'use client'

import { useEffect, useRef, useState } from 'react'
import { AppSettings, DeliveryDriver, MenuCategory, MenuProduct, useAppStore } from '@/lib/app-store'
import { fetchWithRetry } from '@/lib/fetch-with-retry'

type SharedAppData = {
  categories?: MenuCategory[]
  products?: MenuProduct[]
  drivers?: DeliveryDriver[]
  settings?: AppSettings
}

const SHARED_APP_DATA_CACHE_MS = 60000
let sharedAppDataCache: { data: SharedAppData; at: number } | null = null
let sharedAppDataPromise: Promise<SharedAppData> | null = null

async function fetchSharedAppData() {
  if (sharedAppDataCache && Date.now() - sharedAppDataCache.at < SHARED_APP_DATA_CACHE_MS) {
    return sharedAppDataCache.data
  }
  if (sharedAppDataPromise) return sharedAppDataPromise

  sharedAppDataPromise = fetchWithRetry('/api/app-data', { cache: 'no-store' }, { retries: 1 })
    .then(async (response) => {
      const data = (await response.json().catch(() => ({}))) as SharedAppData
      if (!response.ok) throw new Error('Could not load shared app data')
      sharedAppDataCache = { data, at: Date.now() }
      return data
    })
    .finally(() => {
      sharedAppDataPromise = null
    })

  return sharedAppDataPromise
}

function invalidateSharedAppDataCache() {
  sharedAppDataCache = null
  sharedAppDataPromise = null
}

function normalizeDriverValue(value?: string) {
  return typeof value === 'string' ? value.trim() : ''
}

function ensureDriver(driver: Partial<DeliveryDriver> & { id?: string }): DeliveryDriver {
  const name = normalizeDriverValue(driver.name) || normalizeDriverValue(driver.email?.split('@')[0]) || 'Driver'
  const email = normalizeDriverValue(driver.email)
  const phone = normalizeDriverValue(driver.phone)
  const area = normalizeDriverValue(driver.area)
  const status = driver.status === 'inactive' ? 'inactive' : 'active'
  return {
    id: driver.id || `driver-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    email,
    phone,
    area,
    status,
  }
}

export function mergeDrivers(existingDrivers: DeliveryDriver[], incomingDrivers: Array<Partial<DeliveryDriver>> = []): DeliveryDriver[] {
  const normalizedExisting = existingDrivers.map((driver) => ensureDriver(driver))
  const map = new Map<string, DeliveryDriver>()

  const addDriver = (driver: DeliveryDriver) => {
    const key = driver.id || `${driver.email || ''}:${driver.phone || ''}:${driver.name || ''}`
    const existing = map.get(key)
    if (existing) {
      map.set(key, {
        ...existing,
        ...driver,
        name: normalizeDriverValue(driver.name) || existing.name || 'Driver',
        email: normalizeDriverValue(driver.email) || existing.email || '',
        phone: normalizeDriverValue(driver.phone) || existing.phone || '',
        area: normalizeDriverValue(driver.area) || existing.area || '',
        status: driver.status === 'inactive' ? 'inactive' : (existing.status === 'inactive' ? 'inactive' : 'active'),
      })
      return
    }
    map.set(key, driver)
  }

  for (const driver of normalizedExisting) addDriver(driver)
  for (const driver of incomingDrivers.map((item) => ensureDriver(item))) addDriver(driver)

  const merged = Array.from(map.values())
  return merged.map((driver, index) => ({ ...driver, id: driver.id || `driver-${index + 1}` }))
}

export function useSharedAppData(options: { poll?: boolean } = {}) {
  const setCatalog = useAppStore((state) => state.setCatalog)
  const setSettings = useAppStore((state) => state.setSettings)
  const setDrivers = useAppStore((state) => state.setDrivers)
  const currentDrivers = useAppStore((state) => state.drivers)
  const poll = options.poll ?? true
  const [loading, setLoading] = useState(true)
  const loadingRef = useRef(false)
  const currentDriversRef = useRef(currentDrivers)

  useEffect(() => {
    currentDriversRef.current = currentDrivers
  }, [currentDrivers])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (loadingRef.current) return
      loadingRef.current = true
      try {
        const data = await fetchSharedAppData()
        if (!active) return

        if (Array.isArray(data.categories) && Array.isArray(data.products)) {
          setCatalog({ categories: data.categories, products: data.products })
        }
        if (data.settings) setSettings(data.settings)
        if (Array.isArray(data.drivers)) {
          setDrivers(mergeDrivers(currentDriversRef.current, data.drivers))
        }
      } catch {
        // Keep local persisted data if the shared source is unavailable.
      } finally {
        loadingRef.current = false
        if (active) setLoading(false)
      }
    }

    const timer = window.setTimeout(load, 0)
    const interval = poll ? window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, 300000) : undefined
    return () => {
      active = false
      window.clearTimeout(timer)
      if (interval) window.clearInterval(interval)
    }
  }, [poll, setCatalog, setDrivers, setSettings])

  return { loading }
}

export async function saveSharedCatalog(categories: MenuCategory[], products: MenuProduct[]) {
  invalidateSharedAppDataCache()
  const response = await fetchWithRetry('/api/app-data', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'catalog', categories, products }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || data.error || 'Could not save products')
  return data as { categories: MenuCategory[]; products: MenuProduct[] }
}

export async function saveSharedSettings(settings: AppSettings) {
  invalidateSharedAppDataCache()
  const localPrinters = useAppStore.getState().settings.printers
  const response = await fetchWithRetry('/api/app-data', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'settings', settings: { ...settings, printers: undefined } }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || data.error || 'Could not save settings')
  if (data.settings) data.settings = { ...data.settings, printers: localPrinters }
  return data as { settings: AppSettings }
}

export async function saveSharedDrivers(drivers: DeliveryDriver[]) {
  invalidateSharedAppDataCache()
  const mergedDrivers = mergeDrivers(useAppStore.getState().drivers, drivers)
  const response = await fetchWithRetry('/api/drivers', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drivers: mergedDrivers }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || data.error || 'Could not save drivers')
  const nextDrivers = mergeDrivers(mergedDrivers, Array.isArray(data.drivers) ? data.drivers : [])
  useAppStore.getState().setDrivers(nextDrivers)
  return { drivers: nextDrivers } as { drivers: DeliveryDriver[] }
}

export async function fetchSharedDrivers() {
  const response = await fetchWithRetry('/api/drivers', { cache: 'no-store' }, { retries: 1 })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !Array.isArray(data.drivers)) {
    throw new Error(data.message || data.error || 'Could not load drivers')
  }
  return data.drivers as DeliveryDriver[]
}
