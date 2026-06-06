'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Banknote, CheckCircle2, CreditCard, FileText, ImageIcon, Smartphone, UploadCloud, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/logo'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN, PAYMENT_METHOD_OPTIONS, PAYMENT_METHODS, ROUTES } from '@/lib/constants'
import { useAppStore } from '@/lib/app-store'
import { PaymentStatus, TrackingStatus } from '@/lib/order-tracking'
import { useAuthStore } from '@/lib/store'
import { useSharedAppData } from '@/lib/use-shared-app-data'

export default function CheckoutPage() {
  useSharedAppData()
  const router = useRouter()
  const { language, appName } = useLanguage()
  const { user, isLoggedIn } = useAuthStore()
  const { cart, products, settings, clearCart } = useAppStore()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    notes: '',
    paymentMethod: PAYMENT_METHODS.CASH,
  })
  const [receipt, setReceipt] = useState<{ name: string; dataUrl: string; type: string; size: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [discountCode, setDiscountCode] = useState('')
  const [discountMessage, setDiscountMessage] = useState('')
  const [validatingDiscount, setValidatingDiscount] = useState(false)
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string
    discountType: 'percent' | 'fixed'
    discountValue: number
    discountAmount: number
  } | null>(null)

  useEffect(() => {
    if (!user) return
    queueMicrotask(() => {
      setFormData((current) => ({
        ...current,
        fullName: current.fullName || user.name || '',
        email: current.email || user.email || '',
      }))
    })
  }, [user])

  const cartItems = useMemo(() => cart.map((item) => {
    const product = products.find((entry) => entry.id === item.productId)
    return product ? { ...item, product } : null
  }).filter(Boolean), [cart, products])

  const subtotal = cartItems.reduce((sum, item) => sum + item!.product.price * item!.quantity, 0)
  const tax = subtotal * settings.taxRate
  const deliveryFee = subtotal > 0 ? settings.deliveryFee : 0
  const discountAmount = Math.min(subtotal, appliedDiscount?.discountAmount || 0)
  const total = Math.max(0, subtotal + tax + deliveryFee - discountAmount)
  const selectedPaymentOption = PAYMENT_METHOD_OPTIONS.find((option) => option.value === formData.paymentMethod) || PAYMENT_METHOD_OPTIONS[0]
  const requiresReceipt = selectedPaymentOption.requiresReceipt
  const paymentTransferNumber =
    formData.paymentMethod === PAYMENT_METHODS.VODAFONE_CASH
      ? settings.vodafoneCashNumber || '01090886364'
      : formData.paymentMethod === PAYMENT_METHODS.INSTAPAY
        ? settings.instapayNumber || '01090886364'
        : ''
  const receiptSizeLabel = receipt ? `${(receipt.size / 1024 / 1024).toFixed(2)} MB` : ''

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target
    setFormData({ ...formData, [name]: value })
    if (name === 'paymentMethod' && !PAYMENT_METHOD_OPTIONS.find((option) => option.value === value)?.requiresReceipt) setReceipt(null)
  }

  const selectPaymentMethod = (value: string) => {
    setFormData((current) => ({ ...current, paymentMethod: value }))
    if (!PAYMENT_METHOD_OPTIONS.find((option) => option.value === value)?.requiresReceipt) setReceipt(null)
  }

  const handleReceiptUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError(isArabic ? 'ارفع صورة أو ملف PDF للإيصال.' : 'Upload an image or PDF receipt.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError(isArabic ? 'حجم الإيصال يجب أن يكون أقل من 2 MB.' : 'Receipt must be less than 2 MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      if (!dataUrl.startsWith('data:')) {
        setReceipt(null)
        setError(isArabic ? 'تعذر قراءة ملف الإيصال.' : 'Could not read the receipt file.')
        return
      }
      setReceipt({ name: file.name, dataUrl, type: file.type, size: file.size })
      setError(null)
    }
    reader.onerror = () => setError(isArabic ? 'تعذر رفع الإيصال.' : 'Could not upload receipt.')
    reader.readAsDataURL(file)
  }

  const clearReceipt = () => {
    setReceipt(null)
    const input = document.getElementById('receipt') as HTMLInputElement | null
    if (input) input.value = ''
  }

  const readError = async (response: Response, fallback: string) => {
    const data = await response.json().catch(() => null)
    return data?.message || data?.error || fallback
  }

  const applyDiscountCode = async () => {
    const code = discountCode.trim().toUpperCase()
    setDiscountMessage('')
    setAppliedDiscount(null)

    if (!code) {
      setDiscountMessage(isArabic ? 'اكتب كود الخصم أولًا.' : 'Enter a discount code first.')
      return
    }

    if (subtotal <= 0) {
      setDiscountMessage(isArabic ? 'أضف منتجات للسلة قبل تطبيق الخصم.' : 'Add items before applying a discount.')
      return
    }

    setValidatingDiscount(true)
    try {
      const response = await fetch('/api/discounts/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.valid) throw new Error(data.reason || data.error || 'Invalid discount code')

      setAppliedDiscount({
        code: data.code,
        discountType: data.discountType,
        discountValue: Number(data.discountValue || 0),
        discountAmount: Number(data.discountAmount || 0),
      })
      setDiscountCode(data.code)
      setDiscountMessage(isArabic ? `تم تطبيق الخصم: ${Number(data.discountAmount || 0).toFixed(2)} ${currency}` : `Discount applied: ${Number(data.discountAmount || 0).toFixed(2)} ${currency}`)
    } catch (err) {
      setDiscountMessage(err instanceof Error ? err.message : (isArabic ? 'كود الخصم غير صالح.' : 'Invalid discount code.'))
    } finally {
      setValidatingDiscount(false)
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!isLoggedIn || !user?.email) {
      setError(isArabic ? 'يجب تسجيل الدخول قبل اختيار الدفع وإتمام الطلب.' : 'Please sign in before choosing payment and placing the order.')
      return
    }

    if (cartItems.length === 0) {
      setError(isArabic ? 'السلة فارغة. أضف منتجات قبل تقديم الطلب.' : 'Your cart is empty. Add products before placing an order.')
      return
    }

    if (requiresReceipt && !receipt) {
      setError(isArabic ? 'يجب رفع إيصال الدفع قبل تقديم الطلب.' : 'Payment receipt is required before placing the order.')
      return
    }

    setLoading(true)
    try {
      const now = new Date()
      const orderId = `ORD${String(now.getTime()).slice(-6)}`
      const address = `${formData.address}, ${formData.city}`
      const paymentStatus: PaymentStatus = requiresReceipt ? 'receipt_uploaded' : formData.paymentMethod === PAYMENT_METHODS.CASH ? 'cash_on_delivery' : 'pending'

      const customerResponse = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.fullName,
          email: user.email,
          phone: formData.phone,
          address,
        }),
      })
      if (!customerResponse.ok) throw new Error(await readError(customerResponse, 'Customer API failed'))

      const payload = {
        id: orderId,
        source: 'app',
        customer: formData.fullName,
        customerEmail: user.email,
        phone: formData.phone,
        address,
        notes: formData.notes,
        subtotal,
        tax,
        deliveryFee,
        discountCode: appliedDiscount?.code,
        total,
        items: cartItems.reduce((sum, item) => sum + item!.quantity, 0),
        status: 'placed' as TrackingStatus,
        createdAt: now.toISOString(),
        estimatedDelivery: isArabic ? `${settings.deliveryTime} دقيقة` : `${settings.deliveryTime} min`,
        driver: {
          name: 'Pending assignment',
          phone: '-',
          rating: 0,
        },
        payment: {
          method: formData.paymentMethod,
          status: paymentStatus,
          receiptName: receipt?.name,
          receiptDataUrl: receipt?.dataUrl,
          receiptUploadedAt: receipt ? now.toISOString() : undefined,
        },
        discount: appliedDiscount ? {
          code: appliedDiscount.code,
          type: appliedDiscount.discountType,
          value: appliedDiscount.discountValue,
          amount: discountAmount,
        } : undefined,
        lines: cartItems.map((item) => ({
          productId: item!.product.id,
          name: isArabic ? item!.product.nameAr : item!.product.nameEn,
          quantity: item!.quantity,
          price: item!.product.price,
        })),
      }

      const response = await fetch('/api/pos/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const orderData = await response.json().catch(() => null)
      if (!response.ok) throw new Error(orderData?.message || orderData?.error || 'Order API failed')

      clearCart()
      router.push(ROUTES.ORDERS)
    } catch (err) {
      const details = err instanceof Error && err.message ? ` ${err.message}` : ''
      setError(isArabic ? `تعذر استكمال الطلب.${details}` : `Could not complete the order.${details}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <nav className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <Logo size="md" />
              <span className="text-xl font-bold text-red-600">{appName}</span>
            </Link>
            <Link href={ROUTES.CART}><Button variant="ghost">{isArabic ? 'العودة للسلة' : 'Back to Cart'}</Button></Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
        <h1 className="mb-5 text-2xl font-bold sm:mb-8 sm:text-3xl">{isArabic ? 'إكمال الطلب' : 'Checkout'}</h1>

        {!isLoggedIn ? (
          <Card>
            <CardContent className="space-y-4 pt-6 text-center">
              <p className="text-slate-600 dark:text-slate-400">
                {isArabic ? 'يجب تسجيل الدخول قبل اختيار طريقة الدفع وإتمام عملية الشراء.' : 'Please sign in before choosing payment and placing your order.'}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href={`${ROUTES.LOGIN}?next=${encodeURIComponent(ROUTES.CHECKOUT)}`}>
                  <Button className="bg-red-600 hover:bg-red-700">{isArabic ? 'تسجيل الدخول' : 'Sign In'}</Button>
                </Link>
                <Link href={`${ROUTES.REGISTER}?next=${encodeURIComponent(ROUTES.CHECKOUT)}`}>
                  <Button variant="outline">{isArabic ? 'إنشاء حساب' : 'Create Account'}</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">{error}</div>}

              <Card>
                <CardHeader><CardTitle>{isArabic ? 'بيانات التوصيل' : 'Delivery Information'}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="fullName">{isArabic ? 'الاسم الكامل' : 'Full Name'}</Label>
                    <Input id="fullName" name="fullName" value={formData.fullName} onChange={handleChange} required />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="email">{isArabic ? 'البريد الإلكتروني' : 'Email'}</Label>
                      <Input id="email" name="email" type="email" value={formData.email || user?.email || ''} disabled required />
                    </div>
                    <div>
                      <Label htmlFor="phone">{isArabic ? 'الهاتف' : 'Phone'}</Label>
                      <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} required />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="address">{isArabic ? 'العنوان' : 'Address'}</Label>
                    <Input id="address" name="address" value={formData.address} onChange={handleChange} required />
                  </div>
                  <div>
                    <Label htmlFor="city">{isArabic ? 'المدينة' : 'City'}</Label>
                    <Input id="city" name="city" value={formData.city} onChange={handleChange} required />
                  </div>
                  <div>
                    <Label htmlFor="notes">{isArabic ? 'ملاحظات الطلب' : 'Order Notes'}</Label>
                    <textarea
                      id="notes"
                      name="notes"
                      value={formData.notes}
                      onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
                      placeholder={isArabic ? 'مثال: بدون بصل، زيادة صوص، اتصل قبل الوصول...' : 'Example: no onions, extra sauce, call before arrival...'}
                      className="mt-1 min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-950 dark:border-slate-800 dark:bg-slate-950 dark:focus:ring-slate-300"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>{isArabic ? 'الدفع والإيصال' : 'Payment and Receipt'}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>{isArabic ? 'طريقة الدفع' : 'Payment Method'}</Label>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {PAYMENT_METHOD_OPTIONS.map((option) => {
                        const selected = formData.paymentMethod === option.value
                        const Icon = option.value === PAYMENT_METHODS.CASH ? Banknote : option.value === PAYMENT_METHODS.CARD ? CreditCard : Smartphone
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => selectPaymentMethod(option.value)}
                            className={`rounded-md border p-3 text-start transition ${selected ? 'border-red-500 bg-red-50 ring-1 ring-red-500 dark:bg-red-950/30' : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950'}`}
                          >
                            <span className="flex items-center gap-2 font-semibold">
                              <Icon className="h-4 w-4 text-red-600" />
                              {isArabic ? option.ar : option.en}
                            </span>
                            <span className="mt-1 block text-xs text-slate-500">{isArabic ? option.arHint : option.enHint}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {requiresReceipt ? (
                    <div className="space-y-3">
                      <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        <span className="font-semibold">{isArabic ? 'حوّل على الرقم' : 'Transfer to'}: </span>
                        <span dir="ltr">{paymentTransferNumber}</span>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="receipt">{isArabic ? 'رفع إيصال الدفع' : 'Upload Payment Receipt'}</Label>
                        <input id="receipt" type="file" accept="image/*,.pdf" onChange={handleReceiptUpload} required className="sr-only" />
                        <label
                          htmlFor="receipt"
                          className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed border-slate-300 bg-white p-4 text-center transition hover:border-red-400 hover:bg-red-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-red-500 dark:hover:bg-red-950/20"
                        >
                          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950">
                            <UploadCloud className="h-5 w-5" />
                          </span>
                          <span className="text-sm font-semibold">{isArabic ? 'اختر صورة أو PDF للإيصال' : 'Choose a receipt image or PDF'}</span>
                          <span className="text-xs text-slate-500">PNG, JPG, WEBP, PDF - 2 MB</span>
                        </label>
                        {receipt && (
                          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
                            <div className="flex min-w-0 items-center gap-3">
                              {receipt.type === 'application/pdf' ? <FileText className="h-5 w-5 shrink-0" /> : <ImageIcon className="h-5 w-5 shrink-0" />}
                              <div className="min-w-0">
                                <p className="flex items-center gap-2 font-semibold">
                                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                                  <span className="truncate">{receipt.name}</span>
                                </p>
                                <p className="text-xs text-green-700 dark:text-green-300">{receiptSizeLabel}</p>
                              </div>
                            </div>
                            <Button type="button" size="sm" variant="outline" className="gap-2" onClick={clearReceipt}>
                              <X className="h-4 w-4" />
                              {isArabic ? 'إزالة' : 'Remove'}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-200">
                      {formData.paymentMethod === PAYMENT_METHODS.CASH
                        ? (isArabic ? 'سيتم تحصيل الدفع نقدا عند الاستلام.' : 'Cash will be collected on delivery.')
                        : (isArabic ? 'سيتم تحصيل الدفع بالكارت عند الاستلام أو داخل المطعم.' : 'Card payment will be collected on delivery or in-store.')}
                    </p>
                  )}

                  <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
                    <Label htmlFor="discountCode">{isArabic ? 'كود الخصم' : 'Discount Code'}</Label>
                    <div className="mt-2 flex gap-2">
                      <Input
                        id="discountCode"
                        value={discountCode}
                        onChange={(event) => {
                          setDiscountCode(event.target.value.toUpperCase())
                          setAppliedDiscount(null)
                          setDiscountMessage('')
                        }}
                        placeholder="RANCH20"
                      />
                      <Button type="button" variant="outline" disabled={validatingDiscount || subtotal <= 0} onClick={applyDiscountCode}>
                        {validatingDiscount ? (isArabic ? 'جاري الفحص...' : 'Checking...') : (isArabic ? 'تطبيق' : 'Apply')}
                      </Button>
                    </div>
                    {discountMessage && (
                      <p className={`mt-2 text-sm ${appliedDiscount ? 'text-green-700 dark:text-green-300' : 'text-slate-600 dark:text-slate-400'}`}>
                        {discountMessage}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Button type="submit" disabled={loading || cartItems.length === 0} className="h-12 w-full bg-red-600 text-base hover:bg-red-700 sm:h-14 sm:text-lg">
                {loading ? (isArabic ? 'جاري تقديم الطلب...' : 'Placing order...') : (isArabic ? 'تقديم الطلب' : 'Place Order')}
              </Button>
            </form>

            <Card className="h-fit lg:sticky lg:top-24">
              <CardHeader><CardTitle>{isArabic ? 'ملخص الطلب' : 'Order Summary'}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {cartItems.length === 0 ? (
                  <p className="text-sm text-slate-500">{isArabic ? 'السلة فارغة.' : 'Your cart is empty.'}</p>
                ) : (
                  cartItems.map((item) => (
                    <div key={item!.product.id} className="flex justify-between gap-3 text-sm">
                      <span>{isArabic ? item!.product.nameAr : item!.product.nameEn} x {item!.quantity}</span>
                      <span>{(item!.product.price * item!.quantity).toFixed(2)} {currency}</span>
                    </div>
                  ))
                )}
                <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
                  <div className="flex justify-between"><span>{isArabic ? 'المجموع الفرعي' : 'Subtotal'}</span><span>{subtotal.toFixed(2)} {currency}</span></div>
                  <div className="flex justify-between"><span>{isArabic ? 'الضريبة' : 'Tax'}</span><span>{tax.toFixed(2)} {currency}</span></div>
                  <div className="flex justify-between"><span>{isArabic ? 'رسوم التوصيل' : 'Delivery Fee'}</span><span>{deliveryFee.toFixed(2)} {currency}</span></div>
                </div>
                {appliedDiscount && (
                  <div className="flex justify-between text-sm text-green-700 dark:text-green-300">
                    <span>{isArabic ? `خصم ${appliedDiscount.code}` : `Discount ${appliedDiscount.code}`}</span>
                    <span>-{discountAmount.toFixed(2)} {currency}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-4 text-lg font-bold dark:border-slate-700">
                  <span>{isArabic ? 'الإجمالي' : 'Total'}</span>
                  <span className="text-red-600">{total.toFixed(2)} {currency}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  )
}

