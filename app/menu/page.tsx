'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Navbar } from '@/components/navbar'
import { Sidebar } from '@/components/sidebar'
import { useLanguage } from '@/components/language-provider'
import { CURRENCY, CURRENCY_EN } from '@/lib/constants'
import { useAppStore } from '@/lib/app-store'
import { useAuthStore } from '@/lib/store'

export default function MenuPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [addedProductId, setAddedProductId] = useState<string | null>(null)
  const { isLoggedIn, logout } = useAuthStore()
  const { language } = useLanguage()
  const { categories, products, addToCart } = useAppStore()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN

  const activeCategories = useMemo(() => categories.filter((category) => category.active), [categories])
  const filteredProducts = products.filter((product) => {
    const name = isArabic ? product.nameAr : product.nameEn
    const description = isArabic ? product.descriptionAr : product.descriptionEn
    return (
      (selectedCategory === 'all' || product.categoryId === selectedCategory) &&
      `${name} ${description}`.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

  const handleAddToCart = (productId: string) => {
    addToCart(productId)
    setAddedProductId(productId)
    window.setTimeout(() => setAddedProductId(null), 1200)
  }

  const handleLogout = () => {
    logout()
    setSidebarOpen(false)
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isLoggedIn={isLoggedIn} onLogout={handleLogout} />
      <Navbar onMenuOpen={() => setSidebarOpen(true)} isLoggedIn={isLoggedIn} onLogout={handleLogout} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <input
          type="text"
          placeholder={isArabic ? 'ابحث في القائمة...' : 'Search the menu...'}
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="mb-8 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-600 dark:border-slate-700 dark:bg-slate-800"
        />

        <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
          <Button variant={selectedCategory === 'all' ? 'default' : 'outline'} className={selectedCategory === 'all' ? 'bg-red-600' : ''} onClick={() => setSelectedCategory('all')}>
            {isArabic ? 'الكل' : 'All'}
          </Button>
          {activeCategories.map((category) => (
            <Button key={category.id} variant={selectedCategory === category.id ? 'default' : 'outline'} className={selectedCategory === category.id ? 'bg-red-600' : ''} onClick={() => setSelectedCategory(category.id)}>
              {isArabic ? category.nameAr : category.nameEn}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {filteredProducts.map((product) => {
            const name = isArabic ? product.nameAr : product.nameEn
            return (
              <Card key={product.id} className="overflow-hidden transition-shadow hover:shadow-lg">
                <div className="relative flex h-48 w-full items-center justify-center bg-gradient-to-br from-red-50 to-amber-50 text-6xl dark:from-red-950 dark:to-slate-900">
                  <ProductImage value={product.image} name={name} />
                  {!product.available && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                      <Badge className="bg-slate-900 text-white">{isArabic ? 'غير متوفر' : 'Unavailable'}</Badge>
                    </div>
                  )}
                </div>
                <CardContent className="pt-4">
                  <h3 className="mb-2 text-lg font-bold">{name}</h3>
                  <p className="mb-3 min-h-12 text-sm text-slate-600 dark:text-slate-400">{isArabic ? product.descriptionAr : product.descriptionEn}</p>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-lg font-bold text-red-600">{product.price} {currency}</span>
                    <div className="text-sm"><span className="text-yellow-500">★</span> {product.rating} <span className="text-slate-500">({product.reviews})</span></div>
                  </div>
                  <div className="text-xs text-slate-500">⏱ {product.preparationTime} {isArabic ? 'دقيقة' : 'min'}</div>
                </CardContent>
                <CardFooter>
                  <Button onClick={() => handleAddToCart(product.id)} disabled={!product.available} className="w-full bg-red-600 hover:bg-red-700">
                    {addedProductId === product.id ? (isArabic ? 'تمت الإضافة' : 'Added') : product.available ? (isArabic ? 'إضافة للسلة' : 'Add to Cart') : (isArabic ? 'غير متوفر' : 'Unavailable')}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-lg text-slate-600 dark:text-slate-400">{isArabic ? 'لا توجد منتجات مطابقة.' : 'No products found.'}</p>
          </div>
        )}
      </div>
    </main>
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
