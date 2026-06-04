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
  offerImages: string[]
  workingHoursAr: string
  workingHoursEn: string
  deliveryFee: number
  taxRate: number
  deliveryTime: number
  defaultLanguage: 'ar' | 'en'
  printerMethod: 'browser' | 'usb' | 'bluetooth' | 'network'
  printerName: string
  printerIp: string
  printerPaperWidth: '58mm' | '80mm'
  invoiceNameAr: string
  invoiceNameEn: string
  invoiceQrUrl: string
  invoiceWelcomeAr: string
  invoiceWelcomeEn: string
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
  offerImages: [],
  workingHoursAr: 'يوميا من 10 صباحا إلى 12 منتصف الليل',
  workingHoursEn: 'Daily from 10 AM to 12 AM',
  deliveryFee: 29.99,
  taxRate: 0.1,
  deliveryTime: 30,
  defaultLanguage: 'ar',
  printerMethod: 'browser',
  printerName: '',
  printerIp: '',
  printerPaperWidth: '80mm',
  invoiceNameAr: 'رانش',
  invoiceNameEn: 'Ranch',
  invoiceQrUrl: '',
  invoiceWelcomeAr: 'شكرا لطلبك من رانش. نتمنى لك يوما سعيدا.',
  invoiceWelcomeEn: 'Thank you for ordering from Ranch. Have a great day.',
}
