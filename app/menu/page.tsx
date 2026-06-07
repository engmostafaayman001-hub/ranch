'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Heart, Plus, Search, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Navbar } from '@/components/navbar'
import { RestaurantStatusBanner } from '@/components/restaurant-status-banner'
import { Sidebar } from '@/components/sidebar'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN, ROUTES } from '@/lib/constants'
import { MenuProduct, useAppStore } from '@/lib/app-store'
import { useAuthStore } from '@/lib/store'
import { useSharedAppData } from '@/lib/use-shared-app-data'
import { isDisplayableImage } from '@/lib/client-images'

export default function MenuPage() {
  const { loading: sharedLoading } = useSharedAppData()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(() => {
    if (typeof window === 'undefined') return 'all'
    return new URLSearchParams(window.location.search).get('category') || 'all'
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [addedProductId, setAddedProductId] = useState<string | null>(null)
  const [cartMessage, setCartMessage] = useState('')
  const { isLoggedIn, logout } = useAuthStore()
  const { language } = useLanguage()
  const { categories, products, settings, favoriteProductIds, addToCart, toggleFavoriteProduct } = useAppStore()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const restaurantOpen = settings.restaurantOpen !== false

  const activeCategories = useMemo(() => categories.filter((category) => category.active), [categories])
  const filteredProducts = products.filter((product) => {
    const term = searchTerm.trim().toLowerCase()
    const name = isArabic ? product.nameAr : product.nameEn
    const description = isArabic ? product.descriptionAr : product.descriptionEn
    return (
      product.available &&
      (selectedCategory === 'all' || product.categoryId === selectedCategory) &&
      (!term || `${name} ${description}`.toLowerCase().includes(term))
    )
  })

  const handleAddToCart = (productId: string) => {
    if (!restaurantOpen) {
      setCartMessage(isArabic ? 'المطعم مغلق حاليا. سيبدأ العمل حسب ساعات العمل.' : 'The restaurant is currently closed. Ordering resumes during working hours.')
      window.setTimeout(() => {
        setAddedProductId(null)
        setCartMessage('')
      }, 2200)
      return
    }
    const product = products.find((item) => item.id === productId)
    const productName = product ? (isArabic ? product.nameAr : product.nameEn) : ''
    addToCart(productId)
    setAddedProductId(productId)
    setCartMessage(isArabic ? `تمت إضافة ${productName || 'المنتج'} إلى السلة` : `${productName || 'Product'} added to cart`)
    window.setTimeout(() => {
      setAddedProductId(null)
      setCartMessage('')
    }, 2200)
  }

  const handleLogout = () => {
    logout()
    setSidebarOpen(false)
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isLoggedIn={isLoggedIn} onLogout={handleLogout} />
      <Navbar onMenuOpen={() => setSidebarOpen(true)} isLoggedIn={isLoggedIn} onLogout={handleLogout} />
      <RestaurantStatusBanner />
      {cartMessage && <CartToast message={cartMessage} isArabic={isArabic} />}

      <section className="mx-auto max-w-7xl px-3 py-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={isArabic ? 'ابحث في القائمة' : 'Search the menu'}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>

        <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
          <Button size="sm" variant={selectedCategory === 'all' ? 'default' : 'outline'} className={selectedCategory === 'all' ? 'bg-red-600 hover:bg-red-700' : ''} onClick={() => setSelectedCategory('all')}>
            {isArabic ? 'الكل' : 'All'}
          </Button>
          {activeCategories.map((category) => (
            <Button key={category.id} size="sm" variant={selectedCategory === category.id ? 'default' : 'outline'} className={selectedCategory === category.id ? 'shrink-0 bg-red-600 hover:bg-red-700' : 'shrink-0'} onClick={() => setSelectedCategory(category.id)}>
              {isArabic ? category.nameAr : category.nameEn}
            </Button>
          ))}
        </div>

        {sharedLoading && products.length === 0 ? (
          <ProductGridSkeleton />
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            {isArabic ? 'لا توجد منتجات مطابقة.' : 'No products found.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                currency={currency}
                isArabic={isArabic}
                isFavorite={favoriteProductIds.includes(product.id)}
                added={addedProductId === product.id}
                onAddToCart={handleAddToCart}
                onToggleFavorite={toggleFavoriteProduct}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="aspect-square animate-pulse bg-slate-200 dark:bg-slate-800" />
          <div className="space-y-2 p-2.5">
            <div className="h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-8 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ProductCard({
  product,
  currency,
  isArabic,
  isFavorite,
  added,
  onAddToCart,
  onToggleFavorite,
}: {
  product: MenuProduct
  currency: string
  isArabic: boolean
  isFavorite: boolean
  added: boolean
  onAddToCart: (id: string) => void
  onToggleFavorite: (id: string) => void
}) {
  const name = isArabic ? product.nameAr : product.nameEn
  const description = (isArabic ? product.descriptionAr : product.descriptionEn).trim()
  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="relative flex aspect-square items-center justify-center bg-slate-50 p-2 text-5xl dark:bg-slate-800">
        <ProductImage value={product.image} name={name} />
        <button
          type="button"
          onClick={() => onToggleFavorite(product.id)}
          className="absolute top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-red-600 shadow-sm ltr:right-2 rtl:left-2 dark:bg-slate-950"
          aria-label={isArabic ? 'إضافة للمفضلة' : 'Add to favorites'}
        >
          <Heart className={`h-4 w-4 ${isFavorite ? 'fill-red-600' : ''}`} />
        </button>
      </div>
      <div className="space-y-2 p-2.5">
        <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-5">{name}</h3>
        <p className="line-clamp-2 min-h-9 text-xs leading-4 text-slate-500 dark:text-slate-400">
          {description || (isArabic ? 'وصف المنتج غير متوفر حاليا.' : 'Product description is not available yet.')}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500"><Star className="inline h-3 w-3 fill-amber-400 text-amber-400" /> {product.rating || 0}</span>
          <span className="text-sm font-bold text-red-600">{Number(product.price || 0).toFixed(2)} {currency}</span>
        </div>
        <Button size="sm" className="h-8 w-full gap-1 bg-red-600 text-xs hover:bg-red-700" onClick={() => onAddToCart(product.id)}>
          <Plus className="h-3.5 w-3.5" />
          {added ? (isArabic ? 'تمت' : 'Added') : (isArabic ? 'إضافة' : 'Add')}
        </Button>
      </div>
    </article>
  )
}

function ProductImage({ value, name }: { value: string; name: string }) {
  const [failed, setFailed] = useState(false)
  if (isDisplayableImage(value) && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={value} alt={name} className="h-full w-full object-contain" onError={() => setFailed(true)} />
  }
  return <span>{value || '🍽️'}</span>
}

function CartToast({ message, isArabic }: { message: string; isArabic: boolean }) {
  return (
    <div className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border border-green-200 bg-white p-3 shadow-xl sm:p-4 dark:border-green-900 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-green-700 dark:text-green-300">{message}</p>
        <Link href={ROUTES.CART} className="shrink-0 rounded-md bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 sm:text-sm">
          {isArabic ? 'عرض السلة' : 'View Cart'}
        </Link>
      </div>
    </div>
  )
}
