'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Banknote, Bike, Printer, Minus, Plus, Search, ShoppingCart, Smartphone, Store, Trash2, Utensils, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN, PAYMENT_METHOD_OPTIONS, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_LABELS_EN } from '@/lib/constants'
import { AppSettings, MenuProduct, useAppStore } from '@/lib/app-store'
import { isDisplayableImage } from '@/lib/client-images'
import { TrackedOrder } from '@/lib/order-tracking'
import { printerManager, syncPrinterManagerSettings } from '@/lib/printer'
import { createClosingReceiptPayload } from '@/lib/closing-print'
import { createDriverClosingReceiptPayload, getDriverClosingGroups } from '@/lib/driver-closing-print'
import { readClosings, type ClosingRecord } from '@/lib/closings'
import { queueOfflineAction, syncOfflineQueue } from '@/lib/offline-queue'
import { onOnlineStatusChange, readOfflineStatus } from '@/lib/offline-storage'
import { useSharedAppData } from '@/lib/use-shared-app-data'
import { isItemInShiftWindow, isItemWithinDateRange, saveShiftSession, type ShiftSession } from '@/lib/pos-day-session'
import useShiftSession from '@/lib/use-shift-session'

type PosLine = {
  productId: string
  quantity: number
  notes?: string
}

type PosOrderType = 'dine_in' | 'delivery' | 'takeaway'

type Expense = {
  id: string
  name: string
  amount: number
  date: string
  note: string
  shiftId?: string
}

type PosCustomer = {
  id?: string
  name?: string
  email?: string
  phone?: string
  address?: string
}


const ORDER_TYPE_LABELS: Record<PosOrderType, { ar: string; en: string }> = {
  dine_in: { ar: 'داخل المطعم', en: 'Dine in' },
  delivery: { ar: 'دليفيري', en: 'Delivery' },
  takeaway: { ar: 'تيك أواي', en: 'Takeaway' },
}

const NOTE_OPTIONS = [
  { ar: 'بدون بصل', en: 'No onion' },
  { ar: 'بدون صوص', en: 'No sauce' },
  { ar: 'صوص زيادة', en: 'Extra sauce' },
  { ar: 'بدون خيار', en: 'No pickles' },
  { ar: 'بدون كاتشب', en: 'No ketchup' },
  { ar: 'كاتشب بس', en: 'Ketchup only' },
  { ar: 'بدون مايونيز', en: 'No mayonnaise' },
  { ar: 'حار خفيف', en: 'Mild spicy' },
  { ar: 'حار وسط', en: 'Medium spicy' },
  { ar: 'حار جدا', en: 'Very spicy' },
  { ar: 'عيش ناشف', en: 'Toasted bread' },
  { ar: 'عيش وسط', en: 'Medium bread' },
  { ar: 'بدون كابوتشا', en: 'No lettuce' },
  { ar: 'خيار زيادة', en: 'Extra pickles' },
  { ar: 'أخرى', en: 'Other' },
]


function getDateInputValue(date: string | undefined) {
  const parsed = new Date(date || new Date().toISOString())
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10)
  }
  return parsed.toISOString().slice(0, 10)
}

function getDateRangeBounds(startValue: string, endValue: string) {
  const startDate = new Date(`${startValue}T00:00:00`)
  const endDate = new Date(`${endValue}T23:59:59.999`)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    const fallback = new Date().toISOString()
    return { start: fallback, end: fallback }
  }
  if (startDate.getTime() <= endDate.getTime()) {
    return { start: startDate.toISOString(), end: endDate.toISOString() }
  }
  return { start: endDate.toISOString(), end: startDate.toISOString() }
}

