import {
  BarChart3,
  BellRing,
  CreditCard,
  DollarSign,
  LayoutDashboard,
  Package,
  ReceiptText,
  Settings,
  Store,
  Tags,
  Truck,
  Users,
  UserRoundCog,
} from 'lucide-react'
import { ROUTES } from '@/lib/constants'
import { DASHBOARD_ROLES } from '@/lib/dashboard-permissions'

export const dashboardLinks = [
  { href: ROUTES.DASHBOARD, labelAr: 'نظرة عامة', labelEn: 'Overview', icon: LayoutDashboard, roles: ['super_admin', 'admin'] },
  { href: ROUTES.DASHBOARD_POS, labelAr: 'نقطة البيع', labelEn: 'POS', icon: Store, roles: ['super_admin', 'admin', 'cashier'] },
  { href: ROUTES.DASHBOARD_RESTAURANT_ORDERS, labelAr: 'طلبات المطعم', labelEn: 'Restaurant Orders', icon: Store, roles: ['super_admin', 'admin', 'cashier'] },
  { href: ROUTES.DASHBOARD_ORDERS, labelAr: 'طلبات التطبيق', labelEn: 'App Orders', icon: ReceiptText, roles: ['super_admin', 'admin', 'delivery'] },
  { href: ROUTES.DASHBOARD_EXPENSES, labelAr: 'المصروفات', labelEn: 'Expenses', icon: DollarSign, roles: ['super_admin', 'admin', 'cashier'] },
  { href: ROUTES.DASHBOARD_CATEGORIES, labelAr: 'الأقسام', labelEn: 'Categories', icon: Tags, roles: ['super_admin', 'admin', 'manager', 'supervisor'] },
  { href: ROUTES.DASHBOARD_PRODUCTS, labelAr: 'المنتجات', labelEn: 'Products', icon: Package, roles: ['super_admin', 'admin', 'manager', 'supervisor'] },
  { href: ROUTES.DASHBOARD_NOTIFICATIONS, labelAr: 'العروض والإشعارات', labelEn: 'Offers & Notifications', icon: BellRing, roles: ['super_admin', 'admin', 'manager', 'supervisor'] },
  { href: ROUTES.DASHBOARD_CUSTOMERS, labelAr: 'العملاء', labelEn: 'Customers', icon: Users, roles: ['super_admin', 'admin', 'support'] },
  { href: ROUTES.DASHBOARD_PAYMENTS, labelAr: 'المدفوعات', labelEn: 'Payments', icon: CreditCard, roles: ['super_admin', 'admin'] },
  { href: ROUTES.DASHBOARD_DELIVERY, labelAr: 'السائقون والتوصيل', labelEn: 'Delivery', icon: Truck, roles: ['super_admin', 'admin'] },
  { href: ROUTES.DASHBOARD_TEAM, labelAr: 'الفريق', labelEn: 'Team', icon: UserRoundCog, roles: ['super_admin', 'admin'] },
  { href: ROUTES.DASHBOARD_REPORTS, labelAr: 'التقارير', labelEn: 'Reports', icon: BarChart3, roles: ['super_admin', 'admin'] },
  { href: ROUTES.DASHBOARD_SETTINGS, labelAr: 'الإعدادات', labelEn: 'Settings', icon: Settings, roles: ['super_admin', 'admin'] },
] as const

export type DashboardRole = typeof DASHBOARD_ROLES[number]
