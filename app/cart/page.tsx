'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Navbar } from '@/components/navbar'
import { RestaurantStatusBanner } from '@/components/restaurant-status-banner'
import { Sidebar } from '@/components/sidebar'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN, ROUTES } from '@/lib/constants'
import { useAppStore } from '@/lib/app-store'
import { useAuthStore } from '@/lib/store'
import { useSharedAppData } from '@/lib/use-shared-app-data'
import { isDisplayableImage } from '@/lib/client-images'

export default function CartPage() {
  useSharedAppData()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { isLoggedIn, logout } = useAuthStore()
  const { language } = useLanguage()
  const { cart, products, settings, updateCartQuantity, removeFromCart } = useAppStore()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const restaurantOpen = settings.restaurantOpen !== false

  const cartItems = useMemo(() => cart.map((item) => {
    const product = products.find((entry) => entry.id === item.productId)
    return product ? { ...item, product } : null
  }).filter(Boolean), [cart, products])

  const subtotal = cartItems.reduce((sum, item) => sum + item!.product.price * item!.quantity, 0)
  const tax = subtotal * settings.taxRate
  const deliveryFee = subtotal > 0 ? settings.deliveryFee : 0
  const total = subtotal + tax + deliveryFee

  const handleLogout = () => {
    logout()
    setSidebarOpen(false)
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isLoggedIn={isLoggedIn} onLogout={handleLogout} />
      <Navbar onMenuOpen={() => setSidebarOpen(true)} isLoggedIn={isLoggedIn} onLogout={handleLogout} />
      <RestaurantStatusBanner />

      <section className="mx-auto max-w-5xl px-3 py-4 sm:px-6 lg:px-8">
        <h1 className="mb-5 text-2xl font-bold sm:text-3xl">{isArabic ? 'السلة' : 'Cart'}</h1>

        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-3">
            {cartItems.length === 0 ? (
              <Card>
                <CardContent className="pt-4 text-center sm:pt-6">
                  <p className="mb-4 text-slate-600 dark:text-slate-400">{isArabic ? 'السلة فارغة' : 'Your cart is empty'}</p>
                  <Link href={ROUTES.MENU}><Button className="bg-red-600 hover:bg-red-700">{isArabic ? 'متابعة التسوق' : 'Continue Shopping'}</Button></Link>
                </CardContent>
              </Card>
            ) : (
              cartItems.map((item) => {
                const product = item!.product
                const name = isArabic ? product.nameAr : product.nameEn
                return (
                  <Card key={product.id}>
                    <CardContent className="pt-4 sm:pt-6">
                      <div className="grid grid-cols-[4.5rem_1fr] gap-3 sm:grid-cols-[5rem_1fr_auto] sm:items-center">
                        <ProductThumb value={product.image} name={name} />
                        <div className="min-w-0">
                          <h3 className="line-clamp-2 text-sm font-bold sm:text-base">{name}</h3>
                          <p className="mt-1 text-sm font-semibold text-red-600">{Number(product.price || 0).toFixed(2)} {currency}</p>
                        </div>
                        <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:justify-end">
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateCartQuantity(product.id, item!.quantity - 1)}><Minus className="h-3.5 w-3.5" /></Button>
                            <span className="w-8 text-center text-sm font-semibold">{item!.quantity}</span>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateCartQuantity(product.id, item!.quantity + 1)}><Plus className="h-3.5 w-3.5" /></Button>
                          </div>
                          <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => removeFromCart(product.id)} title={isArabic ? 'حذف' : 'Remove'}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>

          {cartItems.length > 0 && (
            <Card className="h-fit lg:sticky lg:top-24">
              <CardContent className="space-y-3 pt-4 text-sm sm:pt-6">
                <Line label={isArabic ? 'المجموع الفرعي' : 'Subtotal'} value={`${subtotal.toFixed(2)} ${currency}`} />
                <Line label={isArabic ? 'الضريبة' : 'Tax'} value={`${tax.toFixed(2)} ${currency}`} />
                <Line label={isArabic ? 'رسوم التوصيل' : 'Delivery Fee'} value={`${deliveryFee.toFixed(2)} ${currency}`} />
                <div className="flex justify-between border-t border-slate-200 pt-4 text-lg font-bold dark:border-slate-700">
                  <span>{isArabic ? 'الإجمالي' : 'Total'}</span>
                  <span className="text-red-600">{total.toFixed(2)} {currency}</span>
                </div>
              </CardContent>
              <CardFooter>
                <Link href={restaurantOpen ? ROUTES.CHECKOUT : '#'} className="w-full">
                  <Button disabled={!restaurantOpen} className="h-11 w-full bg-red-600 hover:bg-red-700">{restaurantOpen ? (isArabic ? 'إكمال الطلب' : 'Checkout') : (isArabic ? 'المطعم مغلق' : 'Restaurant closed')}</Button>
                </Link>
              </CardFooter>
            </Card>
          )}
        </div>
      </section>
    </main>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}

function ProductThumb({ value, name }: { value: string; name: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="flex aspect-square w-full shrink-0 items-center justify-center overflow-hidden rounded-md bg-red-50 p-1 text-3xl dark:bg-red-950">
      {isDisplayableImage(value) && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt={name} className="h-full w-full object-contain" onError={() => setFailed(true)} />
      ) : (
        <span>{value || '🍽️'}</span>
      )}
    </div>
  )
}
