'use client'

import { useEffect } from 'react'
import { AppSettings, MenuCategory, MenuProduct, useAppStore } from '@/lib/app-store'

type SharedAppData = {
  categories?: MenuCategory[]
  products?: MenuProduct[]
  settings?: AppSettings
}

export function useSharedAppData() {
  const setCatalog = useAppStore((state) => state.setCatalog)
  const setSettings = useAppStore((state) => state.setSettings)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const response = await fetch('/api/app-data', { cache: 'no-store' })
        const data = (await response.json().catch(() => ({}))) as SharedAppData
        if (!active || !response.ok) return

        if (Array.isArray(data.categories) && Array.isArray(data.products)) {
          setCatalog({ categories: data.categories, products: data.products })
        }
        if (data.settings) setSettings(data.settings)
      } catch {
        // Keep local persisted data if the shared source is unavailable.
      }
    }

    const timer = window.setTimeout(load, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [setCatalog, setSettings])
}

export async function saveSharedCatalog(categories: MenuCategory[], products: MenuProduct[]) {
  const response = await fetch('/api/app-data', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'catalog', categories, products }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || data.error || 'Could not save products')
  return data as { categories: MenuCategory[]; products: MenuProduct[] }
}

export async function saveSharedSettings(settings: AppSettings) {
  const response = await fetch('/api/app-data', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'settings', settings }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || data.error || 'Could not save settings')
  return data as { settings: AppSettings }
}
