export const ORDER_STATUSES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  READY_FOR_DELIVERY: 'ready_for_delivery',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
  REFUNDED: 'refunded',
}

export const ORDER_STATUS_LABELS = {
  placed: 'تم إنشاء الطلب',
  pending: 'قيد الانتظار',
  confirmed: 'مؤكد',
  preparing: 'جاري التحضير',
  ready_for_delivery: 'جاهز للتوصيل',
  out_for_delivery: 'في الطريق',
  delivered: 'تم التسليم واكتمال الطلب',
  received: 'مكتمل',
  cancelled: 'ملغى',
  rejected: 'مرفوض',
  refunded: 'مسترد',
}

export const ORDER_STATUS_LABELS_EN = {
  placed: 'Placed',
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready_for_delivery: 'Ready for Delivery',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered and Completed',
  received: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  refunded: 'Refunded',
}

export const PAYMENT_METHODS = {
  CASH: 'cash',
  VODAFONE_CASH: 'vodafone_cash',
  INSTAPAY: 'instapay',
  OFFERS: 'offers',
}

export const PAYMENT_METHOD_LABELS = {
  cash: 'الدفع عند الاستلام',
  vodafone_cash: 'Vodafone Cash',
  instapay: 'InstaPay',
  offers: 'عروض',
}

export const PAYMENT_METHOD_LABELS_EN = {
  cash: 'Cash on Delivery',
  vodafone_cash: 'Vodafone Cash',
  instapay: 'InstaPay',
  offers: 'Offers',
}

export const PAYMENT_METHOD_OPTIONS = [
  { value: PAYMENT_METHODS.CASH, ar: 'الدفع عند الاستلام', en: 'Cash on Delivery', arHint: 'ادفع نقدا عند استلام الطلب.', enHint: 'Pay in cash when the order arrives.', requiresReceipt: false },
  { value: PAYMENT_METHODS.VODAFONE_CASH, ar: 'Vodafone Cash', en: 'Vodafone Cash', arHint: 'حوّل المبلغ وارفع صورة الإيصال.', enHint: 'Transfer the amount and upload the receipt.', requiresReceipt: true },
  { value: PAYMENT_METHODS.INSTAPAY, ar: 'InstaPay', en: 'InstaPay', arHint: 'حوّل المبلغ وارفع صورة الإيصال.', enHint: 'Transfer the amount and upload the receipt.', requiresReceipt: true },
  { value: PAYMENT_METHODS.OFFERS, ar: 'عروض', en: 'Offers', arHint: 'خصم من العروض المتاحة.', enHint: 'Discount from available offers.', requiresReceipt: false },
] as const

export const VODAFONE_CASH_NUMBER = process.env.NEXT_PUBLIC_VODAFONE_CASH_NUMBER || '01090886364'
export const INSTAPAY_NUMBER = process.env.NEXT_PUBLIC_INSTAPAY_NUMBER || '01090886364'

export const SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || 'ca.markode@gmail.com'
export const DASHBOARD_ACCESS_EMAILS = Array.from(
  new Set(
    [
      SUPER_ADMIN_EMAIL,
      'ca.markode@gmailcom',
      ...(process.env.NEXT_PUBLIC_DASHBOARD_ACCESS_EMAILS || '')
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean),
    ].map((email) => email.toLowerCase())
  )
)

export const APP_NAME_AR = process.env.NEXT_PUBLIC_APP_NAME_AR || 'رانش'
export const APP_NAME_EN = process.env.NEXT_PUBLIC_APP_NAME_EN || 'Ranch'
export const APP_NAME = APP_NAME_AR

export const SITE_TAGLINE_AR = 'طلب طعام سريع وتتبع لحظي'
export const SITE_DESCRIPTION_AR =
  'رانش تجربة طلب طعام عصرية تجمع الوجبات الطازجة، العروض الحصرية، الدفع المرن، وتتبع الطلب لحظة بلحظة من التحضير حتى الاستلام.'
export const SITE_DESCRIPTION_EN =
  'Ranch is a smart restaurant ordering platform with real-time order tracking, POS-ready order intake, fast delivery workflows, and a polished customer experience.'

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const CURRENCY = 'ج.م'
export const CURRENCY_EN = 'EGP'

export const ROUTES = {
  HOME: '/',
  MENU: '/menu',
  CART: '/cart',
  CHECKOUT: '/checkout',
  LOGIN: '/login',
  REGISTER: '/register',
  PROFILE: '/profile',
  ORDERS: '/orders',
  FAVORITES: '/favorites',
  TRACK_ORDER: '/track',
  COMPLAINTS: '/complaints',
  DASHBOARD: '/dashboard',
  DASHBOARD_ORDERS: '/dashboard/orders',
  DASHBOARD_RESTAURANT_ORDERS: '/dashboard/restaurant-orders',
  DASHBOARD_TEAM: '/dashboard/team',
  DASHBOARD_CUSTOMERS: '/dashboard/customers',
  DASHBOARD_CATEGORIES: '/dashboard/categories',
  DASHBOARD_PRODUCTS: '/dashboard/products',
  DASHBOARD_REPORTS: '/dashboard/reports',
  DASHBOARD_PAYMENTS: '/dashboard/payments',
  DASHBOARD_NOTIFICATIONS: '/dashboard/notifications',
  DASHBOARD_DELIVERY: '/dashboard/delivery',
  DASHBOARD_SETTINGS: '/dashboard/settings',
  DASHBOARD_POS: '/dashboard/pos',
  DASHBOARD_EXPENSES: '/dashboard/expenses',
  DASHBOARD_DRIVER_CLOSING: '/dashboard/driver-closing',
  DASHBOARD_DAILY_CLOSING: '/dashboard/daily-closing',
  DASHBOARD_CLOSINGS: '/dashboard/closings',
}
