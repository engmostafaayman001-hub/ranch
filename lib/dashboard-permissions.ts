import { ROUTES } from '@/lib/constants'

export const DASHBOARD_ROLES = ['super_admin', 'admin', 'supervisor', 'cashier'] as const

export const DASHBOARD_ROUTE_ROLES: Record<string, readonly string[]> = {
  [ROUTES.DASHBOARD]: ['super_admin', 'admin'],
  [ROUTES.DASHBOARD_ORDERS]: ['super_admin', 'admin', 'cashier'],
  [ROUTES.DASHBOARD_RESTAURANT_ORDERS]: ['super_admin', 'admin', 'cashier'],
  [ROUTES.DASHBOARD_CATEGORIES]: ['super_admin', 'admin', 'supervisor', 'cashier'],
  [ROUTES.DASHBOARD_PRODUCTS]: ['super_admin', 'admin', 'supervisor', 'cashier'],
  [ROUTES.DASHBOARD_CUSTOMERS]: ['super_admin', 'admin', 'supervisor'],
  [ROUTES.DASHBOARD_TEAM]: ['super_admin', 'admin'],
  [ROUTES.DASHBOARD_DELIVERY]: ['super_admin', 'admin', 'cashier'],
  [ROUTES.DASHBOARD_PAYMENTS]: ['super_admin', 'admin', 'cashier'],
  [ROUTES.DASHBOARD_NOTIFICATIONS]: ['super_admin', 'admin', 'supervisor'],
  [ROUTES.DASHBOARD_POS]: ['super_admin', 'admin', 'cashier'],
  [ROUTES.DASHBOARD_EXPENSES]: ['super_admin', 'admin', 'cashier'],
  [ROUTES.DASHBOARD_REPORTS]: ['super_admin', 'admin'],
  [ROUTES.DASHBOARD_SETTINGS]: ['super_admin', 'admin', 'supervisor', 'cashier'],
  [ROUTES.DASHBOARD_DRIVER_CLOSING]: ['super_admin', 'admin', 'cashier'],
  [ROUTES.DASHBOARD_DAILY_CLOSING]: ['super_admin', 'admin', 'cashier'],
  [ROUTES.DASHBOARD_CLOSINGS]: ['super_admin', 'admin', 'cashier'],
}

export function getDefaultDashboardRouteForRole(role: string | null | undefined) {
  switch (role) {
    case 'cashier':
      return ROUTES.DASHBOARD_POS
    case 'supervisor':
      return ROUTES.DASHBOARD_PRODUCTS
    case 'super_admin':
    case 'admin':
      return ROUTES.DASHBOARD
    default:
      return '/unauthorized'
  }
}

export function canRoleOpenDashboardRoute(role: string | null | undefined, pathname: string) {
  if (!role) return false
  const normalizedPath = pathname || '/'
  const route = Object.keys(DASHBOARD_ROUTE_ROLES)
    .filter((href) => normalizedPath === href || normalizedPath.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0]

  if (!route) {
    if (normalizedPath === '/dashboard' || normalizedPath.startsWith('/dashboard/')) {
      return role === 'super_admin' || role === 'admin' || role === 'supervisor' || role === 'cashier'
    }
    return false
  }

  const roles = DASHBOARD_ROUTE_ROLES[route]
  return roles.includes(role)
}
