'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Banknote, Bike, CreditCard, Printer, Minus, Plus, Search, ShoppingCart, Smartphone, Store, Trash2, Truck, Utensils, X } from 'lucide-react'
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
import { useSharedAppData } from '@/lib/use-shared-app-data'

type PosLine = {
  productId: string
  quantity: number
}

type PosOrderType = 'dine_in' | 'delivery' | 'takeaway'

type Expense = {
  id: string
  name: string
  amount: number
  date: string
  note: string
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

export default function DashboardPosPage() {
  useSharedAppData()
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const { categories, products, drivers, settings } = useAppStore()
  const [lines, setLines] = useState<PosLine[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [discountCode, setDiscountCode] = useState('')
  const [discountAmount, setDiscountAmount] = useState(0)
  const [dailyOrders, setDailyOrders] = useState<TrackedOrder[]>([])
  const [dailyExpenses, setDailyExpenses] = useState<Expense[]>([])
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS.CASH)
  const [orderType, setOrderType] = useState<PosOrderType>('dine_in')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [savedCustomers, setSavedCustomers] = useState<PosCustomer[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerResults, setShowCustomerResults] = useState(false)
  const [driverClosingOpen, setDriverClosingOpen] = useState(false)
  const loadingDailyClosing = useRef(false)
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
  const todayDriverClosingOrders = useMemo(() => {
    const today = new Date()
    const start = new Date(today)
    start.setHours(0, 0, 0, 0)
    const end = new Date(today)
    end.setHours(23, 59, 59, 999)
    return dailyOrders.filter((order) => {
      const date = new Date(order.createdAt || '')
      return !Number.isNaN(date.getTime()) && date.getTime() >= start.getTime() && date.getTime() <= end.getTime()
    })
  }, [dailyOrders])
  const driverClosingGroups = useMemo(() => getDriverClosingGroups(todayDriverClosingOrders), [todayDriverClosingOrders])
  const driverClosingTotal = useMemo(() => driverClosingGroups.reduce((sum, group) => sum + group.total, 0), [driverClosingGroups])
  const driverClosingOrderCount = useMemo(() => driverClosingGroups.reduce((sum, group) => sum + group.orders.length, 0), [driverClosingGroups])
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
  const total = Math.max(0, subtotal + tax - discountAmount)

  useEffect(() => {
    let active = true
    const loadDailyClosingData = async () => {
      if (loadingDailyClosing.current) return
      loadingDailyClosing.current = true
      try {
        const [ordersResponse, expensesResponse] = await Promise.all([
          fetch('/api/pos/orders?source=restaurant_pos&limit=300', { cache: 'no-store' }),
          fetch('/api/expenses', { cache: 'no-store' }),
        ])
        const ordersData = await ordersResponse.json().catch(() => ({}))
        const expensesData = await expensesResponse.json().catch(() => ({}))
        if (!active) return
        setDailyOrders(Array.isArray(ordersData.orders) ? ordersData.orders : [])
        setDailyExpenses(Array.isArray(expensesData.expenses) ? expensesData.expenses : [])
      } catch {
        if (!active) return
        setDailyOrders([])
        setDailyExpenses([])
      } finally {
        loadingDailyClosing.current = false
      }
    }

    loadDailyClosingData()
    const interval = window.setInterval(loadDailyClosingData, 15000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
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
    const interval = window.setInterval(loadCustomers, 30000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

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
    if (type !== 'delivery') setSelectedDriverId('')
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
        })),
        subtotal,
        tax,
        discountAmount,
        total,
      }
      const response = await fetch('/api/pos/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'restaurant_pos',
          customer: { name: customer.name, phone: customer.phone, address: orderAddress, notes: customer.notes },
          driver: orderType === 'delivery' && selectedDriver
            ? { name: selectedDriver.name, email: selectedDriver.email || '', phone: selectedDriver.phone, rating: 0 }
            : undefined,
          phone: customer.phone,
          address: orderAddress,
          notes: customer.notes,
          lines: cartItems.map((item) => ({
            productId: item.product.id,
            name: isArabic ? item.product.nameAr : item.product.nameEn,
            quantity: item.quantity,
            price: item.product.price,
          })),
          items: cartItems.reduce((sum, item) => sum + item.quantity, 0),
          subtotal,
          tax,
          discountCode: discountAmount > 0 ? discountCode : undefined,
          paymentMethod,
          paymentStatus: 'paid',
          status: 'received',
          estimatedDelivery: orderTypeLabel,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || data.error || 'Could not create sale')
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
      const receiptPayload = {
        orderId: data.order?.id || '',
        orderType: orderTypeLabel,
        tableNumber: orderType === 'dine_in' ? customer.deliveryAddress || '1' : undefined,
        createdAt: data.order?.createdAt || new Date().toISOString(),
        customer: saleSnapshot.customer,
        lines: saleSnapshot.items,
        subtotal: saleSnapshot.subtotal,
        tax: saleSnapshot.tax,
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
        ...(orderType === 'dine_in' ? [printerManager.printHallTicket(receiptPayload)] : []),
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
      setLines([])
      setDiscountCode('')
      setDiscountAmount(0)
      setSelectedDriverId('')
      setCustomer((current) => ({ ...current, deliveryAddress: '', notes: '' }))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (isArabic ? 'تعذر إتمام البيع.' : 'Could not complete sale.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
        <div>
          <h2 className="text-xl font-bold">{isArabic ? 'نقطة البيع' : 'Point of Sale'}</h2>
          <p className="text-sm text-slate-500">{isArabic ? 'إتمام البيع وطباعة التقفيل اليومي من نفس الشاشة.' : 'Complete sales and print the daily closing from the same screen.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="gap-2" onClick={() => printPosDailyClosing({ orders: dailyOrders, expenses: dailyExpenses, isArabic, currency, paymentLabels: posPaymentLabels, settings, setMessage })}>
          <Printer className="h-4 w-4" />
          {isArabic ? 'طباعة تقفيل اليوم' : 'Print Daily Closing'}
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={() => setDriverClosingOpen(true)}>
            <Truck className="h-4 w-4" />
            {isArabic ? 'تقفيل السائقين' : 'Driver Closing'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
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
              <Field id="delivery-address" label={isArabic ? 'عنوان الدليفيري' : 'Delivery address'} value={customer.deliveryAddress} onChange={(value) => setCustomer({ ...customer, deliveryAddress: value })} />
            )}

            <div>
              <Label htmlFor="pos-notes">{isArabic ? 'ملاحظات الفاتورة' : 'Sale Notes'}</Label>
              <textarea
                id="pos-notes"
                value={customer.notes}
                onChange={(event) => setCustomer({ ...customer, notes: event.target.value })}
                placeholder={isArabic ? 'ملاحظة للطلب أو للمطبخ...' : 'Order or kitchen note...'}
                className="mt-1 min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-950 dark:border-slate-800 dark:bg-slate-950 dark:focus:ring-slate-300"
              />
            </div>

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
                <div key={item.productId} className="flex items-center justify-between gap-2 rounded-md border p-2 dark:border-slate-800">
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
                  const Icon = option.value === PAYMENT_METHODS.CASH ? Banknote : option.value === PAYMENT_METHODS.CARD ? CreditCard : Smartphone
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
                <p className="text-sm text-slate-500">{new Date().toLocaleDateString(isArabic ? 'ar-EG' : 'en-US')}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  className="gap-2 bg-red-600 hover:bg-red-700"
                  onClick={() => printPosDriverClosing({ orders: dailyOrders, isArabic, currency, settings, setMessage })}
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
                  {isArabic ? 'لا توجد طلبات دفع عند الاستلام معيّنة لسائقين اليوم.' : 'No assigned cash-on-delivery orders for drivers today.'}
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
                        </div>
                        <div className="text-end">
                          <p className="text-xs text-slate-500">{isArabic ? 'المبلغ المطلوب دفعه' : 'Amount to pay'}</p>
                          <p className="text-2xl font-bold text-red-600">{group.total.toFixed(2)} {currency}</p>
                        </div>
                      </div>
                      <div className="mt-3 divide-y divide-slate-100 rounded-md bg-slate-50 dark:divide-slate-800 dark:bg-slate-900">
                        {group.orders.map((order) => (
                          <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                            <span className="font-medium">{order.id} - {order.customer || '-'}</span>
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
}: {
  orders: TrackedOrder[]
  isArabic: boolean
  currency: string
  settings: AppSettings
  setMessage: (message: string) => void
}) {
  const today = new Date()
  const start = new Date(today)
  start.setHours(0, 0, 0, 0)
  const end = new Date(today)
  end.setHours(23, 59, 59, 999)
  const dayOrders = orders.filter((order) => {
    const date = new Date(order.createdAt || '')
    return !Number.isNaN(date.getTime()) && date.getTime() >= start.getTime() && date.getTime() <= end.getTime()
  })
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

async function printPosDailyClosing({
  orders,
  expenses,
  isArabic,
  currency,
  paymentLabels,
  settings,
  setMessage,
}: {
  orders: TrackedOrder[]
  expenses: Expense[]
  isArabic: boolean
  currency: string
  paymentLabels: Record<string, string>
  settings: AppSettings
  setMessage: (message: string) => void
}) {
  const today = new Date()
  const start = new Date(today)
  start.setHours(0, 0, 0, 0)
  const end = new Date(today)
  end.setHours(23, 59, 59, 999)
  const inToday = (value?: string) => {
    const date = new Date(value || '')
    if (Number.isNaN(date.getTime())) return false
    return date.getTime() >= start.getTime() && date.getTime() <= end.getTime()
  }
  const dayOrders = orders.filter((order) => order.status !== 'cancelled' && inToday(order.createdAt))
  const dayExpenses = expenses.filter((expense) => inToday(expense.date))
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
    setMessage(isArabic ? 'فعّل طابعة الكاشير من الإعدادات قبل طباعة تقفيل اليوم.' : 'Enable the cashier printer in settings before printing the daily closing.')
    return
  }

  syncPrinterManagerSettings(settings.printers)
  try {
    const result = await printerManager.printCashierReceipt(createClosingReceiptPayload({
      title: isArabic ? 'تقفيل يومي - نقطة البيع' : 'Daily Closing - POS',
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
      setMessage(result.reason || (isArabic ? 'لم يتم إرسال التقفيل لأن الطابعة غير مكتملة الإعداد.' : 'Closing report was not sent because the printer is not fully configured.'))
      return
    }
    setMessage(isArabic ? 'تم إرسال تقفيل اليوم إلى طابعة الكاشير.' : 'Daily closing sent to the cashier printer.')
  } catch (error) {
    setMessage(error instanceof Error ? error.message : (isArabic ? 'تعذر طباعة تقفيل اليوم.' : 'Could not print the daily closing.'))
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
