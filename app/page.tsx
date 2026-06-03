'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Sidebar } from '@/components/sidebar'
import { Navbar } from '@/components/navbar'
import { DownloadModal } from '@/components/download-modal'
import { useAuthStore } from '@/lib/store'
import { useLanguage } from '@/components/language-provider'

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [downloadModalOpen, setDownloadModalOpen] = useState(false)
  const { isLoggedIn, logout } = useAuthStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleLogout = () => {
    logout()
    setSidebarOpen(false)
  }

  if (!mounted) return null

  return <HomeContent
    sidebarOpen={sidebarOpen}
    setSidebarOpen={setSidebarOpen}
    downloadModalOpen={downloadModalOpen}
    setDownloadModalOpen={setDownloadModalOpen}
    isLoggedIn={isLoggedIn}
    handleLogout={handleLogout}
  />
}

function HomeContent({
  sidebarOpen,
  setSidebarOpen,
  downloadModalOpen,
  setDownloadModalOpen,
  isLoggedIn,
  handleLogout
}: any) {
  const { language, appName } = useLanguage()
  const isArabic = language === 'ar'

  const content = {
    title: isArabic ? 'اطلب من' : 'Order from',
    subtitle: isArabic
      ? 'وجبات طازة وشهية وساخنة توصل لباب منزلك في دقائق.'
      : 'Fresh, delicious hot meals delivered to your door in minutes.',
    orderNow: isArabic ? 'اطلب الآن' : 'Order Now',
    learnMore: isArabic ? 'تعرف أكثر' : 'Learn More',
    whyChoose: isArabic ? 'لماذا تختار' : 'Why Choose',
    features: [
      {
        icon: '⚡',
        title: isArabic ? 'توصيل سريع' : 'Fast Delivery',
        desc: isArabic ? 'احصل على طلبك في 30 دقيقة أو أقل' : 'Get your order in 30 minutes or less'
      },
      {
        icon: '🍽️',
        title: isArabic ? 'طعام طازج' : 'Fresh Food',
        desc: isArabic ? 'محضر طازة حسب الطلب في كل مرة' : 'Prepared fresh to order every time'
      },
      {
        icon: '💰',
        title: isArabic ? 'أسعار رائعة' : 'Great Prices',
        desc: isArabic ? 'أفضل قيمة مقابل المال في المدينة' : 'Best value for money in the city'
      }
    ],
    bestSellers: isArabic ? 'أكثر المنتجات مبيعًا' : 'Best Sellers',
    products: [
      {
        name: isArabic ? 'برجر لذيذ' : 'Delicious Burger',
        price: isArabic ? '85 ج.م' : '$8.50',
        icon: '🍔',
        popular: true
      },
      {
        name: isArabic ? 'بيتزا الجبن' : 'Cheese Pizza',
        price: isArabic ? '120 ج.م' : '$12.00',
        icon: '🍕',
        popular: true
      },
      {
        name: isArabic ? 'دجاج مشوي' : 'Grilled Chicken',
        price: isArabic ? '110 ج.م' : '$11.00',
        icon: '🍗',
        popular: false
      },
      {
        name: isArabic ? 'سندويش الشاورما' : 'Shawarma Sandwich',
        price: isArabic ? '75 ج.م' : '$7.50',
        icon: '🌯',
        popular: true
      }
    ],
    mostPopular: isArabic ? 'الأكثر مبيعًا' : 'Best Seller',
    addToCart: isArabic ? 'أضف إلى السلة' : 'Add to Cart',
    downloadApp: isArabic ? 'نزّل التطبيق الآن' : 'Download App Now',
    exclusiveOffers: isArabic ? 'احصل على عروض حصرية وتتبع فوري لطلباتك' : 'Get exclusive offers and real-time tracking for your orders',
    download: isArabic ? '⬇️ تنزيل التطبيق' : '⬇️ Download App',
    hungry: isArabic ? 'جوعان؟' : 'Hungry?',
    startOrder: isArabic ? 'ابدأ الطلب الآن' : 'Start Order Now',
  }

  return (
    <main className="flex flex-col min-h-screen">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isLoggedIn={isLoggedIn}
        onLogout={handleLogout}
      />

      {/* Navigation */}
      <Navbar
        onMenuOpen={() => setSidebarOpen(true)}
        isLoggedIn={isLoggedIn}
        onLogout={handleLogout}
      />

      {/* Hero Section */}
      <section className="flex-1 bg-gradient-to-br from-red-50 to-orange-50 dark:from-slate-900 dark:to-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className={`grid md:grid-cols-2 gap-12 items-center ${isArabic ? 'flex-row-reverse' : ''}`}>
            <div className={isArabic ? 'order-2 md:order-1' : 'order-1'}>
              <h1 className="text-5xl md:text-6xl font-bold text-slate-900 dark:text-white mb-6">
                {content.title} <span className="text-red-600">{appName}</span>
              </h1>
              <p className="text-xl text-slate-600 dark:text-slate-400 mb-8">
                {content.subtitle}
              </p>
              <div className={`flex gap-4 ${isArabic ? 'flex-row-reverse' : ''}`}>
                <Link href="/menu">
                  <Button size="lg" className="bg-red-600 hover:bg-red-700">
                    {content.orderNow}
                  </Button>
                </Link>
                <Link href="/about">
                  <Button size="lg" variant="outline">
                    {content.learnMore}
                  </Button>
                </Link>
              </div>
            </div>
            <div className={isArabic ? 'order-1 md:order-2' : 'order-2'}>
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8">
                <div className="aspect-square bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900 dark:to-orange-900 rounded-lg flex items-center justify-center">
                  <span className="text-9xl">🍔</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">
            {content.whyChoose} {appName}?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {content.features.map((feature) => (
              <div key={feature.title} className="text-center">
                <div className="text-5xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-slate-600 dark:text-slate-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Best Sellers Section */}
      <section className="py-20 bg-slate-50 dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">{content.bestSellers}</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {content.products.map((product) => (
              <div
                key={product.name}
                className="bg-white dark:bg-slate-800 rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
              >
                <div className="relative">
                  <div className="aspect-square bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900 dark:to-orange-900 flex items-center justify-center">
                    <span className="text-6xl">{product.icon}</span>
                  </div>
                  {product.popular && (
                    <div className={`absolute top-2 ${isArabic ? 'right-2' : 'left-2'} bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold`}>
                      {content.mostPopular}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-2">{product.name}</h3>
                  <p className="text-red-600 font-bold text-xl mb-4">{product.price}</p>
                  <Link href="/menu" className="block">
                    <Button size="sm" className="w-full bg-red-600 hover:bg-red-700">
                      {content.addToCart}
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Download App Section */}
      <section className="bg-gradient-to-r from-red-600 to-orange-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-4">{content.downloadApp}</h2>
          <p className="text-xl mb-6 opacity-90">{content.exclusiveOffers}</p>
          <Button
            onClick={() => setDownloadModalOpen(true)}
            className="bg-white text-red-600 hover:bg-gray-100 font-bold text-lg px-8"
          >
            {content.download}
          </Button>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-red-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6">{content.hungry}</h2>
          <Link href="/menu">
            <Button size="lg" className="bg-white text-red-600 hover:bg-gray-100">
              {content.startOrder}
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-bold text-lg mb-4">{appName}</h4>
              <p className="text-slate-400">
                {isArabic ? 'طعام لذيذ وتوصيل سريع' : 'Delicious food and fast delivery'}
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">{isArabic ? 'روابط سريعة' : 'Quick Links'}</h4>
              <ul className="space-y-2 text-slate-400">
                <li><Link href="/menu" className="hover:text-white">{isArabic ? 'القائمة' : 'Menu'}</Link></li>
                <li><Link href="/orders" className="hover:text-white">{isArabic ? 'الطلبات' : 'Orders'}</Link></li>
                <li><Link href="/profile" className="hover:text-white">{isArabic ? 'الملف الشخصي' : 'Profile'}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">{isArabic ? 'الشركة' : 'Company'}</h4>
              <ul className="space-y-2 text-slate-400">
                <li><Link href="/about" className="hover:text-white">{isArabic ? 'من نحن' : 'About Us'}</Link></li>
                <li><Link href="/contact" className="hover:text-white">{isArabic ? 'اتصل بنا' : 'Contact Us'}</Link></li>
                <li><Link href="/faq" className="hover:text-white">{isArabic ? 'الأسئلة الشائعة' : 'FAQ'}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">{isArabic ? 'القانونية' : 'Legal'}</h4>
              <ul className="space-y-2 text-slate-400">
                <li><Link href="/privacy" className="hover:text-white">{isArabic ? 'سياسة الخصوصية' : 'Privacy Policy'}</Link></li>
                <li><Link href="/terms" className="hover:text-white">{isArabic ? 'الشروط والأحكام' : 'Terms & Conditions'}</Link></li>
                <li><Link href="/refund" className="hover:text-white">{isArabic ? 'سياسة الاسترجاع' : 'Refund Policy'}</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-center text-slate-400">
            <p>
              &copy; 2026 {appName} {isArabic ? 'مطعم' : 'Restaurant'}. {isArabic ? 'جميع الحقوق محفوظة' : 'All rights reserved'}.
            </p>
          </div>
        </div>
      </footer>

      {/* Download Modal */}
      <DownloadModal
        isOpen={downloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
      />
    </main>
  )
}
