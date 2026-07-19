'use client'

import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { Search, Printer, X, Wallet, User, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN } from '@/lib/constants'
import { TrackedOrder, PaymentStatus } from '@/lib/order-tracking'
import { useAppStore } from '@/lib/app-store'
import { printerManager, syncPrinterManagerSettings } from '@/lib/printer'
import { createDriverClosingReceiptPayload, getDriverClosingAmount, getDriverClosingGroups, DriverClosingGroup, isDriverSettlementEligible } from '@/lib/driver-closing-print'
import { getShiftSessionDateRange, type ShiftSession } from '@/lib/pos-day-session'
import useShiftSession from '@/lib/use-shift-session'
import { readClosings } from '@/lib/closings'

function getDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

function isOrderWithinRange(orderDate: string | undefined, start: string, end: string) {
  const startDate = new Date(start.includes('T') ? start : `${start}T00:00:00`)
  const endDate = new Date(end.includes('T') ? end : `${end}T23:59:59.999`)
  const checkDate = new Date(orderDate || '')
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || Number.isNaN(checkDate.getTime())) {
    return false
  }
  return checkDate.getTime() >= startDate.getTime() && checkDate.getTime() <= endDate.getTime()
}

function getDateRangeFromInputs(startValue: string, endValue: string, fallbackStart: string, fallbackEnd: string) {
  const startDate = new Date(`${startValue}T00:00:00`)
  const endDate = new Date(`${endValue}T23:59:59.999`)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { start: fallbackStart, end: fallbackEnd }
  }
  if (startDate.getTime() <= endDate.getTime()) {
    return { start: startDate.toISOString(), end: endDate.toISOString() }
  }
  return { start: endDate.toISOString(), end: startDate.toISOString() }
}

