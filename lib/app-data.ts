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

export interface DeliveryDriver {
  id: string
  name: string
  email?: string
  phone: string
  area: string
  status: 'active' | 'inactive'
}

export type PrinterMethod = 'bluetooth' | 'usb' | 'network' | 'system'
export type PrinterPaperWidth = '58mm' | '80mm'
export type PrinterRole = 'cashier' | 'kitchen' | 'hall'

export interface PrinterConnection {
  role: PrinterRole
  name: string
  deviceName: string
  deviceId: string
  deviceAddress: string
  method: PrinterMethod
  connectionType?: PrinterMethod
  ip: string
  port: string
  paperWidth: PrinterPaperWidth
  fontScale: number
  retryAttempts: number
  isEnabled: boolean
  lastConnected: string
  lastConnectedMethod?: PrinterMethod | ''
  printsMainInvoice: boolean
  printsQr: boolean
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
  invoiceLogo: string
  workingHoursAr: string
  workingHoursEn: string
  restaurantOpen: boolean
  deliveryFee: number
  taxRate: number
  deliveryTime: number
  defaultLanguage: 'ar' | 'en'
  printerMethod: PrinterMethod
  printerName: string
  printerIp: string
  printerPaperWidth: PrinterPaperWidth
  printers: Record<PrinterRole, PrinterConnection>
  invoiceNameAr: string
  invoiceNameEn: string
  invoiceQrUrl: string
  invoiceQrUrl2: string
  invoiceWelcomeAr: string
  invoiceWelcomeEn: string
  vodafoneCashNumber: string
  instapayNumber: string
}

export const defaultCategories: MenuCategory[] = []

export const defaultProducts: MenuProduct[] = []

export const defaultPrinters: Record<PrinterRole, PrinterConnection> = {
  cashier: {
    role: 'cashier',
    name: 'Cashier Printer',
    deviceName: 'Cashier Printer',
    deviceId: '',
    deviceAddress: '',
    method: 'network',
    ip: '',
    port: '9100',
    paperWidth: '80mm',
    fontScale: 1,
    retryAttempts: 3,
    isEnabled: false,
    lastConnected: '',
    lastConnectedMethod: '',
    printsMainInvoice: true,
    printsQr: true,
  },
  kitchen: {
    role: 'kitchen',
    name: 'Kitchen Printer',
    deviceName: 'Kitchen Printer',
    deviceId: '',
    deviceAddress: '',
    method: 'network',
    ip: '',
    port: '9100',
    paperWidth: '58mm',
    fontScale: 1,
    retryAttempts: 3,
    isEnabled: false,
    lastConnected: '',
    lastConnectedMethod: '',
    printsMainInvoice: false,
    printsQr: false,
  },
  hall: {
    role: 'hall',
    name: 'Hall Printer',
    deviceName: 'Hall Printer',
    deviceId: '',
    deviceAddress: '',
    method: 'network',
    ip: '',
    port: '9100',
    paperWidth: '58mm',
    fontScale: 1,
    retryAttempts: 3,
    isEnabled: false,
    lastConnected: '',
    lastConnectedMethod: '',
    printsMainInvoice: false,
    printsQr: false,
  },
}

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
  invoiceLogo: '',
  workingHoursAr: 'يوميا من 10 صباحا إلى 12 منتصف الليل',
  workingHoursEn: 'Daily from 10 AM to 12 AM',
  restaurantOpen: true,
  deliveryFee: 29.99,
  taxRate: 0.1,
  deliveryTime: 30,
  defaultLanguage: 'ar',
  printerMethod: 'network',
  printerName: '',
  printerIp: '',
  printerPaperWidth: '80mm',
  printers: defaultPrinters,
  invoiceNameAr: 'رانش',
  invoiceNameEn: 'Ranch',
  invoiceQrUrl: '',
  invoiceQrUrl2: '',
  invoiceWelcomeAr: 'شكرا لطلبك من رانش. نتمنى لك يوما سعيدا.',
  invoiceWelcomeEn: 'Thank you for ordering from Ranch. Have a great day.',
  vodafoneCashNumber: '01090886364',
  instapayNumber: '01090886364',
}
