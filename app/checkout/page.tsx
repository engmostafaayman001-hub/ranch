'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileInput } from '@/components/ui/file-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/logo'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_LABELS_EN, PAYMENT_METHODS, ROUTES } from '@/lib/constants'
import { useAppStore } from '@/lib/app-store'
import { createTrackedOrder, PaymentStatus, TrackingStatus } from '@/lib/order-tracking'

export default function CheckoutPage() {
  const router = useRouter()
  const { language, appName } = useLanguage()
  const { cart, products, settings, clearCart } = useAppStore()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    paymentMethod: 'cash',
  })
  const [receipt, setReceipt] = useState<{ name: string; dataUrl: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cartItems = useMemo(() => cart.map((item) => {
    const product = products.find((entry) => entry.id === item.productId)
    return product ? { ...item, product } : null
  }).filter(Boolean), [cart, products])

  const subtotal = cartItems.reduce((sum, item) => sum + item!.product.price * item!.quantity, 0)
  const tax = subtotal * settings.taxRate
  const deliveryFee = subtotal > 0 ? settings.deliveryFee : 0
  const total = subtotal + tax + deliveryFee
  const requiresReceipt = formData.paymentMethod !== PAYMENT_METHODS.CASH

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target
    setFormData({ ...formData, [name]: value })
    if (name === 'paymentMethod' && value === PAYMENT_METHODS.CASH) {
      setReceipt(null)
    }
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
      setReceipt({ name: file.name, dataUrl: String(reader.result) })
      setError(null)
    }
    reader.onerror = () => setError(isArabic ? 'تعذر رفع الإيصال.' : 'Could not upload receipt.')
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

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
      const paymentStatus: PaymentStatus = formData.paymentMethod === PAYMENT_METHODS.CASH ? 'cash_on_delivery' : 'receipt_uploaded'
      const payload = {
        id: orderId,
        customer: formData.fullName,
        phone: formData.phone,
        address: `${formData.address}, ${formData.city}`,
        total,
        items: cartItems.reduce((sum, item) => sum + item!.quantity, 0),
        status: 'placed' as TrackingStatus,
        createdAt: now.toISOString(),
        estimatedDelivery: isArabic ? `${settings.deliveryTime} دقيقة` : `${settings.deliveryTime} min`,
        driver: {
          name: isArabic ? 'بانتظار التعيين' : 'Pending assignment',
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const message = errorData?.message || errorData?.error || 'Order API failed'
        throw new Error(message)
      }

      await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          address: `${formData.address}, ${formData.city}`,
        }),
      }).catch(() => {})

      createTrackedOrder(payload)
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

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-8 text-3xl font-bold">{isArabic ? 'إكمال الطلب' : 'Checkout'}</h1>

        <div className="grid gap-8 md:grid-cols-3">
          <form onSubmit={handleSubmit} className="space-y-6 md:col-span-2">
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
                    <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required />
                  </div>
                  <div>
                    <Label htmlFor="phone">{isArabic ? 'رقم الهاتف' : 'Phone'}</Label>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{isArabic ? 'الدفع والإيصال' : 'Payment and Receipt'}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="paymentMethod">{isArabic ? 'طريقة الدفع' : 'Payment Method'}</Label>
                  <select id="paymentMethod" name="paymentMethod" value={formData.paymentMethod} onChange={handleChange} className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950">
                    {Object.entries(PAYMENT_METHODS).map(([, value]) => (
                      <option key={value} value={value}>{(isArabic ? PAYMENT_METHOD_LABELS : PAYMENT_METHOD_LABELS_EN)[value as keyof typeof PAYMENT_METHOD_LABELS]}</option>
                    ))}
                  </select>
                </div>

                {requiresReceipt ? (
                  <div>
                    <Label htmlFor="receipt">{isArabic ? 'رفع إيصال الدفع' : 'Upload Payment Receipt'}</Label>
                    <FileInput id="receipt" accept="image/*,.pdf" onChange={handleReceiptUpload} required className="mt-1" />
                    {receipt && (
                      <p className="mt-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-200">
                        {isArabic ? `تم رفع الإيصال: ${receipt.name}` : `Receipt uploaded: ${receipt.name}`}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-200">
                    {isArabic ? 'سيتم تحصيل الدفع عند الاستلام.' : 'Payment will be collected on delivery.'}
                  </p>
                )}
              </CardContent>
            </Card>

            <Button type="submit" disabled={loading || cartItems.length === 0} className="w-full bg-red-600 py-6 text-lg hover:bg-red-700">
              {loading ? (isArabic ? 'جاري تقديم الطلب...' : 'Placing order...') : (isArabic ? 'تقديم الطلب' : 'Place Order')}
            </Button>
          </form>

          <Card className="h-fit">
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
              <div className="flex justify-between border-t border-slate-200 pt-4 text-lg font-bold dark:border-slate-700">
                <span>{isArabic ? 'الإجمالي' : 'Total'}</span>
                <span className="text-red-600">{total.toFixed(2)} {currency}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
