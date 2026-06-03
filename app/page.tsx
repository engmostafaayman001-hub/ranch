'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DownloadModal } from '@/components/download-modal'
import { Navbar } from '@/components/navbar'
import { Sidebar } from '@/components/sidebar'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN } from '@/lib/constants'
import { useAppStore } from '@/lib/app-store'
import { useAuthStore } from '@/lib/store'

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [downloadModalOpen, setDownloadModalOpen] = useState(false)
  const [cartMessage, setCartMessage] = useState('')
  const { isLoggedIn, logout } = useAuthStore()
  const { language, appName } = useLanguage()
  const { products, settings, addToCart } = useAppStore()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const bestSellers = products.filter((product) => product.bestSeller && product.available).slice(0, 4)
  const visibleProducts = bestSellers.length > 0 ? bestSellers : products.filter((product) => product.available).slice(0, 4)

  const handleLogout = () => {
    logout()
    setSidebarOpen(false)
  }

  const handleAddToCart = (productId: string) => {
    const product = products.find((item) => item.id === productId)
    const productName = product ? (isArabic ? product.nameAr : product.nameEn) : ''
    addToCart(productId)
    setCartMessage(isArabic ? `تمت إضافة ${productName || 'المنتج'} إلى السلة` : `${productName || 'Product'} added to cart`)
    window.setTimeout(() => setCartMessage(''), 2200)
  }

  return (
    <main className="flex min-h-screen flex-col">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isLoggedIn={isLoggedIn} onLogout={handleLogout} />
      <Navbar onMenuOpen={() => setSidebarOpen(true)} isLoggedIn={isLoggedIn} onLogout={handleLogout} />
      {cartMessage && <CartToast message={cartMessage} isArabic={isArabic} />}

      <section className="bg-gradient-to-br from-red-50 to-amber-50 dark:from-slate-950 dark:to-slate-900">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <h1 className="mb-6 text-4xl font-bold leading-tight text-slate-950 dark:text-white md:text-6xl">
              {isArabic ? settings.heroTitleAr : settings.heroTitleEn}
            </h1>
            <p className="mb-8 text-xl text-slate-600 dark:text-slate-400">
              {isArabic ? settings.heroSubtitleAr : settings.heroSubtitleEn}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/menu"><Button size="lg" className="bg-red-600 hover:bg-red-700">{isArabic ? 'اطلب الآن' : 'Order Now'}</Button></Link>
              <Link href="/about"><Button size="lg" variant="outline">{isArabic ? 'تعرف أكثر' : 'Learn More'}</Button></Link>
            </div>
          </div>
          <HeroImage value={settings.heroImage} />
        </div>
      </section>

      <section className="bg-white py-16 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-10 text-center text-3xl font-bold">{isArabic ? 'لماذا تختار' : 'Why Choose'} {appName}?</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { icon: '⚡', title: isArabic ? 'توصيل سريع' : 'Fast Delivery', desc: isArabic ? `يصلك طلبك في حوالي ${settings.deliveryTime} دقيقة.` : `Your order arrives in about ${settings.deliveryTime} minutes.` },
              { icon: '🍽️', title: isArabic ? 'إدارة قائمة مباشرة' : 'Live Menu Control', desc: isArabic ? 'كل منتج يظهر هنا يتم إضافته من لوحة التحكم.' : 'Every product shown here is managed from the dashboard.' },
              { icon: '🔔', title: isArabic ? 'عروض وتنبيهات' : 'Offers and Alerts', desc: isArabic ? 'الإشعارات تصل للعملاء فور إرسالها من لوحة التحكم.' : 'Customers see notifications as soon as they are sent from the dashboard.' },
            ].map((feature) => (
              <div key={feature.title} className="text-center">
                <div className="mb-4 text-5xl">{feature.icon}</div>
                <h3 className="mb-2 text-xl font-bold">{feature.title}</h3>
                <p className="text-slate-600 dark:text-slate-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-10 text-center text-3xl font-bold">{isArabic ? 'منتجات القائمة' : 'Menu Products'}</h2>
          {visibleProducts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-950">
              {isArabic ? 'لا توجد منتجات منشورة بعد. أضف المنتجات من لوحة التحكم لتظهر هنا.' : 'No published products yet. Add products from the dashboard to show them here.'}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-4">
              {visibleProducts.map((product) => {
                const name = isArabic ? product.nameAr : product.nameEn
                return (
                  <div key={product.id} className="overflow-hidden rounded-lg bg-white shadow-lg transition-shadow hover:shadow-xl dark:bg-slate-800">
                    <div className="relative flex aspect-square items-center justify-center bg-gradient-to-br from-red-50 to-amber-50 text-6xl dark:from-red-950 dark:to-slate-900">
                      <ProductImage value={product.image} name={name} />
                      {product.bestSeller && <div className="absolute top-2 rounded-full bg-red-600 px-3 py-1 text-sm font-semibold text-white ltr:left-2 rtl:right-2">{isArabic ? 'الأكثر مبيعًا' : 'Best Seller'}</div>}
                    </div>
                    <div className="p-4">
                      <h3 className="mb-2 text-lg font-bold">{name}</h3>
                      <p className="mb-4 text-xl font-bold text-red-600">{product.price} {currency}</p>
                      <Button size="sm" className="w-full bg-red-600 hover:bg-red-700" onClick={() => handleAddToCart(product.id)}>{isArabic ? 'أضف إلى السلة' : 'Add to Cart'}</Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <section className="bg-gradient-to-r from-red-600 to-orange-600 py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-4xl font-bold">{isArabic ? 'نزّل التطبيق الآن' : 'Download App Now'}</h2>
          <p className="mb-6 text-xl opacity-90">{isArabic ? 'احصل على إشعارات العروض وتتبع طلباتك بسهولة.' : 'Get offer notifications and track your orders easily.'}</p>
          <Button onClick={() => setDownloadModalOpen(true)} className="bg-white px-8 text-lg font-bold text-red-600 hover:bg-gray-100">{isArabic ? 'تنزيل التطبيق' : 'Download App'}</Button>
        </div>
      </section>

      <footer className="bg-slate-900 py-12 text-white">
        <div className="mx-auto max-w-7xl px-4 text-center text-slate-400 sm:px-6 lg:px-8">
          <p>&copy; 2026 {appName}. {isArabic ? 'جميع الحقوق محفوظة' : 'All rights reserved'}.</p>
        </div>
      </footer>

      <DownloadModal isOpen={downloadModalOpen} onClose={() => setDownloadModalOpen(false)} />
    </main>
  )
}

function HeroImage({ value }: { value: string }) {
  const isImage = value.startsWith('data:image') || value.startsWith('http') || value.startsWith('/')
  return (
    <div className="overflow-hidden rounded-lg bg-white p-4 shadow-lg dark:bg-slate-800">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-red-100 to-amber-100 text-9xl dark:from-red-950 dark:to-slate-900">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Ranch hero" className="h-full w-full object-cover" />
        ) : (
          <span>{value || '🍽️'}</span>
        )}
      </div>
    </div>
  )
}

function CartToast({ message, isArabic }: { message: string; isArabic: boolean }) {
  return (
    <div className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border border-green-200 bg-white p-4 shadow-xl dark:border-green-900 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-green-700 dark:text-green-300">{message}</p>
        <a href="/cart" className="shrink-0 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700">
          {isArabic ? 'عرض السلة' : 'View Cart'}
        </a>
      </div>
    </div>
  )
}

function ProductImage({ value, name }: { value: string; name: string }) {
  const isImage = value.startsWith('data:image') || value.startsWith('http') || value.startsWith('/')
  if (isImage) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={value} alt={name} className="h-full w-full object-cover" />
  }
  return <span>{value || '🍽️'}</span>
}
