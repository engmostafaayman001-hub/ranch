'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN } from '@/lib/constants'
import { useAppStore } from '@/lib/app-store'
import { fetchDashboardOrderDetails } from '@/lib/dashboard-order-fetch'
import { printerManager, syncPrinterManagerSettings, trackedOrderToReceiptPayload } from '@/lib/printer'
import { TrackedOrder } from '@/lib/order-tracking'

const AUTO_PRINTED_APP_ORDERS_KEY = 'baseeta-auto-printed-app-orders-v2'
const MAX_AUTO_PRINTED_IDS = 250
const AUTO_PRINT_BACKFILL_MS = 15 * 60 * 1000

type AutoPrintedOrderRoles = {
  cashier?: boolean
  kitchen?: boolean
}

type AutoPrintedOrders = Record<string, AutoPrintedOrderRoles>

function readAutoPrintedOrders(): AutoPrintedOrders {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(AUTO_PRINTED_APP_ORDERS_KEY) || '{}')
    if (Array.isArray(parsed)) {
      return Object.fromEntries(parsed.map((id) => [String(id), { cashier: true, kitchen: true }]))
    }
    if (!parsed || typeof parsed !== 'object') return {}
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([id, value]) => {
        const roles = value && typeof value === 'object' ? value as AutoPrintedOrderRoles : {}
        return [id, { cashier: roles.cashier === true, kitchen: roles.kitchen === true }]
      })
    )
  } catch {
    return {}
  }
}

function saveAutoPrintedOrders(orders: AutoPrintedOrders) {
  const entries = Object.entries(orders).slice(-MAX_AUTO_PRINTED_IDS)
  window.localStorage.setItem(AUTO_PRINTED_APP_ORDERS_KEY, JSON.stringify(Object.fromEntries(entries)))
}

function markOrderRolePrinted(orderId: string, role: keyof AutoPrintedOrderRoles) {
  const current = readAutoPrintedOrders()
  saveAutoPrintedOrders({
    ...current,
    [orderId]: {
      ...(current[orderId] || {}),
      [role]: true,
    },
  })
}

function markOrderFullyPrinted(orderId: string) {
  const current = readAutoPrintedOrders()
  saveAutoPrintedOrders({
    ...current,
    [orderId]: { cashier: true, kitchen: true },
  })
}

function isPrinterSelectionBlocked(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  return /requestDevice|user gesture|اختيار الطابعة|cancelled|canceled/i.test(message)
}

