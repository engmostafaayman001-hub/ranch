'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sidebar } from '@/components/sidebar'
import { useAuthStore } from '@/lib/store'
import { ROUTES, CURRENCY, CURRENCY_EN } from '@/lib/constants'
import { useLanguage } from '@/components/language-provider'
import { Logo } from '@/components/logo'

interface Product {
  id: string
  name: string
  description: string
  price: number
  category: string
  image?: string
  rating: number
  reviews: number
  preparationTime: number
  available: boolean
}

const catalogProducts: Product[] = [
  {
    id: '1',
    name: 'برجر كلاسيكي',
    description: 'قطعة لحم بقري طازة مع خس وطماطم وصلصة خاصة',
    price: 89.99,
    category: 'برجرز',
    rating: 4.5,
    reviews: 128,
    preparationTime: 15,
    available: true,
  },
  {
    id: '2',
    name: 'برجر الدجاج رانش',
    description: 'صدر دجاج مشوي مع صلصة الرانش والبيكون',
    price: 99.99,
    category: 'برجرز',
    rating: 4.7,
    reviews: 256,
    preparationTime: 18,
    available: true,
  },
  {
    id: '3',
    name: 'بيتزا برونتشيتا',
    description: 'جبنة موزاريلا طازة وصلصة الطماطم والبيبروني المقرمش',
    price: 129.99,
    category: 'بيتزا',
    rating: 4.6,
    reviews: 342,
    preparationTime: 20,
    available: true,
  },
  {
    id: '4',
    name: 'بيتزا الخضار',
    description: 'فلفل وفطر وزيتون وخضروات طازة',
    price: 109.99,
    category: 'بيتزا',
    rating: 4.3,
    reviews: 89,
    preparationTime: 18,
    available: true,
  },
  {
    id: '5',
    name: 'سلطة سيزر',
    description: 'خس روماني مقرمش وجبنة بارميزان وصلصة سيزر محلية الصنع',
    price: 79.99,
    category: 'سلطات',
    rating: 4.4,
    reviews: 167,
    preparationTime: 10,
    available: true,
  },
  {
    id: '6',
    name: 'سمك مشوي',
    description: 'سمك سلمون طازة مشوي مع صلصة الليمون والزبدة',
    price: 159.99,
    category: 'بحريات',
    rating: 4.8,
    reviews: 234,
    preparationTime: 22,
    available: true,
  },
  {
    id: '7',
    name: 'أجنحة الدجاج المقرمشة',
    description: 'أجنحة مقرمشة مع خيارات صلصة متعددة',
    price: 69.99,
    category: 'مقبلات',
    rating: 4.5,
    reviews: 512,
    preparationTime: 12,
    available: true,
  },
  {
    id: '8',
    name: 'كعكة الشوكولاتة',
    description: 'كعكة شوكولاتة غنية مع طلاء الشوكولاتة',
    price: 49.99,
    category: 'حلويات',
    rating: 4.9,
    reviews: 623,
    preparationTime: 5,
    available: true,
  },
]

const productEnglish: Record<string, { name: string; description: string; category: string }> = {
  '1': { name: 'Classic Burger', description: 'Fresh beef patty with lettuce, tomato, and signature sauce', category: 'Burgers' },
  '2': { name: 'Ranch Chicken Burger', description: 'Grilled chicken breast with ranch sauce and crispy toppings', category: 'Burgers' },
  '3': { name: 'Pepperoni Pizza', description: 'Fresh mozzarella, tomato sauce, and crispy pepperoni', category: 'Pizza' },
  '4': { name: 'Veggie Pizza', description: 'Peppers, mushrooms, olives, and fresh vegetables', category: 'Pizza' },
  '5': { name: 'Caesar Salad', description: 'Crisp romaine, parmesan, and house Caesar dressing', category: 'Salads' },
  '6': { name: 'Grilled Fish', description: 'Fresh grilled salmon with lemon butter sauce', category: 'Seafood' },
  '7': { name: 'Crispy Chicken Wings', description: 'Crispy wings with multiple sauce choices', category: 'Starters' },
  '8': { name: 'Chocolate Cake', description: 'Rich chocolate cake with chocolate glaze', category: 'Desserts' },
}

