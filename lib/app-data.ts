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
  restaurantNameAr: 'Ø±Ø§Ù†Ø´',
  restaurantNameEn: 'Ranch',
  email: 'info@ranch.app',
  phone: '01000000000',
  addressAr: 'Ø§Ù„Ù‚Ø§Ù‡Ø±Ø©ØŒ Ù…ØµØ±',
  addressEn: 'Cairo, Egypt',
  heroTitleAr: 'Ø§Ø·Ù„Ø¨ ÙˆØ¬Ø¨ØªÙƒ Ø§Ù„Ù…ÙØ¶Ù„Ø© Ù…Ù† Ø±Ø§Ù†Ø´',
  heroTitleEn: 'Order your favorite meal from Ranch',
  heroSubtitleAr: 'ÙˆØ¬Ø¨Ø§Øª Ø·Ø§Ø²Ø¬Ø©ØŒ ØªÙˆØµÙŠÙ„ Ø³Ø±ÙŠØ¹ØŒ ÙˆØªØªØ¨Ø¹ Ù…Ø¨Ø§Ø´Ø± Ù…Ù† Ù„Ø­Ø¸Ø© Ø§Ù„Ø·Ù„Ø¨ Ø­ØªÙ‰ Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù….',
  heroSubtitleEn: 'Fresh meals, fast delivery, and live tracking from order to doorstep.',
  heroImage: '/favicon.png',
  deliveryFee: 29.99,
  taxRate: 0.1,
  deliveryTime: 30,
  defaultLanguage: 'ar',
}