export default function DriverClosingPage() {
  const { language } = useLanguage()
  const isArabic = language === 'ar'
  const settings = useAppStore((state) => state.settings)
  const [orders, setOrders] = useState<TrackedOrder[]>([])
  const currency = isArabic ? CURRENCY : CURRENCY_EN

  const [search, setSearch] = useState('')
  const [modalSearch, setModalSearch] = useState('')
  const [selectedGroup, setSelectedGroup] = useState<DriverClosingGroup | null>(null)
  const [settlingOrderId, setSettlingOrderId] = useState<string | null>(null)
  const [collectedOrderIds, setCollectedOrderIds] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [modalRangeStart, setModalRangeStart] = useState('')
  const [modalRangeEnd, setModalRangeEnd] = useState('')
  const [daySession, setDaySession] = useShiftSession()
  const loadingRef = useRef(false)
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())

  const loadOrders = useCallback(async (active: boolean, shiftId?: string) => {
    try {
      if (loadingRef.current) return
      loadingRef.current = true
      const url = `/api/pos/orders?limit=200${shiftId ? `&shiftId=${encodeURIComponent(shiftId)}` : ''}`
      const response = await fetch(url, { cache: 'no-store' })
      const data = await response.json()
      if (active && Array.isArray(data.orders)) {
        setOrders(data.orders)
      }
    } catch {
      if (active) setOrders([]) // Keep existing orders on fetch error
    }
    loadingRef.current = false
  }, [])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      void loadOrders(active, daySession.shiftId)
    }, 0)
    const interval = window.setInterval(() => {
      void loadOrders(active, daySession.shiftId)
    }, 60000)
    return () => {
      active = false
      window.clearTimeout(timer)
      window.clearInterval(interval)
    }
  }, [loadOrders, daySession.shiftId])

  // daySession is kept in sync via `useShiftSession` hook

  const sessionRange = useMemo(() => getShiftSessionDateRange(daySession), [daySession])
  const visibleRangeStart = rangeStart || sessionRange.start.slice(0, 10)
  const visibleRangeEnd = rangeEnd || sessionRange.end.slice(0, 10)
  const selectedRange = useMemo(() => getDateRangeFromInputs(visibleRangeStart, visibleRangeEnd, sessionRange.start, sessionRange.end), [sessionRange.end, sessionRange.start, visibleRangeEnd, visibleRangeStart])
  const previousClosings = useMemo(() => readClosings(), [daySession])
  const settledOrderIds = useMemo(() => new Set(previousClosings.flatMap((closing) => closing.orders?.map((order) => order.id) || [])), [previousClosings])

  const visibleOrders = useMemo(() => {
    return orders.filter((order) => {
      if (settledOrderIds.has(order.id) || order.status === 'cancelled') return false

      const matchesShift = daySession.shiftId ? order.shiftId === daySession.shiftId : false
      const legacyWithinShiftWindow = !order.shiftId && isOrderWithinRange(order.createdAt, sessionRange.start, sessionRange.end)
      const inShiftScope = matchesShift || legacyWithinShiftWindow
      const inSelectedRange = isOrderWithinRange(order.createdAt, selectedRange.start, selectedRange.end)

      return inShiftScope && inSelectedRange
    })
  }, [daySession.shiftId, orders, selectedRange.end, selectedRange.start, sessionRange.end, sessionRange.start, settledOrderIds])

  const driverGroups = useMemo(() => {
    const groups = getDriverClosingGroups(visibleOrders)
    const term = search.trim().toLowerCase()
    if (!term) return groups
    return groups.filter((group) => group.name.toLowerCase().includes(term) || group.phone.toLowerCase().includes(term))
  }, [search, visibleOrders]);

  const openDriverModal = (group: DriverClosingGroup) => {
    setSelectedGroup(group)
    setModalSearch('')
    setModalRangeStart(visibleRangeStart)
    setModalRangeEnd(visibleRangeEnd)
    setExpandedOrders(new Set())
  }

  function orderDriverKey(order: TrackedOrder) {
    return ((order.driver?.email || order.driver?.phone || order.driver?.name || 'driver') as string).trim().toLowerCase()
  }


  const handleSettle = async (order: TrackedOrder) => {
    setSettlingOrderId(order.id)
    setMessage('')
    try {
      const response = await fetch('/api/pos/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, paymentStatus: 'paid' }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || data.error || (isArabic ? 'فشل تحصيل الطلب' : 'Failed to collect order'))

      // update local orders state (ensure payment.method is defined to satisfy TrackedOrder type)
      setOrders((current) => current.map(o => o.id === order.id ? { ...o, payment: { ...(o.payment || { method: 'cash', status: 'cash_on_delivery' }), status: 'paid' } } : o))
      setCollectedOrderIds(prev => new Set(prev).add(order.id))
      setMessage(isArabic ? 'تم تحصيل الطلب بنجاح' : 'Order collected successfully')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (isArabic ? 'حدث خطأ' : 'Error occurred'))
    } finally {
      setSettlingOrderId(null)
    }
  }

  const handlePrint = async (order: TrackedOrder) => {
    try {
      syncPrinterManagerSettings(settings.printers)
      const payload = createDriverClosingReceiptPayload({
        title: isArabic ? `إيصال طلب - ${order.customer}` : `Order Receipt - ${order.customer}`,
        dateLabel: new Date().toLocaleDateString(isArabic ? 'ar' : 'en-US'),
        orders: [order],
        currency,
        isArabic,
        singleOrderMode: true,
      })
      await printerManager.printCashierReceipt(payload)
      setMessage(isArabic ? 'تم طباعة الفاتورة' : 'Receipt printed')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (isArabic ? 'فشلت الطباعة' : 'Print failed'))
    }
  }
  
  const modalDateRange = useMemo(() => {
    const effectiveStart = modalRangeStart || sessionRange.start.slice(0, 10)
    const effectiveEnd = modalRangeEnd || sessionRange.end.slice(0, 10)
    const start = new Date(`${effectiveStart}T00:00:00`)
    const end = new Date(`${effectiveEnd}T23:59:59.999`)
    if (start > end) return { start: end.toISOString(), end: start.toISOString() }
    return { start: start.toISOString(), end: end.toISOString() }
  }, [modalRangeEnd, modalRangeStart, sessionRange.end, sessionRange.start])

  const filteredModalOrders = useMemo(() => {
    if (!selectedGroup) return []
    const term = modalSearch.trim().toLowerCase()
    const dateFiltered = visibleOrders.filter((order) => orderDriverKey(order) === selectedGroup.key && isOrderWithinRange(order.createdAt, modalDateRange.start, modalDateRange.end) && order.status !== 'cancelled')
    if (!term) return dateFiltered
    return dateFiltered.filter((order) => `${order.customer} ${order.phone} ${order.externalReference} ${order.id}`.toLowerCase().includes(term))
  }, [modalDateRange.end, modalDateRange.start, modalSearch, selectedGroup, visibleOrders])

  const paymentStatusLabel = (status?: string) => {
    const labels: Record<string, string> = isArabic
      ? {
          cash_on_delivery: 'الدفع عند الاستلام',
          receipt_uploaded: 'إيصال مرفوع',
          paid: 'مدفوع',
          pending: 'قيد المراجعة',
          rejected: 'مرفوض',
        }
      : {
          cash_on_delivery: 'Cash on delivery',
          receipt_uploaded: 'Receipt uploaded',
          paid: 'Paid',
          pending: 'Pending review',
          rejected: 'Rejected',
        }
    return labels[status || ''] || status || (isArabic ? 'غير محدد' : 'Not specified')
  }

  const updatePaymentStatus = async (orderId: string, newStatus: PaymentStatus) => {
    setMessage('')
    try {
      const response = await fetch('/api/pos/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, paymentStatus: newStatus }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || data.error || (isArabic ? 'تعذر تحديث حالة الدفع.' : 'Could not update payment status'))
      // update local orders state (ensure payment.method is defined)
      setOrders((current) => current.map(o => o.id === orderId ? { ...o, payment: { ...(o.payment || { method: 'cash', status: 'cash_on_delivery' }), status: newStatus } } : o))
      setMessage(isArabic ? 'تم تحديث حالة الدفع.' : 'Payment status updated.')
      setTimeout(() => setMessage(''), 2500)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (isArabic ? 'حدث خطأ' : 'Error occurred'))
    }
  }

  const paymentStatuses: PaymentStatus[] = ['cash_on_delivery', 'paid', 'receipt_uploaded', 'pending', 'rejected'];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold">{isArabic ? 'تقفيل السائقين' : 'Driver Settlement'}</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {isArabic ? 'تسوية حسابات السائقين والتحصيل من الطلبات المسلمة' : 'Settle driver accounts and collect delivery payments'}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {daySession.isOpen ? (isArabic ? `الوردية الحالية مفتوحة منذ ${new Date(daySession.openedAt).toLocaleString()}` : `Current shift is open since ${new Date(daySession.openedAt).toLocaleString()}`) : (isArabic ? 'الوردية الحالية مغلقة' : 'Current shift is closed')}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            {daySession.isOpen ? (isArabic ? 'الوردية مفتوحة حاليًا' : 'Shift currently open') : (isArabic ? 'الوردية مغلقة حاليًا' : 'Shift currently closed')}
          </div>
        </div>
      </div>

      {message && (
        <div className={`rounded-md p-3 text-sm ${message.includes('بنجاح') || message.includes('successfully') ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'}`}>
          {message}
        </div>
      )}

      {/* Date Range Filter */}
      <div className="grid gap-4 rounded-md border p-4 dark:border-slate-800 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm font-medium">{isArabic ? 'من تاريخ' : 'From Date'}</span>
          <Input type="date" value={visibleRangeStart} onChange={(e) => setRangeStart(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">{isArabic ? 'إلى تاريخ' : 'To Date'}</span>
          <Input type="date" value={visibleRangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
        </label>
      </div>
      {/* Search */}
      <div className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isArabic ? 'بحث باسم السائق أو رقم هاتفه' : 'Search by driver name or phone'}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      {/* Orders Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {driverGroups.length === 0 ? (
          <p className="py-10 text-center text-slate-500 md:col-span-2 lg:col-span-3" >
            {isArabic ? 'لا توجد طلبات مؤهلة للتحصيل' : 'No eligible orders for collection'}
          </p>
        ) : (
          driverGroups.map((group) => (
            <Card
              key={group.key}
              className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
              onClick={() => openDriverModal(group)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                    <User className="h-6 w-6 text-slate-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-lg">{group.name}</p>
                    <p className="text-sm text-slate-500">{group.phone}</p>
                  </div>
                </div>
                {(() => {
                  // compute uncollected amount for this driver (cash_on_delivery orders)
                  const uncollected = group.orders.reduce((sum, o) => (String(o.payment?.status || '').toLowerCase() === 'cash_on_delivery' ? sum + getDriverClosingAmount(o) : sum), 0)
                  return (
                    <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                      <div className="rounded-md bg-slate-50 p-2 dark:bg-slate-900">
                        <p className="text-xs text-slate-500">{isArabic ? 'إجمالي التحصيل' : 'Total Collection'}</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200">{group.total.toFixed(2)} {currency}</p>
                      </div>
                      <div className="rounded-md bg-slate-50 p-2 dark:bg-slate-900">
                        <p className="text-xs text-slate-500">{isArabic ? 'المتبقي تحصيله' : 'Remaining to Collect'}</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200">{uncollected.toFixed(2)} {currency}</p>
                      </div>
                      <div className="rounded-md bg-slate-50 p-2 dark:bg-slate-900">
                        <p className="text-xs text-slate-500">{isArabic ? 'عدد الطلبات' : 'Orders Count'}</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200">{group.orders.length}</p>
                      </div>
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Driver Detail Modal */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{selectedGroup.name}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedGroup(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6 flex-1 overflow-y-auto">
              {/* Summary */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-900">
                  <p className="text-xs text-slate-600 dark:text-slate-400">{isArabic ? 'إجمالي التحصيل (صافي الطلبات)' : 'Total Collection (Net Orders)'}</p>
                  <p className="text-lg font-semibold">{filteredModalOrders.reduce((sum, o) => isDriverSettlementEligible(o) ? sum + getDriverClosingAmount(o) : sum, 0).toFixed(2)} {currency}</p>
                </div>
                <div className="rounded-lg bg-yellow-100 p-3 dark:bg-yellow-900">
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">{isArabic ? 'المتبقي لتحصيله' : 'Remaining to Collect'}</p>
                  <p className="text-lg font-semibold">{filteredModalOrders.reduce((sum, o) => (String(o.payment?.status || '').toLowerCase() === 'cash_on_delivery' ? sum + getDriverClosingAmount(o) : sum), 0).toFixed(2)} {currency}</p>
                </div>
                <div className="rounded-lg bg-blue-100 p-3 dark:bg-blue-900">
                  <p className="text-xs text-blue-600 dark:text-blue-400">{isArabic ? 'إجمالي رسوم التوصيل' : 'Total Delivery Fees'}</p>
                  <p className="text-lg font-semibold">{filteredModalOrders.reduce((sum, o) => sum + Number(o.deliveryFee || 0), 0).toFixed(2)} {currency}</p>
                </div>
              </div>
              {/* Modal Date Range Filter */}
              <div className="grid gap-4 rounded-md border p-4 dark:border-slate-700 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm font-medium">{isArabic ? 'عرض الطلبات من' : 'Show orders from'}</span>
                  <Input type="date" value={modalRangeStart || sessionRange.start.slice(0, 10)} onChange={(e) => setModalRangeStart(e.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium">{isArabic ? 'إلى' : 'To'}</span>
                  <Input type="date" value={modalRangeEnd || sessionRange.end.slice(0, 10)} onChange={(e) => setModalRangeEnd(e.target.value)} />
                </label>
              </div>

              {/* Search within modal */}
              <div className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-950">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder={isArabic ? 'بحث باسم العميل أو رقم الهاتف أو الفاتورة' : 'Search customer, phone, or invoice'}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </div>

              {/* Orders List */}
              <div className="space-y-3">
                {filteredModalOrders.length === 0 ? (
                  <p className="py-6 text-center text-slate-500">{isArabic ? 'لا توجد طلبات مطابقة للبحث' : 'No matching orders found'}</p>
                ) : (
                  filteredModalOrders.map((order) => (
                    <div key={order.id} className="rounded-lg border bg-white dark:bg-slate-950 dark:border-slate-800">
                      <div className="p-4">
                        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                          <div className="space-y-1">
                            <p className="font-semibold text-base">{order.customer || order.id}</p>
                            <p className="text-sm text-slate-500">{order.phone || (isArabic ? 'لا يوجد رقم' : 'No phone')}</p>
                            <p className="text-xs text-slate-500">{order.createdAt ? new Date(order.createdAt).toLocaleString(isArabic ? 'ar-EG' : 'en-US') : ''}</p>
                            <p className="text-xs text-slate-500">{isArabic ? 'فاتورة' : 'Invoice'}: {order.externalReference || order.id.slice(0, 8)}</p>
                          </div>
                          <div className="space-y-1.5 text-sm md:text-right">
                            <p><span className="font-medium text-slate-600 dark:text-slate-400">{isArabic ? 'التحصيل' : 'Collect'}:</span> <span className="font-bold">{getDriverClosingAmount(order).toFixed(2)} {currency}</span></p>
                            <p><span className="font-medium text-slate-600 dark:text-slate-400">{isArabic ? 'التوصيل' : 'Fee'}:</span> {Number(order.deliveryFee || 0).toFixed(2)} {currency}</p>
                            <p><span className="font-bold text-slate-800 dark:text-slate-200">{isArabic ? 'الإجمالي' : 'Total'}:</span> <span className="font-extrabold text-base">{Number(order.total || 0).toFixed(2)} {currency}</span></p>
                          </div>
                        </div>
                      </div>
                      
                      {expandedOrders.has(order.id) && (
                        <div className="border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                            <ShoppingBag className="h-4 w-4" />
                            {isArabic ? 'المنتجات' : 'Items'}
                          </h4>
                          <div className="space-y-2">
                            {(order.lines && order.lines.length > 0) ? order.lines.map((item, index) => (
                              <div key={index} className="flex justify-between text-sm">
                                <div>
                                  <span className="font-medium">{item.name}</span>
                                  <span className="text-slate-500"> x {item.quantity}</span>
                                </div>
                                <div className="font-mono">{(item.price || 0).toFixed(2)} {currency}</div>
                              </div>
                            )) : <p className="text-sm text-slate-500">{isArabic ? 'لا توجد تفاصيل منتجات لهذا الطلب' : 'No item details for this order'}</p>}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 border-t p-3 dark:border-slate-800">
                        {isDriverSettlementEligible(order) && order.payment?.status !== 'paid' && !collectedOrderIds.has(order.id) ? (
                          <Button
                            size="sm"
                            className="flex-grow gap-2 bg-green-600 hover:bg-green-700"
                            onClick={() => handleSettle(order)}
                            disabled={settlingOrderId === order.id}
                          >
                            {settlingOrderId === order.id ? (
                              <>{isArabic ? 'جاري التحصيل...' : 'Collecting...'}</>
                            ) : (
                              <>
                                <Wallet className="h-4 w-4" />
                                {isArabic ? 'تحصيل' : 'Collect'}
                              </>
                            )}
                          </Button>
                        ) : (
                          <div className="flex flex-wrap gap-2 flex-grow">
                            {paymentStatuses.map(status => (
                                <Button
                                  key={status}
                                  size="sm"
                                  variant={order.payment?.status === status ? 'default' : 'outline'}
                                  onClick={() => updatePaymentStatus(order.id, status)}
                                  className="text-xs px-2 py-1 h-auto"
                                >
                                  {paymentStatusLabel(status)}
                                </Button>
                            ))}
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-grow gap-2"
                          onClick={() => handlePrint(order)}
                        >
                          <Printer className="h-4 w-4" />
                          {isArabic ? 'طباعة' : 'Print'}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
