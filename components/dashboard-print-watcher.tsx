'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN } from '@/lib/constants'
import { useAppStore } from '@/lib/app-store'
import { printerManager, syncPrinterManagerSettings, trackedOrderToReceiptPayload } from '@/lib/printer'
import { TrackedOrder } from '@/lib/order-tracking'

const AUTO_PRINTED_APP_ORDERS_KEY = 'baseeta-auto-printed-app-orders-v1'
const MAX_AUTO_PRINTED_IDS = 250

function readAutoPrintedIds() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(AUTO_PRINTED_APP_ORDERS_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function saveAutoPrintedIds(ids: string[]) {
  window.localStorage.setItem(AUTO_PRINTED_APP_ORDERS_KEY, JSON.stringify(ids.slice(-MAX_AUTO_PRINTED_IDS)))
}

export function DashboardPrintWatcher() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const settings = useAppStore((state) => state.settings)
  const [dashboardRole, setDashboardRole] = useState<string | null>(null)
  const bootstrapped = useRef(false)
  const printingIds = useRef(new Set<string>())
  const watcherStartedAt = useRef<number | null>(null)
  const checkingOrders = useRef(false)

  const createPrintPayload = useCallback((order: TrackedOrder) => trackedOrderToReceiptPayload(order, {
    isArabic,
    currency,
    invoiceName: isArabic ? settings.invoiceNameAr : settings.invoiceNameEn,
    invoiceQrUrl: settings.invoiceQrUrl,
    invoiceMessage: isArabic ? settings.invoiceWelcomeAr : settings.invoiceWelcomeEn,
    logoUrl: settings.invoiceLogo || settings.heroImage,
  }), [currency, isArabic, settings.heroImage, settings.invoiceLogo, settings.invoiceNameAr, settings.invoiceNameEn, settings.invoiceQrUrl, settings.invoiceWelcomeAr, settings.invoiceWelcomeEn])

  useEffect(() => {
    let active = true
    fetch('/api/auth/dashboard-access', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (active) setDashboardRole(typeof data.role === 'string' ? data.role : null)
      })
      .catch(() => {
        if (active) setDashboardRole(null)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (dashboardRole === 'delivery') return
    let active = true

    const checkOrders = async () => {
      if (checkingOrders.current) return
      checkingOrders.current = true
      try {
        if (!watcherStartedAt.current) watcherStartedAt.current = Date.now()
        const response = await fetch('/api/pos/orders', { cache: 'no-store' })
        const data = await response.json().catch(() => ({}))
        if (!active) return

        const appOrders = (Array.isArray(data.orders) ? data.orders : [])
          .filter((order: TrackedOrder) => order.source !== 'restaurant_pos') as TrackedOrder[]
        const printedIds = readAutoPrintedIds()
        const printed = new Set(printedIds)

        const firstRun = !bootstrapped.current
        const shouldPrintOrder = (order: TrackedOrder) => {
          const createdAt = new Date(order.createdAt).getTime()
          if (Number.isNaN(createdAt)) return !firstRun
          return !firstRun || createdAt >= (watcherStartedAt.current || Date.now()) - 5000
        }

        if (firstRun) {
          const oldOrderIds = appOrders
            .filter((order) => !shouldPrintOrder(order))
            .map((order) => order.id)
          if (oldOrderIds.length) saveAutoPrintedIds(Array.from(new Set([...printedIds, ...oldOrderIds])))
          bootstrapped.current = true
        }

        const newOrders = appOrders
          .filter((order) => shouldPrintOrder(order) && !printed.has(order.id) && !printingIds.current.has(order.id))
          .sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime())

        if (newOrders.length === 0) return

        syncPrinterManagerSettings(settings.printers)
        for (const order of newOrders) {
          printingIds.current.add(order.id)
          const payload = createPrintPayload(order)
          Promise.allSettled([
            printerManager.printCashierReceipt(payload),
            printerManager.printKitchenTicket(payload),
          ])
            .then((results) => {
              const printedSuccessfully = results.some((result) => {
                if (result.status === 'rejected') return false
                const value = result.value as { skipped?: boolean } | undefined
                return value?.skipped !== true
              })
              if (printedSuccessfully) {
                const latest = readAutoPrintedIds()
                saveAutoPrintedIds(Array.from(new Set([...latest, order.id])))
                console.info(`[DashboardPrintWatcher] App order ${order.id} printed by restaurant printers.`)
              } else {
                console.warn(`[DashboardPrintWatcher] App order ${order.id} was not marked printed because all print jobs were skipped or failed.`)
              }
            })
            .catch((error) => {
              console.error('[DashboardPrintWatcher] Automatic app order print failed:', error)
            })
            .finally(() => {
              printingIds.current.delete(order.id)
            })
        }
      } catch (error) {
        console.error('[DashboardPrintWatcher] Could not check app orders:', error)
      } finally {
        checkingOrders.current = false
      }
    }

    checkOrders()
    const interval = window.setInterval(checkOrders, 8000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [createPrintPayload, dashboardRole, settings.printers])

  return null
}