export default function DashboardPosPage() {
  useSharedAppData()
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const { categories, products, drivers, settings } = useAppStore()
  const [lines, setLines] = useState<PosLine[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [shiftClosingPrinting, setShiftClosingPrinting] = useState(false)
  const [message, setMessage] = useState('')
  const [discountCode, setDiscountCode] = useState('')
  const [discountAmount, setDiscountAmount] = useState(0)
  const [shiftOrders, setShiftOrders] = useState<TrackedOrder[]>([])
  const [shiftExpenses, setShiftExpenses] = useState<Expense[]>([])
  const [daySession, setDaySession] = useShiftSession()
  const [inventoryOpen, setInventoryOpen] = useState(false)
  const [inventoryRangeStart, setInventoryRangeStart] = useState(() => getDateInputValue(daySession.openedAt))
  const [inventoryRangeEnd, setInventoryRangeEnd] = useState(() => getDateInputValue(daySession.isOpen ? new Date().toISOString() : daySession.closedAt || daySession.openedAt))
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS.CASH)
  const [orderType, setOrderType] = useState<PosOrderType>('dine_in')
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [savedCustomers, setSavedCustomers] = useState<PosCustomer[]>([])
  const [customNoteDrafts, setCustomNoteDrafts] = useState<Record<string, string>>({})
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerResults, setShowCustomerResults] = useState(false)
  const [driverClosingOpen, setDriverClosingOpen] = useState(false)
  const [legacyAppCardOpen, setLegacyAppCardOpen] = useState(false)
  const [driverClosingRangeStart, setDriverClosingRangeStart] = useState(() => getDateInputValue(daySession.openedAt))
  const [driverClosingRangeEnd, setDriverClosingRangeEnd] = useState(() => getDateInputValue(daySession.isOpen ? new Date().toISOString() : daySession.closedAt || daySession.openedAt))
  const [dashboardRole, setDashboardRole] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(() => readOfflineStatus().isOnline)
  const [syncingOffline, setSyncingOffline] = useState(false)
  const loadingShiftClosing = useRef(false)
  const [customer, setCustomer] = useState({
    name: isArabic ? 'عميل مطعم' : 'Restaurant Customer',
    phone: '',
    deliveryAddress: '',
    notes: '',
  })

  const methodLabels = isArabic ? PAYMENT_METHOD_LABELS : PAYMENT_METHOD_LABELS_EN
  const posPaymentLabel = (method: string) => {
    if (method === PAYMENT_METHODS.CASH) return isArabic ? 'نقدي' : 'Cash'
    return methodLabels[method as keyof typeof PAYMENT_METHOD_LABELS] || method
  }
  const posPaymentHint = (method: string, fallback: string) => {
    if (method === PAYMENT_METHODS.CASH) return isArabic ? 'تحصيل نقدي مباشر من العميل.' : 'Direct cash payment from the customer.'
    return fallback
  }
  const posPaymentLabels = { ...methodLabels, [PAYMENT_METHODS.CASH]: posPaymentLabel(PAYMENT_METHODS.CASH) }
  const orderTypeLabel = ORDER_TYPE_LABELS[orderType][isArabic ? 'ar' : 'en']
  const selectedDriver = drivers.find((driver) => driver.id === selectedDriverId)
  const activeDrivers = drivers.filter((driver) => driver.status === 'active')
  const activeCategories = categories.filter((category) => category.active && products.some((product) => product.available && product.categoryId === category.id))
  const sessionOrders = useMemo(() => shiftOrders.filter((order) => order.status !== 'cancelled'), [shiftOrders])
  const sessionExpenses = useMemo(() => shiftExpenses, [shiftExpenses])
  const sessionRevenue = useMemo(() => sessionOrders.reduce((sum, order) => sum + Number(order.total || 0), 0), [sessionOrders])
  const sessionExpenseTotal = useMemo(() => sessionExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0), [sessionExpenses])
  // drawer net should only include collected amounts (cash paid or POS payments)
  const sessionCollected = useMemo(() => sessionOrders.reduce((sum, order) => {
    const method = String(order.payment?.method || '').toLowerCase()
    const status = String(order.payment?.status || '').toLowerCase()
    if (order.source === 'restaurant_pos' || (method === 'cash' && status === 'paid')) {
      return sum + Number(order.total || 0)
    }
    return sum
  }, 0), [sessionOrders])
  const sessionDrawerNet = useMemo(() => sessionCollected - sessionExpenseTotal, [sessionCollected, sessionExpenseTotal])
  const legacyAppOrders = useMemo(() => shiftOrders.filter((order) => order.status !== 'cancelled' && order.source === 'app'), [shiftOrders])
  const restaurantDriverSummaries = useMemo(() => {
    const groups = new Map<string, { key: string; name: string; phone: string; count: number; total: number; orders: TrackedOrder[] }>()

    for (const order of shiftOrders) {
      if (order.status === 'cancelled' || order.source !== 'restaurant_pos') continue
      const driverName = (order.driver?.name || '').trim()
      const driverPhone = (order.driver?.phone || '').trim()
      if (!driverName || driverName === 'Pending assignment' || driverName === '-') continue

      const key = (order.driver?.email || driverPhone || driverName || 'driver').trim().toLowerCase()
      const current = groups.get(key) || { key, name: driverName, phone: driverPhone || '-', count: 0, total: 0, orders: [] }
      const amount = typeof order.subtotal === 'number' && Number.isFinite(order.subtotal)
        ? Number(order.subtotal || 0)
        : Math.max(0, Number(order.total || 0) - Number(order.deliveryFee || 0))

      current.count += 1
      current.total += amount
      current.orders.push(order)
      groups.set(key, current)
    }

    return Array.from(groups.values()).sort((first, second) => second.total - first.total)
  }, [shiftOrders])
  const inventoryRange = useMemo(() => getDateRangeBounds(inventoryRangeStart, inventoryRangeEnd), [inventoryRangeStart, inventoryRangeEnd])
  const inventoryOrders = useMemo(() => shiftOrders.filter((order) => order.status !== 'cancelled' && isItemWithinDateRange(order.createdAt, inventoryRange.start, inventoryRange.end)), [shiftOrders, inventoryRange.end, inventoryRange.start])
  const inventoryExpenses = useMemo(() => shiftExpenses.filter((expense) => isItemWithinDateRange(expense.date, inventoryRange.start, inventoryRange.end)), [shiftExpenses, inventoryRange.end, inventoryRange.start])
  const inventoryRevenue = useMemo(() => inventoryOrders.reduce((sum, order) => sum + Number(order.total || 0), 0), [inventoryOrders])
  const inventoryExpenseTotal = useMemo(() => inventoryExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0), [inventoryExpenses])
  const inventoryDrawerNet = useMemo(() => inventoryRevenue - inventoryExpenseTotal, [inventoryRevenue, inventoryExpenseTotal])
  const inventoryDriverTotal = useMemo(() => getDriverClosingGroups(inventoryOrders).reduce((sum, group) => sum + group.total, 0), [inventoryOrders])
  const driverClosingRange = useMemo(() => getDateRangeBounds(driverClosingRangeStart, driverClosingRangeEnd), [driverClosingRangeEnd, driverClosingRangeStart])
  const driverClosingOrders = useMemo(() => shiftOrders.filter((order) => order.status !== 'cancelled' && isItemWithinDateRange(order.createdAt, driverClosingRange.start, driverClosingRange.end)), [shiftOrders, driverClosingRange.end, driverClosingRange.start])
  const driverClosingGroups = useMemo(() => getDriverClosingGroups(driverClosingOrders), [driverClosingOrders])
  const driverClosingTotal = useMemo(() => driverClosingGroups.reduce((sum, group) => sum + group.total, 0), [driverClosingGroups])
  const driverClosingOrderCount = useMemo(() => driverClosingGroups.reduce((sum, group) => sum + group.orders.length, 0), [driverClosingGroups])
  const isCashier = dashboardRole === 'cashier'
  const showFinancialSummary = !isCashier
  const customerMatches = savedCustomers
    .filter((item) => {
      const term = customerSearch.trim().toLowerCase()
      if (!term) return false
      return `${item.name || ''} ${item.phone || ''} ${item.email || ''} ${item.address || ''}`.toLowerCase().includes(term)
    })
    .slice(0, 6)
  const orderAddress = orderType === 'delivery' && customer.deliveryAddress.trim()
    ? `${orderTypeLabel} - ${customer.deliveryAddress.trim()}`
    : orderTypeLabel

  const filteredProducts = products.filter((product) => {
    if (!product.available) return false
    if (selectedCategoryId && product.categoryId !== selectedCategoryId) return false
    const term = search.trim().toLowerCase()
    if (!term) return true
    return `${product.nameAr} ${product.nameEn}`.toLowerCase().includes(term)
  })
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId)

  const cartItems = useMemo(() => lines.map((line) => {
    const product = products.find((item) => item.id === line.productId)
    return product ? { ...line, product } : null
  }).filter(Boolean) as Array<PosLine & { product: MenuProduct }>, [lines, products])

  const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  const tax = subtotal * settings.taxRate
  const appliedDeliveryFee = orderType === 'delivery' ? Math.max(0, Number(deliveryFee || 0)) : 0
  const total = Math.max(0, subtotal + tax + appliedDeliveryFee - discountAmount)

  const loadShiftData = useCallback(async () => {
    if (loadingShiftClosing.current) return
    loadingShiftClosing.current = true
    try {
      const activeShiftId = daySession.shiftId
      const [ordersResponse, expensesResponse] = await Promise.all([
        fetch('/api/pos/orders?limit=300', { cache: 'no-store' }),
        fetch('/api/expenses', { cache: 'no-store' }),
      ])

      const ordersData = await ordersResponse.json().catch(() => ({}))
      const expensesData = await expensesResponse.json().catch(() => ({}))

      const allOrders = Array.isArray(ordersData.orders) ? ordersData.orders : []
      const allExpenses = Array.isArray(expensesData.expenses) ? expensesData.expenses : []
      const previousClosings = readClosings()
      const settledOrderIds = new Set(previousClosings.flatMap((closing) => closing.orders?.map((order) => order.id) || []))
      const settledExpenseIds = new Set(previousClosings.flatMap((closing) => closing.expenses?.map((expense) => expense.id) || []))

      const combinedOrders = allOrders.filter((order: TrackedOrder) => {
        if (settledOrderIds.has(order.id) || order.status === 'cancelled') return false
        const createdDuringSession = isItemInShiftWindow(order.createdAt, daySession, { includeSameDayBeforeStart: true })
        if (!activeShiftId) return createdDuringSession || !order.shiftId
        return order.shiftId === activeShiftId || !order.shiftId || createdDuringSession
      })

      const combinedExpenses = allExpenses.filter((expense: Expense) => {
        if (settledExpenseIds.has(expense.id)) return false
        const createdDuringSession = isItemInShiftWindow(expense.date, daySession, { includeSameDayBeforeStart: true })
        if (!activeShiftId) return createdDuringSession || !expense.shiftId
        return expense.shiftId === activeShiftId || !expense.shiftId || createdDuringSession
      })

      setShiftOrders(combinedOrders)
      setShiftExpenses(combinedExpenses)
    } catch (error) {
      console.error('❌ POS - Error loading shift data:', error)
      setShiftOrders([])
      setShiftExpenses([])
    } finally {
      loadingShiftClosing.current = false
    }
  }, [daySession])

  useEffect(() => {
    const timer = window.setTimeout(loadShiftData, 0)
    const interval = window.setInterval(loadShiftData, 60000)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(interval)
    }
  }, [loadShiftData])

  useEffect(() => {
    let active = true
    const unsubscribe = onOnlineStatusChange((onlineStatus) => {
      if (active) {
        setIsOnline(onlineStatus)
        if (onlineStatus && typeof window !== 'undefined') {
          setSyncingOffline(true)
          void syncOfflineQueue()
            .then(() => {
              if (active) setMessage(isArabic ? 'تم مزامنة البيانات بنجاح.' : 'Data synced successfully.')
            })
            .catch(() => {
              if (active) setMessage(isArabic ? 'خطأ في مزامنة البيانات.' : 'Sync error.')
            })
            .finally(() => {
              if (active) setSyncingOffline(false)
            })
        }
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [isArabic])

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
    void syncOfflineQueue()
    const handleOnline = () => {
      void syncOfflineQueue()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  useEffect(() => {
    let active = true
    async function loadCustomers() {
      try {
        const response = await fetch('/api/customers', { cache: 'no-store' })
        const data = await response.json().catch(() => ({}))
        if (active) setSavedCustomers(Array.isArray(data.customers) ? data.customers : [])
      } catch {
        if (active) setSavedCustomers([])
      }
    }

    loadCustomers()
    const interval = window.setInterval(loadCustomers, 120000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  const handleDaySessionToggle = async () => {
    if (daySession.isOpen) {
      const closedAt = new Date().toISOString()
      const nextSession: ShiftSession = { ...daySession, isOpen: false, closedAt }
      saveShiftSession(nextSession)
      setDaySession(nextSession)
      // Clear visible shift data immediately after closing so the UI resets
      setShiftOrders([])
      setShiftExpenses([])
      setMessage(isArabic ? 'تم إغلاق الوردية الحالية.' : 'The current shift has been closed.')
      setShiftClosingPrinting(true)
      if (typeof window !== 'undefined' && daySession.shiftId) {
        const payload = { shiftId: daySession.shiftId, action: 'close', closedAt }
        if (window.navigator.onLine) {
          try {
            await fetch('/api/shifts', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
          } catch {
            queueOfflineAction({ type: 'close-shift', payload })
          }
        } else {
          queueOfflineAction({ type: 'close-shift', payload })
        }
      }
      try {
        const { saveClosing, readClosings } = await import('@/lib/closings')
        const previousClosings = readClosings()
        const settledOrderIds = new Set(previousClosings.flatMap(c => c.orders?.map(o => o.id) || []));
        const settledExpenseIds = new Set(previousClosings.flatMap(c => c.expenses?.map(e => e.id) || []));

        const shiftId = daySession.shiftId
        const closingRangeStart = daySession.openedAt
        const closingRangeEnd = closedAt
        console.log('🔍 Starting shift closing fetch...', { shiftId, previousClosingsCount: previousClosings.length, closingRangeStart, closingRangeEnd });
        
        const [ordersResponse, expensesResponse] = await Promise.all([
          fetch(`/api/pos/orders?limit=9999`, { cache: 'no-store' }),
          fetch(`/api/expenses`, { cache: 'no-store' }),
        ]);

        const ordersData = await ordersResponse.json().catch((err) => { console.error('❌ Error parsing orders:', err); return {}; });
        const expensesData = await expensesResponse.json().catch((err) => { console.error('❌ Error parsing expenses:', err); return {}; });

        const allOrders = Array.isArray(ordersData.orders) ? ordersData.orders : [];
        const allExpenses = Array.isArray(expensesData.expenses) ? expensesData.expenses : [];
        
        console.log('📦 Closing shift - fetched data:', { allOrdersCount: allOrders.length, allExpensesCount: allExpenses.length, shiftId });
        
        const ordersForClosing = allOrders.filter((o: TrackedOrder) => {
          if (settledOrderIds.has(o.id) || o.status === 'cancelled') return false;
          const matchesCurrentShift = o.shiftId === shiftId;
          const createdDuringSession = isItemWithinDateRange(o.createdAt, closingRangeStart, closingRangeEnd, { includeSameDayBeforeStart: true });
          const isLegacyOutsideShift = !o.shiftId;
          const include = matchesCurrentShift || isLegacyOutsideShift || createdDuringSession;
          if (include) {
            console.log(`  ✅ Order ${o.id}: currentShift=${matchesCurrentShift}, legacyOutsideShift=${isLegacyOutsideShift}, createdDuringSession=${createdDuringSession}, shiftId=${o.shiftId}`);
          }
          return include;
        });

        const expensesForClosing = allExpenses.filter((e: Expense) => {
          if (settledExpenseIds.has(e.id)) return false;
          const matchesCurrentShift = e.shiftId === shiftId;
          const createdDuringSession = isItemWithinDateRange(e.date, closingRangeStart, closingRangeEnd, { includeSameDayBeforeStart: true });
          const isLegacyOutsideShift = !e.shiftId;
          const include = matchesCurrentShift || isLegacyOutsideShift || createdDuringSession;
          if (include) {
            console.log(`  ✅ Expense ${e.id}: currentShift=${matchesCurrentShift}, legacyOutsideShift=${isLegacyOutsideShift}, createdDuringSession=${createdDuringSession}, shiftId=${e.shiftId}`);
          }
          return include;
        });

        console.log('💾 Closing shift - filtered data:', { ordersForClosing: ordersForClosing.length, expensesForClosing: expensesForClosing.length });

        await printPosShiftClosing({
          orders: ordersForClosing,
          expenses: expensesForClosing,
          isArabic,
          currency,
          paymentLabels: posPaymentLabels,
          settings,
          setMessage,
          rangeStart: daySession.openedAt,
          rangeEnd: closedAt,
        })
        
        const salesWithoutDelivery = ordersForClosing.reduce((s: number, o: TrackedOrder) => {
            return s + (typeof o.subtotal === 'number' && Number.isFinite(o.subtotal) ? Number(o.subtotal) : Math.max(0, Number(o.total || 0) - Number(o.deliveryFee || 0)))
        }, 0)
        const uncollectedTotal = ordersForClosing.filter((o: TrackedOrder) => o.payment?.status === 'cash_on_delivery').reduce((s: number, o: TrackedOrder) => s + Number(o.total || 0), 0)
        const otherPaymentsTotal = ordersForClosing.filter((o: TrackedOrder) => ['vodafone_cash', 'instapay'].includes(String(o.payment?.method || '').toLowerCase())).reduce((s: number, o: TrackedOrder) => s + Number(o.total || 0), 0)
        const expensesTotal = expensesForClosing.reduce((s: number, e: Expense) => s + Number(e.amount || 0), 0)
        const drawerNet = salesWithoutDelivery - expensesTotal

        const record: ClosingRecord = {
            id: `CLOSE-${Date.now()}`,
            type: 'shift',
            openedAt: daySession.openedAt,
            closedAt,
            ordersCount: ordersForClosing.length,
            salesWithoutDelivery,
            expensesTotal,
            uncollectedTotal,
            otherPaymentsTotal,
            drawerNet,
            shiftId: daySession.shiftId,
            currency,
            orders: ordersForClosing,
            expenses: expensesForClosing,
        }
        
        console.log('📝 [POS] Closing record data:', {
          id: record.id,
          ordersCount: ordersForClosing.length,
          expensesCount: expensesForClosing.length,
          salesWithoutDelivery: record.salesWithoutDelivery,
          expensesTotal: record.expensesTotal,
          drawerNet: record.drawerNet,
          shiftId: record.shiftId,
        });
        
        // Verify orders and expenses have data
        if (ordersForClosing.length > 0) {
          console.log('✅ [POS] Sample orders:', ordersForClosing.slice(0, 2).map((o: TrackedOrder) => ({ id: o.id, total: o.total, shiftId: o.shiftId })));
        } else {
          console.warn('⚠️ [POS] No orders found for closing');
        }
        
        if (expensesForClosing.length > 0) {
          console.log('✅ [POS] Sample expenses:', expensesForClosing.slice(0, 2).map((e: Expense) => ({ id: e.id, amount: e.amount, shiftId: e.shiftId })));
        } else {
          console.warn('⚠️ [POS] No expenses found for closing');
        }
        
        saveClosing(record)
      } catch (err) {
        console.warn('Could not persist closing', err)
      } finally {
        setShiftClosingPrinting(false)
      }
      return
    }

    const nextSession: ShiftSession = { isOpen: true, openedAt: new Date().toISOString(), closedAt: null, shiftId: `SHIFT-${Date.now()}` }
    saveShiftSession(nextSession)
    setDaySession(nextSession)
    setLines([])
    setShiftOrders([])
    setShiftExpenses([])
    setInventoryRangeStart(getDateInputValue(new Date().toISOString()))
    setInventoryRangeEnd(getDateInputValue(new Date().toISOString()))
    setDriverClosingRangeStart(getDateInputValue(new Date().toISOString()))
    setDriverClosingRangeEnd(getDateInputValue(new Date().toISOString()))
    setMessage(isArabic ? 'تم فتح وردية جديدة.' : 'A new shift has been opened.')

    if (typeof window !== 'undefined') {
      const payload = { shiftId: nextSession.shiftId, title: `Shift ${nextSession.shiftId}`, startedAt: nextSession.openedAt, openedAt: nextSession.openedAt, opensAt: nextSession.openedAt }
      if (window.navigator.onLine) {
        try {
          await fetch('/api/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        } catch {
          queueOfflineAction({ type: 'create-shift', payload })
        }
      } else {
        queueOfflineAction({ type: 'create-shift', payload })
      }
    }
  }

  const addProduct = (productId: string) => {
    setLines((current) => {
      const existing = current.find((line) => line.productId === productId)
      if (existing) {
        return current.map((line) => line.productId === productId ? { ...line, quantity: line.quantity + 1 } : line)
      }
      return [...current, { productId, quantity: 1 }]
    })
  }

  const updateQuantity = (productId: string, quantity: number) => {
    setLines((current) => quantity <= 0
      ? current.filter((line) => line.productId !== productId)
      : current.map((line) => line.productId === productId ? { ...line, quantity } : line))
  }

  const selectOrderType = (type: PosOrderType) => {
    setOrderType(type)
    if (type === 'delivery' && deliveryFee <= 0) setDeliveryFee(Number(settings.deliveryFee || 0))
    if (type !== 'delivery') {
      setSelectedDriverId('')
      setDeliveryFee(0)
    }
  }

  const toggleLineNote = (productId: string, note: string) => {
    setLines((current) => current.map((line) => {
      if (line.productId !== productId) return line
      const notes = (line.notes || '')
        .split('،')
        .map((item) => item.trim())
        .filter(Boolean)
      const exists = notes.includes(note)
      const next = exists ? notes.filter((item) => item !== note) : [...notes, note]
      return { ...line, notes: next.filter(Boolean).join('، ') }
    }))
  }

  const handleOtherNoteToggle = (productId: string) => {
    setLines((current) => current.map((line) => {
      if (line.productId !== productId) return line
      const notes = (line.notes || '')
        .split('،')
        .map((item) => item.trim())
        .filter(Boolean)
      const otherLabel = isArabic ? 'أخرى' : 'Other'
      const hasOther = notes.some((item) => item === otherLabel || item.startsWith(`${otherLabel}:`) || item.startsWith(`${otherLabel} -`))
      const next = hasOther
        ? notes.filter((item) => item !== otherLabel && !item.startsWith(`${otherLabel}:`) && !item.startsWith(`${otherLabel} -`))
        : [...notes, otherLabel]
      return { ...line, notes: next.filter(Boolean).join('، ') }
    }))
  }

  const updateCustomNote = (productId: string, value: string) => {
    setCustomNoteDrafts((current) => ({ ...current, [productId]: value }))
    setLines((current) => current.map((line) => {
      if (line.productId !== productId) return line
      const notes = (line.notes || '')
        .split('،')
        .map((item) => item.trim())
        .filter(Boolean)
      const otherLabel = isArabic ? 'أخرى' : 'Other'
      const withoutOther = notes.filter((item) => item !== otherLabel && !item.startsWith(`${otherLabel}:`) && !item.startsWith(`${otherLabel} -`))
      const next = value.trim() ? [...withoutOther, `${otherLabel}: ${value.trim()}`] : withoutOther
      return { ...line, notes: next.filter(Boolean).join('، ') }
    }))
  }

  const selectCustomer = (item: PosCustomer) => {
    setCustomer((current) => ({
      ...current,
      name: item.name || current.name,
      phone: item.phone || current.phone,
      deliveryAddress: item.address || current.deliveryAddress,
    }))
    setCustomerSearch(`${item.name || ''}${item.phone ? ` - ${item.phone}` : ''}`.trim())
    setShowCustomerResults(false)
  }

  const applyDiscount = async () => {
    setMessage('')
    setDiscountAmount(0)
    const code = discountCode.trim()
    if (!code) {
      setMessage(isArabic ? 'اكتب كود الخصم أولا.' : 'Enter a discount code first.')
      return
    }
    if (subtotal <= 0) {
      setMessage(isArabic ? 'أضف منتجات قبل تطبيق الخصم.' : 'Add products before applying a discount.')
      return
    }

    const response = await fetch('/api/discounts/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotal }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.valid) {
      setMessage(data.reason || data.error || (isArabic ? 'كود الخصم غير صالح.' : 'Invalid discount code.'))
      return
    }
    setDiscountAmount(Number(data.discountAmount || 0))
    setMessage(isArabic ? `تم تطبيق الخصم: ${Number(data.discountAmount || 0).toFixed(2)} ${currency}` : `Discount applied: ${Number(data.discountAmount || 0).toFixed(2)} ${currency}`)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!daySession.isOpen) {
      setMessage(isArabic ? 'فتح الورديه ضروري لإنشاء طلب.' : 'Opening a shift is required to create an order.')
      return
    }
    if (cartItems.length === 0) {
      setMessage(isArabic ? 'أضف منتجات قبل إتمام البيع.' : 'Add products before completing the sale.')
      return
    }

    if (orderType === 'delivery' && activeDrivers.length > 0 && !selectedDriverId) {
      setMessage(isArabic ? 'اختر السائق المسؤول عن طلب الدليفري.' : 'Choose the driver responsible for this delivery order.')
      return
    }

    setLoading(true)
    setMessage('')
    try {
      const saleSnapshot = {
        customer: { ...customer, address: orderAddress },
        orderType: orderTypeLabel,
        items: cartItems.map((item) => ({
          name: isArabic ? item.product.nameAr : item.product.nameEn,
          quantity: item.quantity,
          price: item.product.price,
          notes: item.notes,
          categoryName: categories.find((category) => category.id === item.product.categoryId)?.[isArabic ? 'nameAr' : 'nameEn'] || '',
          categoryId: item.product.categoryId,
        })),
        subtotal,
        tax,
        deliveryFee: appliedDeliveryFee,
        discountAmount,
        total,
      }
      const requestPayload = {
        source: 'restaurant_pos',
        shiftId: daySession.shiftId,
        shiftOpenedAt: daySession.openedAt,
        createdAt: new Date().toISOString(),
        customer: { name: customer.name, phone: customer.phone, address: orderAddress },
        driver: orderType === 'delivery' && selectedDriver
          ? { name: selectedDriver.name, email: selectedDriver.email || '', phone: selectedDriver.phone, rating: 0 }
          : undefined,
        phone: customer.phone,
        address: orderAddress,
        lines: cartItems.map((item) => ({
          productId: item.product.id,
          name: isArabic ? item.product.nameAr : item.product.nameEn,
          quantity: item.quantity,
          price: item.product.price,
          notes: item.notes,
          categoryName: categories.find((category) => category.id === item.product.categoryId)?.[isArabic ? 'nameAr' : 'nameEn'] || '',
          categoryId: item.product.categoryId,
        })),
        items: cartItems.reduce((sum, item) => sum + item.quantity, 0),
        subtotal,
        tax,
        deliveryFee: appliedDeliveryFee,
        discountCode: discountAmount > 0 ? discountCode : undefined,
        paymentMethod,
        paymentStatus: (orderType === 'delivery' && paymentMethod === 'cash') ? 'cash_on_delivery' : 'paid',
        status: 'confirmed',
        estimatedDelivery: orderTypeLabel,
      }
      let data: { order?: { id?: string; createdAt?: string }; message?: string; error?: string } = {}
      if (!window.navigator.onLine) {
        queueOfflineAction({ type: 'create-order', payload: requestPayload })
        data = { order: { id: `offline-${Date.now()}` } }
      } else {
        try {
          const response = await fetch('/api/pos/orders', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-shift-id': daySession.shiftId || '',
            },
            body: JSON.stringify(requestPayload),
          })
          data = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(data.message || data.error || 'Could not create sale')
        } catch (error) {
          queueOfflineAction({ type: 'create-order', payload: requestPayload })
          data = { order: { id: `offline-${Date.now()}` } }
          setMessage(error instanceof Error ? error.message : (isArabic ? 'تم حفظ الطلب في وضع غير متصل وسيتم رفعه عند عودة الاتصال.' : 'Order queued while offline and will sync when the connection returns.'))
        }
      }
      if (paymentMethod === PAYMENT_METHODS.OFFERS && total > 0) {
        const expensePayload = {
          name: isArabic ? `خصم عرض - طلب ${data.order?.id?.slice(0, 8)}` : `Offer Discount - Order ${data.order?.id?.slice(0, 8)}`,
          amount: total,
          note: isArabic ? `خصم قيمة طلب العميل ${customer.name}` : `Discount for customer order ${customer.name}`,
          date: new Date().toISOString(),
          shiftId: daySession.shiftId,
          shiftOpenedAt: daySession.openedAt,
        }
        const expenseRequest = { type: 'create-expense' as const, payload: expensePayload }
        if (!window.navigator.onLine) {
          queueOfflineAction(expenseRequest)
        } else {
          // Fire and forget
          fetch('/api/expenses', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-shift-id': daySession.shiftId || '',
            },
            body: JSON.stringify(expensePayload),
          }).catch(() => queueOfflineAction(expenseRequest))
        }
      }
      if (customer.name.trim() || customer.phone.trim()) {
        void fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: customer.name,
            phone: customer.phone,
            address: customer.deliveryAddress,
          }),
        }).catch(() => undefined)
      }
      setMessage(isArabic ? `تم البيع وإنشاء الطلب: ${data.order?.id || ''}` : `Sale completed and order created: ${data.order?.id || ''}`)
      syncPrinterManagerSettings(settings.printers)
      
      // Reload shift data to show newly created order immediately
      setTimeout(() => {
        loadShiftData()
      }, 500)
      const receiptPayload = {
        orderId: data.order?.id || '',
        orderType: orderTypeLabel,
        tableNumber: orderType === 'dine_in' ? customer.deliveryAddress || '1' : undefined,
        createdAt: data.order?.createdAt || new Date().toISOString(),
        customer: saleSnapshot.customer,
        driver: orderType === 'delivery' && selectedDriver
          ? { name: selectedDriver.name, phone: selectedDriver.phone, email: selectedDriver.email || '' }
          : undefined,
        lines: saleSnapshot.items,
        subtotal: saleSnapshot.subtotal,
        tax: saleSnapshot.tax,
        deliveryFee: saleSnapshot.deliveryFee,
        discountAmount: saleSnapshot.discountAmount,
        total: saleSnapshot.total,
        paymentMethod: posPaymentLabel(paymentMethod),
        currency,
        invoiceName: isArabic ? settings.invoiceNameAr : settings.invoiceNameEn,
        invoiceAddress: isArabic ? settings.addressAr : settings.addressEn,
        invoicePhone: settings.phone,
        invoiceQrUrl: settings.printers.cashier.printsQr === false ? undefined : settings.invoiceQrUrl,
        invoiceQrUrl2: settings.printers.cashier.printsQr === false ? undefined : settings.invoiceQrUrl2,
        invoiceMessage: isArabic ? settings.invoiceWelcomeAr : settings.invoiceWelcomeEn,
        logoUrl: settings.invoiceLogo,
        isArabic,
      }
      setMessage(isArabic ? 'تم البيع وإنشاء الطلب - جاري الطباعة...' : 'Sale completed - printing...')
      const cashierResult = await printerManager.printCashierReceipt(receiptPayload).catch((error) => ({ failed: true, error }))
      const cashierValue = cashierResult as { skipped?: boolean; reason?: string; failed?: boolean; error?: unknown }
      if (cashierValue.failed) {
        const error = cashierValue.error
        setMessage(error instanceof Error ? error.message : (isArabic ? 'تم البيع، لكن تعذر إرسال فاتورة الكاشير.' : 'Sale completed, but the cashier receipt could not be sent.'))
      } else if (cashierValue.skipped) {
        setMessage(cashierValue.reason || (isArabic ? 'تم البيع، لكن لم ترسل فاتورة الكاشير لأن إعدادات الطابعة غير مكتملة.' : 'Sale completed, but the cashier receipt was not sent because printer settings are incomplete.'))
      } else {
        setMessage(isArabic ? `تم البيع وإنشاء الطلب: ${data.order?.id || ''}` : `Sale completed and order created: ${data.order?.id || ''}`)
      }
      void Promise.allSettled([
        printerManager.printKitchenTicket(receiptPayload),
        printerManager.printHallTicket(receiptPayload),
      ]).then((results) => {
        const failedSidePrints = results.filter((result) => result.status === 'rejected').length
        if (failedSidePrints) console.warn(`[POS] ${failedSidePrints} background print job(s) failed.`)
      })
      const printResults: Array<PromiseSettledResult<unknown>> = []
      const failedPrints = printResults.filter((result) => result.status === 'rejected')
      const skippedPrints = printResults.filter((result) => result.status === 'fulfilled' && (result.value as { skipped?: boolean } | undefined)?.skipped)
      const sentPrints = printResults.filter((result) => result.status === 'fulfilled' && (result.value as { skipped?: boolean } | undefined)?.skipped !== true)
      if (sentPrints.length === 0 && skippedPrints.length > 0) {
        const reason = (skippedPrints[0] as PromiseFulfilledResult<{ reason?: string }>).value?.reason
        setMessage(reason || (isArabic ? 'ØªÙ… Ø§Ù„Ø¨ÙŠØ¹ ÙˆØ¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ø·Ù„Ø¨ØŒ Ù„ÙƒÙ† Ù„Ù… ØªØ±Ø³Ù„ Ø§Ù„ÙØ§ØªÙˆØ±Ø© Ù„Ø£Ù† Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ø·Ø§Ø¨Ø¹Ø© ØºÙŠØ± Ù…ÙƒØªÙ…Ù„Ø©.' : 'Sale completed, but the receipt was not sent because printer settings are incomplete.'))
      }
      if (failedPrints.length) {
        setMessage(isArabic
          ? `تم البيع وإنشاء الطلب، لكن فشل إرسال ${failedPrints.length} أمر طباعة. راجع إعدادات الطابعات.`
          : `Sale completed, but ${failedPrints.length} print job(s) failed. Check printer settings.`)
      }
      // Reset form completely after sale
      setLines([])
      setDiscountCode('')
      setDiscountAmount(0)
      setPaymentMethod(PAYMENT_METHODS.CASH)
      setSelectedDriverId('')
      setDeliveryFee(0)
      setSelectedCategoryId('')
      setSearch('')
      setCustomer({ name: isArabic ? 'عميل مطعم' : 'Restaurant Customer', phone: '', deliveryAddress: '', notes: '' })
      setCustomerSearch('')
      setShowCustomerResults(false)
      setCustomNoteDrafts({})
      setOrderType('dine_in')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (isArabic ? 'تعذر إتمام البيع.' : 'Could not complete sale.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {!isOnline && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">{isArabic ? '⚠️ بدون إنترنت - يعمل بدون اتصال' : '⚠️ Offline Mode - Working without internet'}</p>
          <p className="text-xs text-amber-800 dark:text-amber-200">{isArabic ? 'سيتم رفع جميع البيانات عند عودة الاتصال.' : 'All data will be synced when connection returns.'}</p>
        </div>
      )}
      {syncingOffline && (
        <div className="rounded-md border border-blue-300 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">{isArabic ? '⏳ جاري المزامنة...' : '⏳ Syncing...'}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
        <div>
          <h2 className="text-xl font-bold">{isArabic ? 'نقطة البيع' : 'Point of Sale'}</h2>
          <p className="text-sm text-slate-500">{isArabic ? 'انتقل إلى صفحات التقفيل الحديثة لإدارة التسويات الوردية والسائقين.' : 'Move to the modern closing pages to manage shift and driver settlements.'}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
        <div className="rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900">
          <span className="font-semibold">{daySession.isOpen ? (isArabic ? 'وردية مفتوحة' : 'Open shift') : (isArabic ? 'وردية مغلقة' : 'Closed shift')}</span>
          <span className="mx-2 text-slate-400">|</span>
          <span>{sessionOrders.length} {isArabic ? 'طلب' : 'orders'}</span>
          <span className="mx-2 text-slate-400">|</span>
          <span>{sessionExpenses.length} {isArabic ? 'مصروف' : 'expenses'}</span>
          {showFinancialSummary && (
            <>
              <span className="mx-2 text-slate-400">|</span>
              <span>{sessionRevenue.toFixed(2)} {currency}</span>
            </>
          )}
        </div>
        {showFinancialSummary && (
          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm font-semibold dark:bg-slate-900">
            {isArabic ? 'صافي الوردية' : 'Shift net'}: {sessionDrawerNet.toFixed(2)} {currency}
          </div>
        )}
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {isArabic ? 'الإدارة من صفحة تقفيل الورديه' : 'Managed from the shift closing page'}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{isArabic ? 'نقطة بيع المطعم' : 'Restaurant Point of Sale'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
            <Search className="h-4 w-4 text-slate-500" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isArabic ? 'بحث في المنتجات' : 'Search products'} className="h-10 flex-1 bg-transparent text-sm outline-none" />
          </div>
          {!selectedCategoryId && !search.trim() && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
              {activeCategories.map((category) => {
                const count = products.filter((product) => product.available && product.categoryId === category.id).length
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(category.id)}
                    className="flex min-h-32 flex-col justify-between rounded-lg border bg-white p-4 text-start shadow-sm transition hover:border-red-300 hover:bg-red-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-red-950/20"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-md bg-red-50 text-red-600 dark:bg-red-950">
                      <Utensils className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-base font-bold">{isArabic ? category.nameAr : category.nameEn}</span>
                      <span className="mt-1 block text-xs text-slate-500">{count} {isArabic ? 'منتج' : 'products'}</span>
                    </span>
                  </button>
                )
              })}
              {activeCategories.length === 0 && (
                <p className="col-span-full rounded-md border border-dashed p-6 text-center text-sm text-slate-500">
                  {isArabic ? 'لا توجد أقسام بها منتجات متاحة.' : 'No categories with available products.'}
                </p>
              )}
            </div>
          )}
          {(selectedCategoryId || search.trim()) && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 p-2 dark:bg-slate-900">
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => { setSelectedCategoryId(''); setSearch('') }}>
                <ArrowLeft className="h-4 w-4" />
                {isArabic ? 'رجوع للأقسام' : 'Back to categories'}
              </Button>
              <p className="text-sm font-semibold">
                {search.trim()
                  ? (isArabic ? 'نتائج البحث' : 'Search results')
                  : selectedCategory ? (isArabic ? selectedCategory.nameAr : selectedCategory.nameEn) : ''}
              </p>
            </div>
          )}
          <div className={`${!selectedCategoryId && !search.trim() ? 'hidden' : 'grid'} grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4`}>
            {filteredProducts.map((product) => {
              const name = isArabic ? product.nameAr : product.nameEn
              return (
                <button key={product.id} type="button" onClick={() => addProduct(product.id)} className="overflow-hidden rounded-lg border bg-white text-start shadow-sm transition hover:border-red-300 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex aspect-square items-center justify-center bg-slate-50 p-2 text-4xl dark:bg-slate-900">
                    {isDisplayableImage(product.image) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.image} alt={name} className="h-full w-full object-contain" />
                    ) : <span>{product.image || '🍽️'}</span>}
                  </div>
                  <div className="p-2">
                    <p className="line-clamp-2 min-h-9 text-sm font-semibold">{name}</p>
                    <p className="text-sm font-bold text-red-600">{product.price.toFixed(2)} {currency}</p>
                  </div>
                </button>
              )
            })}
            {filteredProducts.length === 0 && (
              <p className="col-span-full rounded-md border border-dashed p-6 text-center text-sm text-slate-500">
                {isArabic ? 'لا توجد منتجات مطابقة.' : 'No matching products.'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{isArabic ? 'فاتورة البيع' : 'Sale Ticket'}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="relative">
              <Label htmlFor="pos-customer-search">{isArabic ? 'بحث عن عميل' : 'Find customer'}</Label>
              <div className="mt-1 flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  id="pos-customer-search"
                  value={customerSearch}
                  onChange={(event) => {
                    setCustomerSearch(event.target.value)
                    setShowCustomerResults(true)
                  }}
                  onFocus={() => setShowCustomerResults(true)}
                  placeholder={isArabic ? 'ابحث بالاسم أو الهاتف' : 'Search by name or phone'}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </div>
              {showCustomerResults && customerSearch.trim() && (
                <div className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-800 dark:bg-slate-950">
                  {customerMatches.length > 0 ? customerMatches.map((item) => (
                    <button
                      key={item.id || item.email || item.phone || item.name}
                      type="button"
                      onClick={() => selectCustomer(item)}
                      className="w-full rounded-sm px-3 py-2 text-start text-sm hover:bg-slate-100 dark:hover:bg-slate-900"
                    >
                      <span className="block font-semibold">{item.name || '-'}</span>
                      <span className="block text-xs text-slate-500">{item.phone || item.email || '-'}</span>
                    </button>
                  )) : (
                    <p className="px-3 py-2 text-sm text-slate-500">{isArabic ? 'لا يوجد عميل مطابق.' : 'No matching customer.'}</p>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="customer" label={isArabic ? 'اسم العميل' : 'Customer'} value={customer.name} onChange={(value) => setCustomer({ ...customer, name: value })} />
              <Field id="phone" label={isArabic ? 'الهاتف' : 'Phone'} value={customer.phone} onChange={(value) => setCustomer({ ...customer, phone: value })} />
            </div>

            <div>
              <Label htmlFor="order-type">{isArabic ? 'نوع الطلب' : 'Order type'}</Label>
              <div id="order-type" className="mt-2 grid gap-2 sm:grid-cols-3">
                {(Object.keys(ORDER_TYPE_LABELS) as PosOrderType[]).map((type) => {
                  const selected = orderType === type
                  const Icon = type === 'delivery' ? Bike : type === 'takeaway' ? Store : Utensils
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => selectOrderType(type)}
                      className={`rounded-md border p-3 text-start transition ${selected ? 'border-red-500 bg-red-50 text-red-950 ring-1 ring-red-500 dark:bg-red-950/30 dark:text-red-100' : 'border-slate-200 bg-white hover:border-red-200 dark:border-slate-800 dark:bg-slate-950'}`}
                    >
                      <span className="flex items-center gap-2 text-sm font-bold">
                        <Icon className="h-4 w-4 text-red-600" />
                        {ORDER_TYPE_LABELS[type][isArabic ? 'ar' : 'en']}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {orderType === 'delivery' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="delivery-address" label={isArabic ? 'عنوان العميل' : 'Delivery address'} value={customer.deliveryAddress} onChange={(value) => setCustomer({ ...customer, deliveryAddress: value })} />
                <Field id="delivery-fee" label={isArabic ? 'قيمة التوصيل' : 'Delivery fee'} value={String(deliveryFee)} onChange={(value) => setDeliveryFee(Number(value || 0))} type="number" />
              </div>
            )}

            {orderType === 'delivery' && (
              <div>
                <Label htmlFor="delivery-driver">{isArabic ? 'السائق المسؤول' : 'Assigned driver'}</Label>
                <select
                  id="delivery-driver"
                  value={selectedDriverId}
                  onChange={(event) => setSelectedDriverId(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                >
                  <option value="">{isArabic ? 'اختر السائق' : 'Choose driver'}</option>
                  {activeDrivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>{driver.name} - {driver.phone || '-'}</option>
                  ))}
                </select>
                {activeDrivers.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">
                    {isArabic ? 'لا يوجد سائقون نشطون حاليا.' : 'No active drivers are available.'}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              {cartItems.length === 0 ? (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-slate-500">{isArabic ? 'السلة فارغة.' : 'Ticket is empty.'}</p>
              ) : cartItems.map((item) => (
                <div key={item.productId} className="rounded-md border p-2 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{isArabic ? item.product.nameAr : item.product.nameEn}</p>
                      <p className="text-xs text-slate-500">{item.product.price.toFixed(2)} {currency}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQuantity(item.productId, item.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                      <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                      <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQuantity(item.productId, item.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                      <Button type="button" size="icon" variant="destructive" className="h-8 w-8" onClick={() => updateQuantity(item.productId, 0)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="mb-2 text-xs font-semibold text-slate-500">{isArabic ? 'ملاحظات هذا الصنف' : 'Item notes'}</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {NOTE_OPTIONS.map((option) => {
                        const label = option[isArabic ? 'ar' : 'en']
                        const selected = (item.notes || '').split('،').map((note) => note.trim()).some((note) => note === label || note.startsWith(`${label}:`) || note.startsWith(`${label} -`))
                        return (
                          <button
                            key={`${item.productId}-${option.ar}`}
                            type="button"
                            onClick={() => label === (isArabic ? 'أخرى' : 'Other') ? handleOtherNoteToggle(item.productId) : toggleLineNote(item.productId, label)}
                            className={`min-h-10 rounded-md border px-2 py-2 text-center text-xs font-bold transition ${
                              selected
                                ? 'border-red-600 bg-red-600 text-white shadow-sm'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-red-300 hover:bg-red-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-red-950/30'
                            }`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                    {(item.notes || '').split('،').map((note) => note.trim()).filter(Boolean).some((note) => note === (isArabic ? 'أخرى' : 'Other') || note.startsWith(`${isArabic ? 'أخرى' : 'Other'}:`) || note.startsWith(`${isArabic ? 'أخرى' : 'Other'} -`)) && (
                      <Input
                        value={customNoteDrafts[item.productId] || ''}
                        onChange={(event) => updateCustomNote(item.productId, event.target.value)}
                        placeholder={isArabic ? 'اكتب ملاحظة أخرى' : 'Write a custom note'}
                        className="mt-2"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input value={discountCode} onChange={(event) => setDiscountCode(event.target.value)} placeholder={isArabic ? 'كود الخصم' : 'Discount code'} />
              <Button type="button" variant="outline" onClick={applyDiscount}>{isArabic ? 'تطبيق' : 'Apply'}</Button>
            </div>

            <div>
              <Label>{isArabic ? 'طريقة الدفع' : 'Payment method'}</Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {PAYMENT_METHOD_OPTIONS.map((option) => {
                  const selected = paymentMethod === option.value
                  const Icon = option.value === PAYMENT_METHODS.CASH ? Banknote : Smartphone
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPaymentMethod(option.value)}
                      className={`rounded-md border p-3 text-start transition ${selected ? 'border-red-500 bg-red-50 ring-1 ring-red-500 dark:bg-red-950/30' : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950'}`}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <Icon className="h-4 w-4 text-red-600" />
                        {posPaymentLabel(option.value)}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">{posPaymentHint(option.value, isArabic ? option.arHint : option.enHint)}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2 rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-900">
              <Line label={isArabic ? 'المجموع' : 'Subtotal'} value={`${subtotal.toFixed(2)} ${currency}`} />
              <Line label={isArabic ? 'الضريبة' : 'Tax'} value={`${tax.toFixed(2)} ${currency}`} />
              {orderType === 'delivery' && <Line label={isArabic ? 'خدمة التوصيل' : 'Delivery service'} value={`${appliedDeliveryFee.toFixed(2)} ${currency}`} />}
              <Line label={isArabic ? 'الخصم' : 'Discount'} value={`-${discountAmount.toFixed(2)} ${currency}`} />
              <Line label={isArabic ? 'الإجمالي' : 'Total'} value={`${total.toFixed(2)} ${currency}`} strong />
            </div>

            <Button type="submit" disabled={loading} className="w-full gap-2 bg-red-600 hover:bg-red-700">
              <ShoppingCart className="h-4 w-4" />
              {loading ? (isArabic ? 'جاري البيع...' : 'Completing sale...') : (isArabic ? 'إتمام البيع' : 'Complete Sale')}
            </Button>
            {message && <p className="rounded-md bg-slate-100 p-3 text-sm dark:bg-slate-900">{message}</p>}
          </form>
        </CardContent>
      </Card>
      </div>

      {inventoryOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inventory-count-title"
          onMouseDown={() => setInventoryOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-md bg-white shadow-xl dark:bg-slate-950"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <div>
                <h3 id="inventory-count-title" className="text-xl font-bold">{isArabic ? 'عداد المخزون' : 'Inventory Count'}</h3>
                <p className="text-sm text-slate-500">{new Date(inventoryRange.end).toLocaleString(isArabic ? 'ar-EG' : 'en-US')}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setInventoryOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-4 p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
                  <p className="text-xs text-slate-500">{isArabic ? 'صافي الدرج' : 'Drawer net'}</p>
                  <p className="text-xl font-bold text-red-600">{inventoryDrawerNet.toFixed(2)} {currency}</p>
                </div>
                <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
                  <p className="text-xs text-slate-500">{isArabic ? 'تحصيل السائقين' : 'Driver amounts'}</p>
                  <p className="text-xl font-bold">{inventoryDriverTotal.toFixed(2)} {currency}</p>
                </div>
                <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
                  <p className="text-xs text-slate-500">{isArabic ? 'المصروفات' : 'Expenses'}</p>
                  <p className="text-xl font-bold">{inventoryExpenseTotal.toFixed(2)} {currency}</p>
                </div>
              </div>
              <div className="space-y-3 rounded-md bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-900">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide">{isArabic ? 'من' : 'From'}</span>
                    <Input type="date" value={inventoryRangeStart} onChange={(event) => setInventoryRangeStart(event.target.value)} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide">{isArabic ? 'إلى' : 'To'}</span>
                    <Input type="date" value={inventoryRangeEnd} onChange={(event) => setInventoryRangeEnd(event.target.value)} />
                  </label>
                </div>
                <p>{isArabic ? 'المدة' : 'Period'}: {new Date(inventoryRange.start).toLocaleString(isArabic ? 'ar-EG' : 'en-US')} → {new Date(inventoryRange.end).toLocaleString(isArabic ? 'ar-EG' : 'en-US')}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {legacyAppCardOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="legacy-app-card-title"
          onMouseDown={() => setLegacyAppCardOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-md bg-white shadow-xl dark:bg-slate-950"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <div>
                <h3 id="legacy-app-card-title" className="text-xl font-bold">{isArabic ? 'بطاقة السائقين والطلبات القديمة' : 'Drivers and legacy app orders card'}</h3>
                <p className="text-sm text-slate-500">{isArabic ? 'عرض سريع للسائقين وجميع الطلبات القديمة على التطبيق' : 'Quick view of drivers and all legacy app orders'}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setLegacyAppCardOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-4 p-4">
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-md border border-slate-200 p-4 dark:border-slate-800">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-lg font-bold">{isArabic ? 'السائقين' : 'Drivers'}</h4>
                    <span className="text-sm text-slate-500">{drivers.length}</span>
                  </div>
                  {drivers.length === 0 ? (
                    <p className="text-sm text-slate-500">{isArabic ? 'لا يوجد سائقون مسجلون.' : 'No drivers are registered.'}</p>
                  ) : (
                    <div className="space-y-2">
                      {drivers.map((driver) => (
                        <div key={driver.id} className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-900">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">{driver.name || '-'}</span>
                            <span className={`rounded-full px-2 py-1 text-xs ${driver.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                              {driver.status === 'active' ? (isArabic ? 'نشط' : 'Active') : (isArabic ? 'غير نشط' : 'Inactive')}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {driver.phone || '-'} {driver.email ? `• ${driver.email}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4 rounded-md border border-slate-200 p-4 dark:border-slate-800">
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-lg font-bold">{isArabic ? 'طلبات المطعم على السائقين' : 'Restaurant orders on drivers'}</h4>
                      <span className="text-sm text-slate-500">{restaurantDriverSummaries.length}</span>
                    </div>
                    {restaurantDriverSummaries.length === 0 ? (
                      <p className="text-sm text-slate-500">{isArabic ? 'لا توجد طلبات مطعم مع سائق معين.' : 'No restaurant orders are assigned to drivers.'}</p>
                    ) : (
                      <div className="space-y-2">
                        {restaurantDriverSummaries.map((driverSummary) => (
                          <div key={driverSummary.key} className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-900">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold">{driverSummary.name}</span>
                              <span className="font-bold text-red-600">{driverSummary.count} {isArabic ? 'طلب' : 'orders'}</span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">{driverSummary.phone}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {isArabic ? 'الإجمالي بدون خدمة التوصيل' : 'Total without delivery fee'}: {driverSummary.total.toFixed(2)} {currency}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-lg font-bold">{isArabic ? 'الطلبات القديمة على التطبيق' : 'Legacy app orders'}</h4>
                      <span className="text-sm text-slate-500">{legacyAppOrders.length}</span>
                    </div>
                    {legacyAppOrders.length === 0 ? (
                      <p className="text-sm text-slate-500">{isArabic ? 'لا توجد طلبات قديمة على التطبيق.' : 'No legacy app orders found.'}</p>
                    ) : (
                      <div className="space-y-2">
                        {legacyAppOrders.map((order) => (
                          <div key={order.id} className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-900">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold">#{order.displayNumber || order.id}</span>
                              <span className="font-bold text-red-600">{Number(order.total || 0).toFixed(2)} {currency}</span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {order.customer || '-'} • {order.phone || '-'}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {order.driver?.name ? `${isArabic ? 'السائق' : 'Driver'}: ${order.driver.name}` : (isArabic ? 'بدون سائق' : 'No driver')}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {driverClosingOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="driver-closing-title"
          onMouseDown={() => setDriverClosingOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-md bg-white shadow-xl dark:bg-slate-950"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <div>
                <h3 id="driver-closing-title" className="text-xl font-bold">{isArabic ? 'تقفيل السائقين' : 'Driver Closing'}</h3>
                <p className="text-sm text-slate-500">{new Date(driverClosingRange.end).toLocaleDateString(isArabic ? 'ar-EG' : 'en-US')}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  className="gap-2 bg-red-600 hover:bg-red-700"
                  onClick={() => printPosDriverClosing({ orders: shiftOrders, isArabic, currency, settings, setMessage, rangeStart: driverClosingRange.start, rangeEnd: driverClosingRange.end })}
                >
                  <Printer className="h-4 w-4" />
                  {isArabic ? 'طباعة' : 'Print'}
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => setDriverClosingOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="space-y-4 p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
                  <p className="text-xs text-slate-500">{isArabic ? 'إجمالي المطلوب' : 'Amount Due'}</p>
                  <p className="text-xl font-bold text-red-600">{driverClosingTotal.toFixed(2)} {currency}</p>
                </div>
                <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
                  <p className="text-xs text-slate-500">{isArabic ? 'عدد السائقين' : 'Drivers'}</p>
                  <p className="text-xl font-bold">{driverClosingGroups.length}</p>
                </div>
                <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
                  <p className="text-xs text-slate-500">{isArabic ? 'طلبات عند الاستلام' : 'COD Orders'}</p>
                  <p className="text-xl font-bold">{driverClosingOrderCount}</p>
                </div>
              </div>

              {driverClosingGroups.length === 0 ? (
                <div className="rounded-md bg-slate-50 p-6 text-center text-sm text-slate-500 dark:bg-slate-900">
                  {isArabic ? 'لا توجد طلبات دفع عند الاستلام معيّنة لسائقين في هذه الوردية.' : 'No assigned cash-on-delivery orders for drivers in this shift.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {driverClosingGroups.map((group) => (
                    <div key={group.key} className="rounded-md border border-slate-200 p-4 dark:border-slate-800">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-bold">{group.name}</p>
                          <p className="text-sm text-slate-500">{group.phone}</p>
                          <p className="mt-1 text-xs text-slate-500">{group.orders.length} {isArabic ? 'طلب عند الاستلام' : 'COD orders'}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {isArabic ? 'تطبيق' : 'App'}: {group.appOrders} / {group.appTotal.toFixed(2)} {currency}
                            {' - '}
                            {isArabic ? 'مطعم' : 'POS'}: {group.restaurantOrders} / {group.restaurantTotal.toFixed(2)} {currency}
                          </p>
                        </div>
                        <div className="text-end">
                          <p className="text-xs text-slate-500">{isArabic ? 'المبلغ المطلوب دفعه' : 'Amount to pay'}</p>
                          <p className="text-2xl font-bold text-red-600">{group.total.toFixed(2)} {currency}</p>
                        </div>
                      </div>
                      <div className="mt-3 divide-y divide-slate-100 rounded-md bg-slate-50 dark:divide-slate-800 dark:bg-slate-900">
                        {group.orders.map((order) => (
                          <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                            <span className="font-medium">
                              {order.source === 'restaurant_pos' ? (isArabic ? 'مطعم' : 'POS') : (isArabic ? 'تطبيق' : 'App')} - {order.id} - {order.customer || '-'}
                            </span>
                            <span className="font-bold">{Number(order.total || 0).toFixed(2)} {currency}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

async function printPosDriverClosing({
  orders,
  isArabic,
  currency,
  settings,
  setMessage,
  rangeStart,
  rangeEnd,
}: {
  orders: TrackedOrder[]
  isArabic: boolean
  currency: string
  settings: AppSettings
  setMessage: (message: string) => void
  rangeStart: string
  rangeEnd: string
}) {
  const today = new Date()
  const dayOrders = orders.filter((order) => isItemWithinDateRange(order.createdAt, rangeStart, rangeEnd, { includeSameDayBeforeStart: true }))
  const cashierPrinter = settings.printers.cashier
  if (!cashierPrinter?.isEnabled) {
    setMessage(isArabic ? 'فعّل طابعة الكاشير من الإعدادات قبل طباعة تقفيل السائقين.' : 'Enable the cashier printer in settings before printing the driver closing.')
    return
  }

  syncPrinterManagerSettings(settings.printers)
  try {
    const result = await printerManager.printCashierReceipt(createDriverClosingReceiptPayload({
      title: isArabic ? 'تقفيل السائقين - نقطة البيع' : 'Driver Closing - POS',
      dateLabel: today.toISOString().slice(0, 10),
      orders: dayOrders,
      currency,
      isArabic,
      invoiceName: isArabic ? settings.invoiceNameAr : settings.invoiceNameEn,
      invoiceAddress: isArabic ? settings.addressAr : settings.addressEn,
      invoicePhone: settings.phone,
      logoUrl: settings.invoiceLogo,
    })) as { skipped?: boolean; reason?: string }
    if (result?.skipped) {
      setMessage(result.reason || (isArabic ? 'لم يتم إرسال تقفيل السائقين لأن الطابعة غير مكتملة الإعداد.' : 'Driver closing was not sent because the printer is not fully configured.'))
      return
    }
    setMessage(isArabic ? 'تم إرسال تقفيل السائقين إلى طابعة الكاشير.' : 'Driver closing sent to the cashier printer.')
  } catch (error) {
    setMessage(error instanceof Error ? error.message : (isArabic ? 'تعذر طباعة تقفيل السائقين.' : 'Could not print the driver closing.'))
  }
}

async function printPosShiftClosing({
  orders,
  expenses,
  isArabic,
  currency,
  paymentLabels,
  settings,
  setMessage,
  rangeStart,
  rangeEnd,
}: {
  orders: TrackedOrder[]
  expenses: Expense[]
  isArabic: boolean
  currency: string
  paymentLabels: Record<string, string>
  settings: AppSettings
  setMessage: (message: string) => void
  rangeStart: string
  rangeEnd: string
}) {
  const today = new Date()
  const dayOrders = orders.filter((order) => {
    if (order.status === 'cancelled') return false
    if (!order.shiftId) return true
    return isItemWithinDateRange(order.createdAt, rangeStart, rangeEnd, { includeSameDayBeforeStart: true })
  })
  const dayExpenses = expenses.filter((expense) => !expense.shiftId || isItemWithinDateRange(expense.date, rangeStart, rangeEnd, { includeSameDayBeforeStart: true }))
  const revenue = dayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
  const expenseTotal = dayExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  const net = revenue - expenseTotal
  const payments = dayOrders.reduce<Record<string, number>>((totals, order) => {
    const method = order.payment?.method || 'cash'
    totals[method] = (totals[method] || 0) + Number(order.total || 0)
    return totals
  }, {})
  const cashierPrinter = settings.printers.cashier
  if (!cashierPrinter?.isEnabled) {
    setMessage(isArabic ? 'فعّل طابعة الكاشير من الإعدادات قبل طباعة تقفيل الوردية.' : 'Enable the cashier printer in settings before printing the shift closing.')
    return
  }

  syncPrinterManagerSettings(settings.printers)
  try {
    const result = await printerManager.printCashierReceipt(createClosingReceiptPayload({
      title: isArabic ? 'تقفيل الوردية - نقطة البيع' : 'Shift Closing - POS',
      dateLabel: today.toISOString().slice(0, 10),
      orders: dayOrders,
      expenses: dayExpenses,
      revenue,
      expenseTotal,
      net,
      paymentBreakdown: payments,
      paymentLabel: (method) => paymentLabels[method] || method,
      currency,
      isArabic,
      invoiceName: isArabic ? settings.invoiceNameAr : settings.invoiceNameEn,
      invoiceAddress: isArabic ? settings.addressAr : settings.addressEn,
      invoicePhone: settings.phone,
      logoUrl: settings.invoiceLogo,
    })) as { skipped?: boolean; reason?: string }
    if (result?.skipped) {
      setMessage(result.reason || (isArabic ? 'لم يتم إرسال تقفيل الوردية لأن الطابعة غير مكتملة الإعداد.' : 'Shift closing report was not sent because the printer is not fully configured.'))
      return
    }
    setMessage(isArabic ? 'تم إرسال تقفيل الوردية إلى طابعة الكاشير.' : 'Shift closing sent to the cashier printer.')
  } catch (error) {
    setMessage(error instanceof Error ? error.message : (isArabic ? 'تعذر طباعة تقفيل الوردية.' : 'Could not print the shift closing.'))
  }
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex justify-between ${strong ? 'text-lg font-bold' : ''}`}><span>{label}</span><span>{value}</span></div>
}

function Field({ id, label, value, onChange, type = 'text' }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}
