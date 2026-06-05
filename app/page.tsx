'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Heart, Plus, Search, SlidersHorizontal, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Navbar } from '@/components/navbar'
import { Sidebar } from '@/components/sidebar'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN, ROUTES } from '@/lib/constants'
import { MenuProduct, useAppStore } from '@/lib/app-store'
import { useAuthStore } from '@/lib/store'
import { useSharedAppData } from '@/lib/use-shared-app-data'
import { isDisplayableImage } from '@/lib/client-images'

export default function Home() {
  const { loading: sharedLoading } = useSharedAppData()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [cartMessage, setCartMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeOffer, setActiveOffer] = useState(0)
  const { isLoggedIn, logout } = useAuthStore()
  const { language, appName } = useLanguage()
  const { categories, products, settings, favoriteProductIds, addToCart, toggleFavoriteProduct } = useAppStore()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN
  const activeCategories = categories.filter((category) => category.active)
  const availableProducts = products.filter((product) => product.available)
  const offerImages = (settings.offerImages || []).filter(Boolean)

  useEffect(() => {
    if (offerImages.length <= 1) return
    const interval = window.setInterval(() => {
      setActiveOffer((current) => (current + 1) % offerImages.length)
    }, 3500)
    return () => window.clearInterval(interval)
  }, [offerImages.length])

  const searchedProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return availableProducts
    return availableProducts.filter((product) => {
      const name = isArabic ? product.nameAr : product.nameEn
      const description = isArabic ? product.descriptionAr : product.descriptionEn
      return `${name} ${description}`.toLowerCase().includes(term)
    })
  }, [availableProducts, isArabic, searchTerm])

  const bestSellers = searchedProducts.filter((product) => product.bestSeller).slice(0, 6)
  const randomProducts = useMemo(() => {
    return [...searchedProducts]
      .filter((product) => !bestSellers.some((best) => best.id === product.id))
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, 8)
  }, [bestSellers, searchedProducts])

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
    <main className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isLoggedIn={isLoggedIn} onLogout={handleLogout} />
      <Navbar onMenuOpen={() => setSidebarOpen(true)} isLoggedIn={isLoggedIn} onLogout={handleLogout} />
      {cartMessage && <CartToast message={cartMessage} isArabic={isArabic} />}

      <section className="mx-auto w-full max-w-7xl space-y-5 px-3 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="flex h-11 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={isArabic ? 'ابحث عن منتج' : 'Search food'}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <Link href={ROUTES.MENU}>
            <Button size="icon" className="h-11 w-11 bg-red-600 hover:bg-red-700" title={isArabic ? 'القائمة' : 'Menu'}>
              <SlidersHorizontal className="h-5 w-5" />
            </Button>
          </Link>
        </div>

        <OfferSlider images={offerImages} active={activeOffer} title={isArabic ? settings.heroTitleAr : settings.heroTitleEn} isArabic={isArabic} />

        <SectionHeader title={isArabic ? 'الأقسام' : 'Categories'} href={ROUTES.MENU} isArabic={isArabic} />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sharedLoading && activeCategories.length === 0 ? (
            <CategorySkeleton />
          ) : activeCategories.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              {isArabic ? 'لا توجد أقسام بعد.' : 'No categories yet.'}
            </p>
          ) : activeCategories.map((category) => (
            <Link
              key={category.id}
              href={`${ROUTES.MENU}?category=${category.id}`}
              className="shrink-0 rounded-md border border-red-100 bg-white px-4 py-2 text-sm font-semibold text-red-600 shadow-sm dark:border-red-950 dark:bg-slate-900"
            >
              {isArabic ? category.nameAr : category.nameEn}
            </Link>
          ))}
        </div>

        <ProductSection
          title={isArabic ? 'الأكثر مبيعا' : 'Best Sellers'}
          emptyText={isArabic ? 'لا توجد منتجات أكثر مبيعا بعد.' : 'No best sellers yet.'}
          products={bestSellers.length ? bestSellers : searchedProducts.slice(0, 4)}
          loading={sharedLoading && products.length === 0}
          currency={currency}
          isArabic={isArabic}
          favoriteProductIds={favoriteProductIds}
          onAddToCart={handleAddToCart}
          onToggleFavorite={toggleFavoriteProduct}
        />

        <ProductSection
          title={isArabic ? 'منتجات من القائمة' : 'Menu Picks'}
          emptyText={isArabic ? 'لا توجد منتجات منشورة بعد.' : 'No published products yet.'}
          products={randomProducts}
          loading={sharedLoading && products.length === 0}
          currency={currency}
          isArabic={isArabic}
          favoriteProductIds={favoriteProductIds}
          onAddToCart={handleAddToCart}
          onToggleFavorite={toggleFavoriteProduct}
        />
      </section>

      <section className="bg-white py-8 dark:bg-slate-900">
        <div className="mx-auto grid max-w-7xl gap-3 px-3 text-sm text-slate-600 sm:px-6 md:grid-cols-3 lg:px-8 dark:text-slate-300">
          <InfoLine title={isArabic ? 'التوصيل' : 'Delivery'} value={isArabic ? `${settings.deliveryTime} دقيقة تقريبا` : `About ${settings.deliveryTime} minutes`} />
          <InfoLine title={isArabic ? 'أوقات العمل' : 'Working Hours'} value={isArabic ? settings.workingHoursAr : settings.workingHoursEn} />
          <InfoLine title={isArabic ? 'الدعم' : 'Support'} value={`${settings.phone} - ${settings.email}`} />
        </div>
      </section>

      <footer className="bg-slate-900 py-8 text-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 text-center text-slate-400 sm:px-6 lg:grid-cols-3 lg:px-8 lg:text-start">
          <p>&copy; 2026 {appName}. {isArabic ? 'جميع الحقوق محفوظة' : 'All rights reserved'}.</p>
          <p>{isArabic ? settings.addressAr : settings.addressEn}</p>
          <p>{settings.phone} - {isArabic ? settings.workingHoursAr : settings.workingHoursEn}</p>
        </div>
      </footer>

    </main>
  )
}

