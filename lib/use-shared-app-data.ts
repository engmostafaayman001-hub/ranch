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

export function useSharedAppData(options: { poll?: boolean } = {}) {
  const setCatalog = useAppStore((state) => state.setCatalog)
  const setSettings = useAppStore((state) => state.setSettings)
  const setDrivers = useAppStore((state) => state.setDrivers)
  const poll = options.poll ?? true
  const [loading, setLoading] = useState(true)
  const loadingRef = useRef(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      if (loadingRef.current) return
      loadingRef.current = true
      try {
        const response = await fetchWithRetry('/api/app-data', { cache: 'no-store' }, { retries: 3 })
        const data = (await response.json().catch(() => ({}))) as SharedAppData
        if (!active || !response.ok) return

        if (Array.isArray(data.categories) && Array.isArray(data.products)) {
          setCatalog({ categories: data.categories, products: data.products })
        }
        if (data.settings) setSettings(data.settings)
        if (Array.isArray(data.drivers)) {
          setDrivers(data.drivers)
        }
      } catch {
        // Keep local persisted data if the shared source is unavailable.
      } finally {
        loadingRef.current = false
        if (active) setLoading(false)
      }
    }

    const timer = window.setTimeout(load, 0)
    const interval = poll ? window.setInterval(load, 10000) : undefined
    return () => {
      active = false
      window.clearTimeout(timer)
      if (interval) window.clearInterval(interval)
    }
  }, [poll, setCatalog, setDrivers, setSettings])

  return { loading }
}

export async function saveSharedCatalog(categories: MenuCategory[], products: MenuProduct[]) {
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
  const response = await fetchWithRetry('/api/app-data', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'settings', settings }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || data.error || 'Could not save settings')
  return data as { settings: AppSettings }
}

export async function saveSharedDrivers(drivers: DeliveryDriver[]) {
  const response = await fetchWithRetry('/api/drivers', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drivers }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || data.error || 'Could not save drivers')
  return data as { drivers: DeliveryDriver[] }
}

export async function fetchSharedDrivers() {
  const response = await fetchWithRetry('/api/drivers', { cache: 'no-store' }, { retries: 3 })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !Array.isArray(data.drivers)) {
    throw new Error(data.message || data.error || 'Could not load drivers')
  }
  return data.drivers as DeliveryDriver[]
}