export function DashboardPrintWatcher() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const settings = useAppStore((state) => state.settings)
  const [dashboardRole, setDashboardRole] = useState<string | null | undefined>(undefined)
  const bootstrapped = useRef(false)
  const printingJobs = useRef(new Set<string>())
  const watcherStartedAt = useRef<number | null>(null)
  const checkingOrders = useRef(false)

  const createPrintPayload = useCallback((order: TrackedOrder) => trackedOrderToReceiptPayload(order, {
    isArabic,
    currency,
    invoiceName: isArabic ? settings.invoiceNameAr : settings.invoiceNameEn,
    invoiceAddress: isArabic ? settings.addressAr : settings.addressEn,
    invoicePhone: settings.phone,
    invoiceQrUrl: settings.printers.cashier.printsQr === false ? undefined : settings.invoiceQrUrl,
    invoiceMessage: isArabic ? settings.invoiceWelcomeAr : settings.invoiceWelcomeEn,
    logoUrl: settings.invoiceLogo || settings.heroImage,
  }), [currency, isArabic, settings.addressAr, settings.addressEn, settings.heroImage, settings.invoiceLogo, settings.invoiceNameAr, settings.invoiceNameEn, settings.invoiceQrUrl, settings.invoiceWelcomeAr, settings.invoiceWelcomeEn, settings.phone, settings.printers.cashier.printsQr])

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
    if (!dashboardRole || dashboardRole === 'delivery') return
    let active = true

    const checkOrders = async () => {
      if (checkingOrders.current) return
      checkingOrders.current = true
      try {
        if (!watcherStartedAt.current) watcherStartedAt.current = Date.now()
        const response = await fetch('/api/pos/orders?source=app&limit=40', { cache: 'no-store' })
        const data = await response.json().catch(() => ({}))
        if (!active) return

        const appOrders = (Array.isArray(data.orders) ? data.orders : []) as TrackedOrder[]
        const printedOrders = readAutoPrintedOrders()

        const firstRun = !bootstrapped.current
        const shouldPrintOrder = (order: TrackedOrder) => {
          const createdAt = new Date(order.createdAt).getTime()
          if (Number.isNaN(createdAt)) return !firstRun
          if (!firstRun) return true
          const startedAt = watcherStartedAt.current || Date.now()
          return createdAt >= startedAt - AUTO_PRINT_BACKFILL_MS
        }

        if (firstRun) {
          const oldOrderIds = appOrders
            .filter((order) => !shouldPrintOrder(order))
            .map((order) => order.id)
          if (oldOrderIds.length) oldOrderIds.forEach(markOrderFullyPrinted)
          bootstrapped.current = true
        }

        const newOrders = appOrders
          .filter((order) => {
            if (!shouldPrintOrder(order)) return false
            const roles = printedOrders[order.id] || {}
            return roles.cashier !== true || roles.kitchen !== true
          })
          .sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime())

        if (newOrders.length === 0) return

        syncPrinterManagerSettings(settings.printers)
        for (const order of newOrders) {
          const fullOrder = await fetchDashboardOrderDetails(order.id).catch(() => null)
          const printableOrder = fullOrder || order
          const payload = createPrintPayload(printableOrder)
          const roles = readAutoPrintedOrders()[order.id] || {}
          const cashierEnabled = settings.printers.cashier?.isEnabled === true
          const kitchenEnabled = settings.printers.kitchen?.isEnabled === true

          if (roles.cashier !== true && !cashierEnabled) {
            markOrderRolePrinted(order.id, 'cashier')
          }
          if (roles.kitchen !== true && !kitchenEnabled) {
            markOrderRolePrinted(order.id, 'kitchen')
          }

          const jobs = [
            roles.cashier === true || !cashierEnabled ? null : { role: 'cashier' as const, print: () => printerManager.printCashierReceipt(payload) },
            roles.kitchen === true || !kitchenEnabled ? null : { role: 'kitchen' as const, print: () => printerManager.printKitchenTicket(payload) },
          ].filter(Boolean) as Array<{ role: keyof AutoPrintedOrderRoles; print: () => Promise<{ skipped?: boolean; reason?: string } | unknown> }>

          for (const job of jobs) {
            const jobKey = `${order.id}:${job.role}`
            if (printingJobs.current.has(jobKey)) continue
            printingJobs.current.add(jobKey)

            job.print()
              .then((result) => {
                const value = result as { skipped?: boolean; reason?: string } | undefined
                if (value?.skipped === true) {
                  markOrderRolePrinted(order.id, job.role)
                  console.warn(`[DashboardPrintWatcher] ${job.role} print for app order ${order.id} was skipped: ${value.reason || 'printer is not ready'}`)
                  return
                }
                markOrderRolePrinted(order.id, job.role)
                console.info(`[DashboardPrintWatcher] App order ${order.id} printed on ${job.role}.`)
              })
              .catch((error) => {
                if (isPrinterSelectionBlocked(error)) {
                  markOrderRolePrinted(order.id, job.role)
                  console.warn(`[DashboardPrintWatcher] Automatic ${job.role} print for app order ${order.id} needs a manual printer selection.`)
                  return
                }
                console.error(`[DashboardPrintWatcher] Automatic ${job.role} print failed for app order ${order.id}:`, error)
              })
              .finally(() => {
                printingJobs.current.delete(jobKey)
              })
          }
        }
      } catch (error) {
        console.error('[DashboardPrintWatcher] Could not check app orders:', error)
      } finally {
        checkingOrders.current = false
      }
    }

    checkOrders()
    const interval = window.setInterval(checkOrders, 3000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [createPrintPayload, dashboardRole, settings.printers])

  return null
}
