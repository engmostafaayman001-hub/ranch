'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Heart, Plus, ShoppingBag, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Navbar } from '@/components/navbar'
import { Sidebar } from '@/components/sidebar'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN, ROUTES } from '@/lib/constants'
import { MenuProduct, useAppStore } from '@/lib/app-store'
import { useAuthStore } from '@/lib/store'
import { useSharedAppData } from '@/lib/use-shared-app-data'
import { isDisplayableImage } from '@/lib/client-images'

export default function FavoritesPage() {
  const { loading } = useSharedAppData()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [message, setMessage] = useState('')
  const { isLoggedIn, logout } = useAuthStore()
  const { language } = useLanguage()
  const { products, favoriteProductIds, addToCart, toggleFavoriteProduct } = useAppStore()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN

  const favorites = useMemo(
    () => products.filter((product) => favoriteProductIds.includes(product.id) && product.available),
    [favoriteProductIds, products]
  )

  const handleLogout = () => {
    logout()
    setSidebarOpen(false)
  }

  const handleAddToCart = (product: MenuProduct) => {
    addToCart(product.id)
    setMessage(isArabic ? `تمت إضافة ${isArabic ? product.nameAr : product.nameEn} إلى السلة` : `${product.nameEn} added to cart`)
    window.setTimeout(() => setMessage(''), 2200)
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isLoggedIn={isLoggedIn} onLogout={handleLogout} />
      <Navbar onMenuOpen={() => setSidebarOpen(true)} isLoggedIn={isLoggedIn} onLogout={handleLogout} />
      {message && <CartToast message={message} isArabic={isArabic} />}

      <section className="mx-auto max-w-7xl px-3 py-4 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{isArabic ? 'المفضلة' : 'Favorites'}</h1>
            <p className="mt-1 text-sm text-slate-500">{isArabic ? 'المنتجات التي حفظتها للرجوع لها بسرعة.' : 'Products you saved for quick access.'}</p>
          </div>
          <Link href={ROUTES.MENU} className="shrink-0">
            <Button variant="outline" size="sm" className="gap-2"><ShoppingBag className="h-4 w-4" />{isArabic ? 'القائمة' : 'Menu'}</Button>
          </Link>
        </div>

        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            <p className="font-semibold">{isArabic ? 'جاري تحميل المفضلة...' : 'Loading favorites...'}</p>
          </div>
        ) : favorites.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            <Heart className="mx-auto mb-3 h-10 w-10 text-red-500" />
            <p className="font-semibold">{isArabic ? 'لا توجد منتجات في المفضلة بعد.' : 'No favorite products yet.'}</p>
            <Link href={ROUTES.MENU} className="mt-4 inline-block text-sm font-semibold text-red-600">{isArabic ? 'استعرض القائمة' : 'Browse menu'}</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {favorites.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                currency={currency}
                isArabic={isArabic}
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

function ProductCard({
  product,
  currency,
  isArabic,
  onAddToCart,
  onToggleFavorite,
}: {
  product: MenuProduct
  currency: string
  isArabic: boolean
  onAddToCart: (product: MenuProduct) => void
  onToggleFavorite: (id: string) => void
}) {
  const name = isArabic ? product.nameAr : product.nameEn
  const [imageFailed, setImageFailed] = useState(false)
  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="relative flex aspect-square items-center justify-center bg-slate-50 p-2 text-5xl dark:bg-slate-800">
        {isDisplayableImage(product.image) && !imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image} alt={name} className="h-full w-full object-contain" onError={() => setImageFailed(true)} />
        ) : (
          <span>{product.image || '🍽️'}</span>
        )}
        <button
          type="button"
          onClick={() => onToggleFavorite(product.id)}
          className="absolute top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-red-600 shadow-sm ltr:right-2 rtl:left-2 dark:bg-slate-950"
          aria-label={isArabic ? 'إزالة من المفضلة' : 'Remove from favorites'}
        >
          <Heart className="h-4 w-4 fill-red-600" />
        </button>
      </div>
      <div className="space-y-2 p-2.5">
        <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-5">{name}</h3>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500"><Star className="inline h-3 w-3 fill-amber-400 text-amber-400" /> {product.rating || 0}</span>
          <span className="text-sm font-bold text-red-600">{Number(product.price || 0).toFixed(2)} {currency}</span>
        </div>
        <Button size="sm" className="h-8 w-full gap-1 bg-red-600 text-xs hover:bg-red-700" onClick={() => onAddToCart(product)}>
          <Plus className="h-3.5 w-3.5" />
          {isArabic ? 'إضافة' : 'Add'}
        </Button>
      </div>
    </article>
  )
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
