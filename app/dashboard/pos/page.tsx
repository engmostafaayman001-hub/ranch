'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Printer, Minus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_LABELS_EN } from '@/lib/constants'
import { MenuProduct, useAppStore } from '@/lib/app-store'
import { isDisplayableImage } from '@/lib/client-images'
import { qrImage } from '@/lib/order-print'
import { TrackedOrder } from '@/lib/order-tracking'
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
  const { products, settings } = useAppStore()
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
  const [customer, setCustomer] = useState({
    name: isArabic ? 'عميل مطعم' : 'Restaurant Customer',
    phone: '',
    deliveryAddress: '',
    notes: '',
  })

  const methodLabels = isArabic ? PAYMENT_METHOD_LABELS : PAYMENT_METHOD_LABELS_EN
  const orderTypeLabel = ORDER_TYPE_LABELS[orderType][isArabic ? 'ar' : 'en']
  const orderAddress = orderType === 'delivery' && customer.deliveryAddress.trim()
    ? `${orderTypeLabel} - ${customer.deliveryAddress.trim()}`
    : orderTypeLabel

  const filteredProducts = products.filter((product) => {
    if (!product.available) return false
    const term = search.trim().toLowerCase()
    if (!term) return true
    return `${product.nameAr} ${product.nameEn}`.toLowerCase().includes(term)
  })

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
      try {
        const [ordersResponse, expensesResponse] = await Promise.all([
          fetch('/api/pos/orders', { cache: 'no-store' }),
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
      }
    }

    loadDailyClosingData()
    const interval = window.setInterval(loadDailyClosingData, 15000)
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
          paymentStatus: paymentMethod === PAYMENT_METHODS.CASH ? 'cash_on_delivery' : 'paid',
          status: 'received',
          estimatedDelivery: orderTypeLabel,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || data.error || 'Could not create sale')
      setMessage(isArabic ? `تم البيع وإنشاء الطلب: ${data.order?.id || ''}` : `Sale completed and order created: ${data.order?.id || ''}`)
      const printer = settings.printers.cashier
      printReceipt({
        orderId: data.order?.id || '',
        sale: saleSnapshot,
        isArabic,
        currency,
        paymentMethod: methodLabels[paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] || paymentMethod,
        printerMethod: printerMethodLabel(printer.method, isArabic),
        printerName: printer.name,
        paperWidth: printer.paperWidth || '80mm',
        invoiceName: isArabic ? settings.invoiceNameAr : settings.invoiceNameEn,
        invoiceQrUrl: settings.invoiceQrUrl,
        invoiceMessage: isArabic ? settings.invoiceWelcomeAr : settings.invoiceWelcomeEn,
        printsQr: printer.printsQr,
      })
      setLines([])
      setDiscountCode('')
      setDiscountAmount(0)
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
        <Button type="button" variant="outline" className="gap-2" onClick={() => printPosDailyClosing({ orders: dailyOrders, expenses: dailyExpenses, isArabic, currency, paymentLabels: methodLabels })}>
          <Printer className="h-4 w-4" />
          {isArabic ? 'طباعة تقفيل اليوم' : 'Print Daily Closing'}
        </Button>
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{isArabic ? 'فاتورة البيع' : 'Sale Ticket'}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="customer" label={isArabic ? 'اسم العميل' : 'Customer'} value={customer.name} onChange={(value) => setCustomer({ ...customer, name: value })} />
              <Field id="phone" label={isArabic ? 'الهاتف' : 'Phone'} value={customer.phone} onChange={(value) => setCustomer({ ...customer, phone: value })} />
            </div>

            <div>
              <Label htmlFor="order-type">{isArabic ? 'نوع الطلب' : 'Order type'}</Label>
              <select id="order-type" value={orderType} onChange={(event) => setOrderType(event.target.value as PosOrderType)} className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950">
                {(Object.keys(ORDER_TYPE_LABELS) as PosOrderType[]).map((type) => (
                  <option key={type} value={type}>{ORDER_TYPE_LABELS[type][isArabic ? 'ar' : 'en']}</option>
                ))}
              </select>
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
              <Label htmlFor="payment-method">{isArabic ? 'طريقة الدفع' : 'Payment method'}</Label>
              <select id="payment-method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950">
                {Object.values(PAYMENT_METHODS).map((method) => (
                  <option key={method} value={method}>{methodLabels[method as keyof typeof PAYMENT_METHOD_LABELS]}</option>
                ))}
              </select>
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
    </div>
  )
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function printPosDailyClosing({
  orders,
  expenses,
  isArabic,
  currency,
  paymentLabels,
}: {
  orders: TrackedOrder[]
  expenses: Expense[]
  isArabic: boolean
  currency: string
  paymentLabels: Record<string, string>
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
  const title = isArabic ? 'تقفيل يومي - نقطة البيع' : 'Daily Closing - POS'
  const money = (value: number) => `${Number(value || 0).toFixed(2)} ${currency}`
  const paymentRows = Object.entries(payments).map(([method, total]) => `
    <div class="line"><span>${escapeHtml(paymentLabels[method] || method)}</span><strong>${money(total)}</strong></div>
  `).join('')
  const expenseRows = dayExpenses.map((expense) => `
    <div class="line"><span>${escapeHtml(expense.name)}</span><strong>${money(Number(expense.amount || 0))}</strong></div>
  `).join('')
  const orderRows = dayOrders.map((order) => `
    <tr>
      <td>${escapeHtml(order.id)}</td>
      <td>${escapeHtml(order.customer || '-')}</td>
      <td>${escapeHtml(paymentLabels[order.payment?.method || 'cash'] || order.payment?.method || 'cash')}</td>
      <td>${money(Number(order.total || 0))}</td>
    </tr>
  `).join('')
  const printWindow = window.open('', '_blank', 'width=720,height=860')
  if (!printWindow) return
  printWindow.document.write(`
    <!doctype html>
    <html dir="${isArabic ? 'rtl' : 'ltr'}" lang="${isArabic ? 'ar' : 'en'}">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 20px; font-family: Arial, sans-serif; color: #111827; background: #fff; }
          h1 { margin: 0; font-size: 24px; }
          h2 { font-size: 16px; margin: 0 0 8px; }
          .muted { color: #64748b; font-size: 12px; }
          .header { border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 14px; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 14px 0; }
          .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; margin-top: 10px; }
          .label { color: #64748b; font-size: 12px; }
          .value { margin-top: 5px; font-size: 18px; font-weight: 800; }
          .line { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid #eef2f7; padding: 7px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th, td { border-bottom: 1px solid #e5e7eb; padding: 7px; text-align: ${isArabic ? 'right' : 'left'}; }
          @media print { body { padding: 10mm; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${escapeHtml(title)}</h1>
          <p class="muted">${new Date().toLocaleString(isArabic ? 'ar-EG' : 'en-US')}</p>
        </div>
        <div class="grid">
          <div class="box"><div class="label">${isArabic ? 'إجمالي المبيعات' : 'Sales total'}</div><div class="value">${money(revenue)}</div></div>
          <div class="box"><div class="label">${isArabic ? 'المصروفات' : 'Expenses'}</div><div class="value">${money(expenseTotal)}</div></div>
          <div class="box"><div class="label">${isArabic ? 'الصافي' : 'Net'}</div><div class="value">${money(net)}</div></div>
        </div>
        <div class="box"><h2>${isArabic ? 'طرق الدفع' : 'Payment methods'}</h2>${paymentRows || `<p class="muted">${isArabic ? 'لا توجد مدفوعات.' : 'No payments.'}</p>`}</div>
        <div class="box"><h2>${isArabic ? 'المصروفات' : 'Expenses'}</h2>${expenseRows || `<p class="muted">${isArabic ? 'لا توجد مصروفات.' : 'No expenses.'}</p>`}</div>
        <div class="box">
          <h2>${isArabic ? 'طلبات اليوم' : 'Today orders'}</h2>
          <table>
            <thead><tr><th>${isArabic ? 'الطلب' : 'Order'}</th><th>${isArabic ? 'العميل' : 'Customer'}</th><th>${isArabic ? 'الدفع' : 'Payment'}</th><th>${isArabic ? 'الإجمالي' : 'Total'}</th></tr></thead>
            <tbody>${orderRows}</tbody>
          </table>
        </div>
        <script>
          window.onload = () => {
            window.print();
            setTimeout(() => window.close(), 500);
          };
        </script>
      </body>
    </html>
  `)
  printWindow.document.close()
}

function printReceipt(options: {
  orderId: string
  sale: {
    customer: { name: string; phone: string; address: string; notes: string }
    orderType: string
    items: { name: string; quantity: number; price: number }[]
    subtotal: number
    tax: number
    discountAmount: number
    total: number
  }
  isArabic: boolean
  currency: string
  paymentMethod: string
  printerMethod: string
  printerName: string
  paperWidth: string
  invoiceName: string
  invoiceQrUrl: string
  invoiceMessage: string
  printsQr: boolean
}) {
  const { orderId, sale, isArabic, currency, paymentMethod, printerMethod, printerName, invoiceName, invoiceQrUrl, invoiceMessage, printsQr } = options
  const direction = isArabic ? 'rtl' : 'ltr'
  const width = options.paperWidth === '58mm' ? '58mm' : '80mm'
  const qrSrc = printsQr ? qrImage(invoiceQrUrl) : ''
  const rows = sale.items.map((item) => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${item.quantity}</td>
      <td>${item.price.toFixed(2)} ${currency}</td>
      <td>${(item.price * item.quantity).toFixed(2)} ${currency}</td>
    </tr>
  `).join('')
  const notes = sale.customer.notes
    ? `<div class="note"><strong>${isArabic ? 'الملاحظات' : 'Notes'}:</strong> ${escapeHtml(sale.customer.notes)}</div>`
    : ''
  const receiptWindow = window.open('', '_blank', 'width=420,height=720')
  if (!receiptWindow) return
  receiptWindow.document.write(`
    <!doctype html>
    <html dir="${direction}" lang="${isArabic ? 'ar' : 'en'}">
      <head>
        <meta charset="utf-8" />
        <title>${isArabic ? 'فاتورة بيع' : 'Sale Receipt'} ${escapeHtml(orderId)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 18px; color: #111827; background: #fff; }
          .receipt { max-width: ${width}; margin: 0 auto; }
          .brand { text-align: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 10px; margin-bottom: 10px; }
          h1 { margin: 0 0 4px; font-size: 22px; text-align: center; }
          .muted { color: #64748b; font-size: 12px; text-align: center; margin-bottom: 14px; }
          .meta, .totals, .note { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin: 10px 0; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 7px 4px; text-align: ${isArabic ? 'right' : 'left'}; }
          .line { display: flex; justify-content: space-between; gap: 12px; margin: 6px 0; }
          .total { font-weight: 800; font-size: 16px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
          .qr { display: flex; justify-content: center; margin: 12px 0 6px; }
          .qr img { width: 100px; height: 100px; }
          .message { border-top: 1px dashed #cbd5e1; margin-top: 12px; padding-top: 10px; text-align: center; font-size: 12px; color: #334155; }
          @media print { @page { size: ${width} auto; margin: 4mm; } body { padding: 0; } .receipt { max-width: none; } }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="brand">
            <h1>${escapeHtml(invoiceName || (isArabic ? 'فاتورة بيع' : 'Sale Receipt'))}</h1>
            <div class="muted">${isArabic ? 'فاتورة بيع' : 'Sale Receipt'}</div>
          </div>
          <div class="muted">${escapeHtml(orderId)} - ${new Date().toLocaleString(isArabic ? 'ar-EG' : 'en-US')}</div>
          <div class="meta">
            <div>${isArabic ? 'العميل' : 'Customer'}: ${escapeHtml(sale.customer.name || '-')}</div>
            <div>${isArabic ? 'الهاتف' : 'Phone'}: ${escapeHtml(sale.customer.phone || '-')}</div>
            <div>${isArabic ? 'نوع الطلب' : 'Order type'}: ${escapeHtml(sale.orderType)}</div>
            <div>${isArabic ? 'المكان' : 'Place'}: ${escapeHtml(sale.customer.address || '-')}</div>
            <div>${isArabic ? 'الدفع' : 'Payment'}: ${escapeHtml(paymentMethod)}</div>
          </div>
          ${notes}
          <table>
            <thead>
              <tr>
                <th>${isArabic ? 'الصنف' : 'Item'}</th>
                <th>${isArabic ? 'كمية' : 'Qty'}</th>
                <th>${isArabic ? 'سعر' : 'Price'}</th>
                <th>${isArabic ? 'إجمالي' : 'Total'}</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="totals">
            <div class="line"><span>${isArabic ? 'المجموع' : 'Subtotal'}</span><span>${sale.subtotal.toFixed(2)} ${currency}</span></div>
            <div class="line"><span>${isArabic ? 'الضريبة' : 'Tax'}</span><span>${sale.tax.toFixed(2)} ${currency}</span></div>
            <div class="line"><span>${isArabic ? 'الخصم' : 'Discount'}</span><span>-${sale.discountAmount.toFixed(2)} ${currency}</span></div>
            <div class="line total"><span>${isArabic ? 'الإجمالي' : 'Total'}</span><span>${sale.total.toFixed(2)} ${currency}</span></div>
          </div>
          ${qrSrc ? `<div class="qr"><img src="${qrSrc}" alt="QR" /></div>` : ''}
          ${invoiceMessage ? `<div class="message">${escapeHtml(invoiceMessage)}</div>` : ''}
          <div class="muted">${escapeHtml(printerName || '')}${printerName ? ' - ' : ''}${isArabic ? 'طريقة الطباعة' : 'Printer method'}: ${escapeHtml(printerMethod)}</div>
        </div>
        <script>
          window.onload = () => {
            window.print();
            setTimeout(() => window.close(), 500);
          };
        </script>
      </body>
    </html>
  `)
  receiptWindow.document.close()
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex justify-between ${strong ? 'text-lg font-bold' : ''}`}><span>{label}</span><span>{value}</span></div>
}

function printerMethodLabel(method: string | undefined, isArabic: boolean) {
  const labels: Record<string, { ar: string; en: string }> = {
    browser: { ar: 'طباعة المتصفح', en: 'Browser print' },
    usb: { ar: 'USB', en: 'USB' },
    bluetooth: { ar: 'Bluetooth', en: 'Bluetooth' },
    network: { ar: 'شبكة / IP', en: 'Network / IP' },
  }
  return labels[method || 'browser']?.[isArabic ? 'ar' : 'en'] || method || labels.browser[isArabic ? 'ar' : 'en']
}

function Field({ id, label, value, onChange, type = 'text' }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}