export default function MenuPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [cart, setCart] = useState<{ id: string; quantity: number }[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [mounted, setMounted] = useState(false)
  const { isLoggedIn, logout } = useAuthStore()
  const { language, appName, t } = useLanguage()
  const isArabic = language === 'ar'
  const currency = isArabic ? CURRENCY : CURRENCY_EN

  useEffect(() => {
    setMounted(true)
  }, [])

  const categories = ['all', ...new Set(catalogProducts.map((p) => p.category))]

  const filteredProducts = catalogProducts.filter((product) => {
    const english = productEnglish[product.id]
    const name = isArabic ? product.name : english.name
    const description = isArabic ? product.description : english.description
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      description.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const addToCart = (productId: string) => {
    const existing = cart.find((item) => item.id === productId)
    if (existing) {
      setCart(cart.map((item) =>
        item.id === productId ? { ...item, quantity: item.quantity + 1 } : item
      ))
    } else {
      setCart([...cart, { id: productId, quantity: 1 }])
    }
  }

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  if (!mounted) return null

  const handleLogout = () => {
    logout()
    setSidebarOpen(false)
  }

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

            <div className="hidden lg:flex items-center gap-4">
              {isLoggedIn && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  ✓ {isArabic ? 'تم تسجيل الدخول' : 'Logged in'}
                </span>
              )}
              <Link href={ROUTES.CART}>
                <Button variant="ghost" className="relative">
                  🛒 {t('cart')}
                  {cartCount > 0 && (
                    <Badge className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center p-0">
                      {cartCount}
                    </Badge>
                  )}
                </Button>
              </Link>
            </div>

            <div className="lg:hidden flex items-center gap-2">
              {cartCount > 0 && (
                <Badge className="bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center p-0 text-xs">
                  {cartCount}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Bar */}
        <div className="mb-8">
          <input
            type="text"
            placeholder={isArabic ? 'ابحث في القائمة...' : 'Search the menu...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-red-600"
          />
        </div>

        {/* Category Filter */}
        <div className="mb-8 flex gap-2 overflow-x-auto pb-2 flex-row-reverse">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              className={selectedCategory === category ? 'bg-red-600' : ''}
              onClick={() => setSelectedCategory(category)}
            >
              {category === 'all'
                ? (isArabic ? 'الكل' : 'All')
                : (isArabic ? category : productEnglish[catalogProducts.find((p) => p.category === category)?.id || '']?.category || category)}
            </Button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => {
            const english = productEnglish[product.id]
            return (
              <Card key={product.id} className="hover:shadow-lg transition-shadow">
                <div className="w-full h-48 bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900 dark:to-orange-900 flex items-center justify-center text-6xl">
                  🍔
                </div>
                <CardContent className="pt-4">
                  <h3 className="font-bold text-lg mb-2">{isArabic ? product.name : english.name}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    {isArabic ? product.description : english.description}
                  </p>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-lg text-red-600">{product.price} {currency}</span>
                    <div className="flex items-center text-sm">
                      <span className="text-yellow-500">⭐</span>
                      <span className="ml-1">{product.rating}</span>
                      <span className="text-slate-500 ml-1">({product.reviews})</span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 mb-4">
                    ⏱ {product.preparationTime} {isArabic ? 'دقيقة' : 'min'}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={() => addToCart(product.id)}
                    disabled={!product.available}
                    className="w-full bg-red-600 hover:bg-red-700"
                  >
                    {product.available ? (isArabic ? 'إضافة للسلة' : 'Add to Cart') : (isArabic ? 'غير متاح' : 'Unavailable')}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              {isArabic ? 'لم يتم العثور على منتجات. حاول تعديل المرشحات.' : 'No products found. Try adjusting your filters.'}
            </p>
          </div>
        )}
      </div>
    </main>
  )
}

