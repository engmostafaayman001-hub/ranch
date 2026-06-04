import { ROUTES } from '@/lib/constants'

export const DASHBOARD_ROLES = ['super_admin', 'admin', 'manager', 'cashier', 'delivery', 'support'] as const

export const DASHBOARD_ROUTE_ROLES: Record<string, readonly string[]> = {
  [ROUTES.DASHBOARD]: DASHBOARD_ROLES,
  [ROUTES.DASHBOARD_ORDERS]: ['super_admin', 'admin', 'manager', 'cashier', 'delivery'],
  [ROUTES.DASHBOARD_RESTAURANT_ORDERS]: ['super_admin', 'admin', 'manager', 'cashier'],
  [ROUTES.DASHBOARD_CATEGORIES]: ['super_admin', 'admin', 'manager'],
  [ROUTES.DASHBOARD_PRODUCTS]: ['super_admin', 'admin', 'manager'],
  [ROUTES.DASHBOARD_CUSTOMERS]: ['super_admin', 'admin', 'manager', 'support'],
  [ROUTES.DASHBOARD_TEAM]: ['super_admin', 'admin'],
  [ROUTES.DASHBOARD_DELIVERY]: ['super_admin', 'admin', 'manager', 'delivery'],
  [ROUTES.DASHBOARD_PAYMENTS]: ['super_admin', 'admin', 'cashier'],
  [ROUTES.DASHBOARD_NOTIFICATIONS]: ['super_admin', 'admin'],
  [ROUTES.DASHBOARD_POS]: ['super_admin', 'admin', 'manager', 'cashier'],
  [ROUTES.DASHBOARD_EXPENSES]: ['super_admin', 'admin', 'manager'],
  [ROUTES.DASHBOARD_REPORTS]: ['super_admin', 'admin', 'manager'],
  [ROUTES.DASHBOARD_SETTINGS]: ['super_admin', 'admin'],
}

export function getDefaultDashboardRouteForRole(role: string | null | undefined) {
  switch (role) {
    case 'cashier':
      return ROUTES.DASHBOARD_POS
    case 'delivery':
      return ROUTES.DASHBOARD_DELIVERY
    case 'support':
      return ROUTES.DASHBOARD_CUSTOMERS
    case 'super_admin':
    case 'admin':
    case 'manager':
      return ROUTES.DASHBOARD
    default:
      return '/unauthorized'
  }
}

export function canRoleOpenDashboardRoute(role: string | null | undefined, pathname: string) {
  if (!role) return false
  const route = Object.keys(DASHBOARD_ROUTE_ROLES)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0]
  const roles = route ? DASHBOARD_ROUTE_ROLES[route] : DASHBOARD_ROLES
  return roles.includes(role)
}
