'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Sidebar } from '@/components/sidebar'
import { useAuthStore } from '@/lib/store'
import { ROUTES, CURRENCY, CURRENCY_EN } from '@/lib/constants'
import { useLanguage } from '@/components/language-provider'
import { Logo } from '@/components/logo'

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
}

const cartItemNames: Record<string, { ar: string; en: string }> = {
  '1': { ar: 'برجر كلاسيكي', en: 'Classic Burger' },
  '3': { ar: 'بيتزا برونتشيتا', en: 'Pepperoni Pizza' },
}

export default function CartPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { isLoggedIn, logout } = useAuthStore()
  const { language, appName } = useLanguage()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const [cartItems, setCartItems] = useState<CartItem[]>([])

  useEffect(() => {
    setMounted(true)
  }, [])

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = subtotal * 0.1
  const deliveryFee = 29.99
  const total = subtotal + tax + deliveryFee

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id)
    } else {
      setCartItems(cartItems.map((item) => (item.id === id ? { ...item, quantity } : item)))
    }
  }

  const removeItem = (id: string) => {
    setCartItems(cartItems.filter((item) => item.id !== id))
  }

  const handleLogout = () => {
    logout()
    setSidebarOpen(false)
  }

  if (!mounted) return null

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isLoggedIn={isLoggedIn}
        onLogout={handleLogout}
      />

      {/* Navigation */}
      <nav className="sticky top-0 z-40 w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3 flex-row-reverse">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden"
              >
                ☰
              </Button>
              <Link href="/" className="flex items-center space-x-3 flex-row-reverse">
                <Logo size="md" />
                <span className="font-bold text-lg text-red-600 hidden sm:inline">{appName}</span>
              </Link>
            </div>
            <div className="hidden lg:flex gap-2 flex-row-reverse">
              <Link href={ROUTES.MENU}>
                <Button variant="ghost">{isArabic ? '← العودة للقائمة' : '← Back to Menu'}</Button>
              </Link>
              {isLoggedIn && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  ✓ {isArabic ? 'تم تسجيل الدخول' : 'Logged in'}
                </span>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-8">{isArabic ? 'السلة' : 'Cart'}</h1>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="md:col-span-2 space-y-4">
            {cartItems.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-slate-600 dark:text-slate-400 mb-4">{isArabic ? 'السلة فارغة' : 'Your cart is empty'}</p>
                  <Link href={ROUTES.MENU}>
                    <Button className="bg-red-600 hover:bg-red-700">{isArabic ? 'متابعة التسوق' : 'Continue Shopping'}</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              cartItems.map((item) => (
                <Card key={item.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between flex-row-reverse">
                      <div>
                        <h3 className="font-bold text-lg">{cartItemNames[item.id]?.[language] || item.name}</h3>
                        <p className="text-slate-600 dark:text-slate-400">{item.price} {currency}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          >
                            -
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          >
                            +
                          </Button>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeItem(item.id)}
                        >
                          {isArabic ? 'حذف' : 'Remove'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Order Summary */}
          {cartItems.length > 0 && (
            <Card className="h-fit">
              <CardContent className="pt-6 space-y-4">
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
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 flex justify-between font-bold text-lg">
                  <span>{isArabic ? 'الإجمالي' : 'Total'}</span>
                  <span className="text-red-600">{total.toFixed(2)} {currency}</span>
                </div>
              </CardContent>
              <CardFooter>
                <Link href={ROUTES.CHECKOUT} className="w-full">
                  <Button className="w-full bg-red-600 hover:bg-red-700">
                    {isArabic ? 'إكمال الطلب' : 'Checkout'}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}
