export interface MenuCategory {
  id: string
  nameAr: string
  nameEn: string
  active: boolean
}

export interface MenuProduct {
  id: string
  nameAr: string
  nameEn: string
  descriptionAr: string
  descriptionEn: string
  categoryId: string
  price: number
  image: string
  rating: number
  reviews: number
  preparationTime: number
  available: boolean
  bestSeller: boolean
}

export interface AppSettings {
  restaurantNameAr: string
  restaurantNameEn: string
  email: string
  phone: string
  addressAr: string
  addressEn: string
  heroTitleAr: string
  heroTitleEn: string
  heroSubtitleAr: string
  heroSubtitleEn: string
  heroImage: string
  deliveryFee: number
  taxRate: number
  deliveryTime: number
  defaultLanguage: 'ar' | 'en'
}

export const defaultCategories: MenuCategory[] = []

export const defaultProducts: MenuProduct[] = []

export const defaultSettings: AppSettings = {
  restaurantNameAr: 'رانش',
  restaurantNameEn: 'Ranch',
  email: 'info@ranch.app',
  phone: '01000000000',
  addressAr: 'القاهرة، مصر',
  addressEn: 'Cairo, Egypt',
  heroTitleAr: 'اطلب وجبتك المفضلة من رانش',
  heroTitleEn: 'Order your favorite meal from Ranch',
  heroSubtitleAr: 'وجبات طازجة، توصيل سريع، وتتبع مباشر من لحظة الطلب حتى الاستلام.',
  heroSubtitleEn: 'Fresh meals, fast delivery, and live tracking from order to doorstep.',
  heroImage: '/favicon.png',
  deliveryFee: 29.99,
  taxRate: 0.1,
  deliveryTime: 30,
  defaultLanguage: 'ar',
}