function OfferSlider({ images, active, title, isArabic }: { images: string[]; active: number; title: string; isArabic: boolean }) {
  const image = images[active] || ''
  const [failedImage, setFailedImage] = useState('')
  const canShowImage = isDisplayableImage(image) && failedImage !== image
  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-900 shadow-sm dark:border-slate-800">
      <div className="aspect-[16/7] min-h-36 w-full sm:aspect-[21/8]">
        {canShowImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={title} className="h-full w-full object-cover" onError={() => setFailedImage(image)} />
        ) : (
          <div className="flex h-full items-center justify-center bg-red-50 text-7xl dark:bg-red-950">{image || '🍽️'}</div>
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-transparent" />
      <div className="absolute bottom-4 left-4 right-4 max-w-sm text-white rtl:text-right">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">{isArabic ? 'عرض خاص' : 'Special Offer'}</p>
        <h1 className="mt-1 line-clamp-2 text-xl font-bold sm:text-3xl">{title}</h1>
        <Link href={ROUTES.MENU}>
          <Button size="sm" className="mt-3 bg-red-600 hover:bg-red-700">{isArabic ? 'اطلب الآن' : 'Order Now'}</Button>
        </Link>
      </div>
      {images.length > 1 && (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
          {images.map((_, index) => (
            <span key={index} className={`h-1.5 rounded-full transition-all ${index === active ? 'w-5 bg-red-500' : 'w-1.5 bg-white/70'}`} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProductSection(props: {
  title: string
  emptyText: string
  products: MenuProduct[]
  currency: string
  isArabic: boolean
  favoriteProductIds: string[]
  onAddToCart: (id: string) => void
  onToggleFavorite: (id: string) => void
  loading?: boolean
}) {
  return (
    <section>
      <SectionHeader title={props.title} href={ROUTES.MENU} isArabic={props.isArabic} />
      {props.loading ? (
        <ProductGridSkeleton />
      ) : props.products.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">{props.emptyText}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {props.products.map((product) => (
            <ProductCard key={product.id} product={product} {...props} />
          ))}
        </div>
      )}
    </section>
  )
}

function CategorySkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <span key={index} className="h-10 w-24 shrink-0 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
      ))}
    </>
  )
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 6 }).map((_, index) => (
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
  favoriteProductIds,
  onAddToCart,
  onToggleFavorite,
}: {
  product: MenuProduct
  currency: string
  isArabic: boolean
  favoriteProductIds: string[]
  onAddToCart: (id: string) => void
  onToggleFavorite: (id: string) => void
}) {
  const name = isArabic ? product.nameAr : product.nameEn
  const isFavorite = favoriteProductIds.includes(product.id)
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
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500"><Star className="inline h-3 w-3 fill-amber-400 text-amber-400" /> {product.rating || 0}</span>
          <span className="text-sm font-bold text-red-600">{Number(product.price || 0).toFixed(2)} {currency}</span>
        </div>
        <Button size="sm" className="h-8 w-full gap-1 bg-red-600 text-xs hover:bg-red-700" onClick={() => onAddToCart(product.id)}>
          <Plus className="h-3.5 w-3.5" />
          {isArabic ? 'إضافة' : 'Add'}
        </Button>
      </div>
    </article>
  )
}

function SectionHeader({ title, href, isArabic }: { title: string; href: string; isArabic: boolean }) {
  return (
    <div className="mb-3 mt-5 flex items-center justify-between">
      <h2 className="text-base font-bold sm:text-xl">{title}</h2>
      <Link href={href} className="text-xs font-semibold text-red-600 hover:text-red-700">{isArabic ? 'عرض الكل' : 'View all'}</Link>
    </div>
  )
}

function InfoLine({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <p className="font-semibold text-slate-950 dark:text-white">{title}</p>
      <p className="mt-1">{value}</p>
    </div>
  )
}

function CartToast({ message, isArabic }: { message: string; isArabic: boolean }) {
  return (
    <div className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border border-green-200 bg-white p-4 shadow-xl dark:border-green-900 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-green-700 dark:text-green-300">{message}</p>
        <Link href={ROUTES.CART} className="shrink-0 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700">
          {isArabic ? 'عرض السلة' : 'View Cart'}
        </Link>
      </div>
    </div>
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
