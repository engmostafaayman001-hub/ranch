'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FileInput } from '@/components/ui/file-input'
import { ROUTES, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_LABELS_EN, VODAFONE_CASH_NUMBER, INSTAPAY_NUMBER, CURRENCY, CURRENCY_EN } from '@/lib/constants'
import { useLanguage } from '@/components/language-provider'
import { Logo } from '@/components/logo'
import { createTrackedOrder, TrackingStatus } from '@/lib/order-tracking'

export default function CheckoutPage() {
  const router = useRouter()
  const { language, appName, t } = useLanguage()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    zipCode: '',
    paymentMethod: 'cash',
    receipt: null as File | null,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subtotal = 0
  const tax = subtotal * 0.1
  const deliveryFee = subtotal > 0 ? 29.99 : 0
  const total = subtotal + tax + deliveryFee

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError(isArabic ? 'حجم الملف يجب أن يكون أقل من 5 MB' : 'File size must be less than 5 MB')
        return
      }
      setFormData({
        ...formData,
        receipt: file,
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (formData.paymentMethod !== 'cash' && !formData.receipt) {
      setError(isArabic ? 'يجب رفع الإيصال للدفع الإلكتروني' : 'Receipt upload is required for electronic payment')
      setLoading(false)
      return
    }

    try {
      // Simulate order placement
      await new Promise((resolve) => setTimeout(resolve, 1500))
      const now = new Date()
      const orderId = `ORD${String(now.getTime()).slice(-6)}`
      const payload = {
        id: orderId,
        customer: formData.fullName || 'Customer',
        phone: formData.phone,
        address: `${formData.address}, ${formData.city}`,
        total,
        items: 3,
        status: 'placed' as TrackingStatus,
        createdAt: now.toISOString(),
        estimatedDelivery: isArabic ? '30 دقيقة' : '30 min',
        driver: {
          name: isArabic ? 'بانتظار التعيين' : 'Pending assignment',
          phone: '-',
          rating: 0,
        },
      }
      const response = await fetch('/api/pos/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(isArabic ? 'تعذر إرسال الطلب إلى النظام' : 'Could not send the order to the system')
      }

      createTrackedOrder(payload)
      router.push(ROUTES.ORDERS)
    } catch {
      setError(isArabic ? 'حدث خطأ في تقديم الطلب' : 'Something went wrong while placing the order')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-3 flex-row-reverse">
              <Logo size="md" />
              <span className="font-bold text-xl text-red-600">{appName}</span>
            </Link>
            <Link href={ROUTES.CART}>
              <Button variant="ghost">{isArabic ? '← العودة للسلة' : '← Back to Cart'}</Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-8">{isArabic ? 'إكمال الطلب' : 'Checkout'}</h1>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Checkout Form */}
          <form onSubmit={handleSubmit} className="md:col-span-2 space-y-6">
            {error && (
              <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Delivery Information */}
            <Card>
              <CardHeader>
                <CardTitle>{isArabic ? 'معلومات التوصيل' : 'Delivery Information'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="fullName">{isArabic ? 'الاسم الكامل' : 'Full Name'}</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                    placeholder={isArabic ? 'أحمد محمد' : 'John Smith'}
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">{t('email')}</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      placeholder="ahmed@example.com"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">{isArabic ? 'رقم الهاتف' : 'Phone Number'}</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      placeholder="01234567890"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="address">{isArabic ? 'العنوان' : 'Address'}</Label>
                  <Input
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    required
                    placeholder={isArabic ? 'الشارع والرقم' : 'Street and number'}
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">{isArabic ? 'المدينة' : 'City'}</Label>
                    <Input
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      required
                      placeholder={isArabic ? 'القاهرة' : 'Cairo'}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="zipCode">{isArabic ? 'الرمز البريدي' : 'ZIP Code'}</Label>
                    <Input
                      id="zipCode"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleChange}
                      required
                      placeholder="12345"
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Method */}
            <Card>
              <CardHeader>
                <CardTitle>{isArabic ? 'طريقة الدفع' : 'Payment Method'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(PAYMENT_METHODS).map(([, value]) => (
                  <label key={value} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={value}
                      checked={formData.paymentMethod === value}
                      onChange={handleChange}
                      className="w-4 h-4"
                    />
                    <span>{(isArabic ? PAYMENT_METHOD_LABELS : PAYMENT_METHOD_LABELS_EN)[value as keyof typeof PAYMENT_METHOD_LABELS]}</span>
                  </label>
                ))}
              </CardContent>
            </Card>

            {/* Receipt Upload */}
            {formData.paymentMethod !== 'cash' && (
              <Card className="border-blue-500 bg-blue-50 dark:bg-blue-950">
                <CardHeader>
                  <CardTitle>{isArabic ? 'رفع الإيصال' : 'Upload Receipt'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {formData.paymentMethod === PAYMENT_METHODS.VODAFONE_CASH && (
                    <div className="bg-white dark:bg-slate-800 p-4 rounded border border-blue-200">
                      <p className="text-sm font-semibold mb-2">{isArabic ? 'رقم محفظة فودافون كاش:' : 'Vodafone Cash wallet number:'}</p>
                      <p className="text-lg font-bold text-red-600">{VODAFONE_CASH_NUMBER}</p>
                    </div>
                  )}
                  {formData.paymentMethod === PAYMENT_METHODS.INSTAPAY && (
                    <div className="bg-white dark:bg-slate-800 p-4 rounded border border-blue-200">
                      <p className="text-sm font-semibold mb-2">{isArabic ? 'رقم تحويل إنستا باي:' : 'InstaPay transfer number:'}</p>
                      <p className="text-lg font-bold text-red-600">{INSTAPAY_NUMBER}</p>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="receipt">{isArabic ? 'رفع صورة الإيصال' : 'Upload receipt image'}</Label>
                    <FileInput
                      id="receipt"
                      onChange={handleFileChange}
                      accept="image/*,.pdf"
                      required
                      className="mt-1"
                    />
                    <p className="text-xs text-slate-500 mt-2">
                      {isArabic ? 'الملفات المقبولة: صور (JPG, PNG) أو PDF، الحد الأقصى 5 MB' : 'Accepted files: images (JPG, PNG) or PDF, max 5 MB'}
                    </p>
                  </div>

                  {formData.receipt && (
                    <div className="bg-green-50 dark:bg-green-950 border border-green-200 p-3 rounded">
                      <p className="text-sm text-green-700 dark:text-green-200">
                        ✓ {isArabic ? 'تم اختيار الملف' : 'Selected file'}: {formData.receipt.name}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-6 text-lg"
            >
              {loading ? (isArabic ? 'جاري تقديم الطلب...' : 'Placing order...') : (isArabic ? 'تقديم الطلب' : 'Place Order')}
            </Button>
          </form>

          {/* Order Summary */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>{isArabic ? 'ملخص الطلب' : 'Order Summary'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {isArabic ? 'سيتم إرسال تفاصيل الطلب الفعلية إلى النظام عند ربط السلة بقاعدة البيانات.' : 'Actual order line items will be sent to the system once the cart is connected to the database.'}
              </p>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-2">
                <div className="flex justify-between">
                  <span>{isArabic ? 'المجموع الفرعي' : 'Subtotal'}</span>
                  <span>{subtotal.toFixed(2)} {currency}</span>
                </div>
                <div className="flex justify-between">
                  <span>{isArabic ? 'الضريبة (10%)' : 'Tax (10%)'}</span>
                  <span>{tax.toFixed(2)} {currency}</span>
                </div>
                <div className="flex justify-between">
                  <span>{isArabic ? 'رسوم التوصيل' : 'Delivery Fee'}</span>
                  <span>{deliveryFee.toFixed(2)} {currency}</span>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-4 flex justify-between font-bold text-lg">
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
