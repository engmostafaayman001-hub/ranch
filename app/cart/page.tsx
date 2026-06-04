'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Navbar } from '@/components/navbar'
import { Sidebar } from '@/components/sidebar'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN, ROUTES } from '@/lib/constants'
import { useAppStore } from '@/lib/app-store'
import { useAuthStore } from '@/lib/store'
import { useSharedAppData } from '@/lib/use-shared-app-data'

export default function CartPage() {
  useSharedAppData()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { isLoggedIn, logout } = useAuthStore()
  const { language } = useLanguage()
  const { cart, products, settings, updateCartQuantity, removeFromCart } = useAppStore()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN

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

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-8 text-3xl font-bold">{isArabic ? 'السلة' : 'Cart'}</h1>

        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-4 md:col-span-2">
            {cartItems.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
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
                    <CardContent className="pt-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                          <ProductThumb value={product.image} name={name} />
                          <div>
                            <h3 className="text-lg font-bold">{name}</h3>
                            <p className="text-slate-600 dark:text-slate-400">{product.price} {currency}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => updateCartQuantity(product.id, item!.quantity - 1)}>-</Button>
                            <span className="w-8 text-center">{item!.quantity}</span>
                            <Button variant="outline" size="sm" onClick={() => updateCartQuantity(product.id, item!.quantity + 1)}>+</Button>
                          </div>
                          <Button variant="destructive" size="sm" onClick={() => removeFromCart(product.id)}>{isArabic ? 'حذف' : 'Remove'}</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>

          {cartItems.length > 0 && (
            <Card className="h-fit">
              <CardContent className="space-y-4 pt-6">
                <div className="flex justify-between"><span>{isArabic ? 'المجموع الفرعي' : 'Subtotal'}</span><span>{subtotal.toFixed(2)} {currency}</span></div>
                <div className="flex justify-between"><span>{isArabic ? 'الضريبة' : 'Tax'}</span><span>{tax.toFixed(2)} {currency}</span></div>
                <div className="flex justify-between"><span>{isArabic ? 'رسوم التوصيل' : 'Delivery Fee'}</span><span>{deliveryFee.toFixed(2)} {currency}</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-4 text-lg font-bold dark:border-slate-700">
                  <span>{isArabic ? 'الإجمالي' : 'Total'}</span>
                  <span className="text-red-600">{total.toFixed(2)} {currency}</span>
                </div>
              </CardContent>
              <CardFooter>
                <Link href={ROUTES.CHECKOUT} className="w-full">
                  <Button className="w-full bg-red-600 hover:bg-red-700">{isArabic ? 'إكمال الطلب' : 'Checkout'}</Button>
                </Link>
              </CardFooter>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}

function ProductThumb({ value, name }: { value: string; name: string }) {
  const isImage = value.startsWith('data:image') || value.startsWith('http') || value.startsWith('/')
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-red-50 text-3xl dark:bg-red-950">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt={name} className="h-full w-full object-contain p-1" />
      ) : (
        <span>{value || '🍽️'}</span>
      )}
    </div>
  )
}
