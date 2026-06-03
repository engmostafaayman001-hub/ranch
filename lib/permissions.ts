import { UserRole, Permission } from './types'

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [
    'dashboard_access',
    'team_management',
    'orders_view',
    'orders_edit',
    'products_manage',
    'customers_view',
    'reports_view',
    'settings_edit',
    'pos_manage',
    'payments_verify',
    'notifications_send',
  ],
  admin: [
    'dashboard_access',
    'team_management',
    'orders_view',
    'orders_edit',
    'products_manage',
    'customers_view',
    'reports_view',
    'settings_edit',
    'pos_manage',
    'payments_verify',
    'notifications_send',
  ],
  manager: [
    'dashboard_access',
    'orders_view',
    'orders_edit',
    'products_manage',
    'customers_view',
    'reports_view',
  ],
  cashier: ['dashboard_access', 'orders_view', 'payments_verify'],
  delivery: ['dashboard_access', 'orders_view'],
  support: ['dashboard_access', 'customers_view'],
  customer: [],
}

export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  cashier: 'Cashier',
  delivery: 'Delivery',
  support: 'Support',
  customer: 'Customer',
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  super_admin: 'Full system access and team management',
  admin: 'Complete restaurant management',
  manager: 'Orders, inventory, and reports',
  cashier: 'Orders and payment processing',
  delivery: 'Delivery orders only',
  support: 'Customer support',
  customer: 'Customer account',
}

export function hasPermission(
  role: UserRole,
  permission: Permission
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

export function canAccessDashboard(role: UserRole): boolean {
  return hasPermission(role, 'dashboard_access')
}

export function canManageTeam(role: UserRole): boolean {
  return hasPermission(role, 'team_management')
}

export function canViewOrders(role: UserRole): boolean {
  return hasPermission(role, 'orders_view')
}

export function canEditOrders(role: UserRole): boolean {
  return hasPermission(role, 'orders_edit')
}

export function canManageProducts(role: UserRole): boolean {
  return hasPermission(role, 'products_manage')
}

export function canViewCustomers(role: UserRole): boolean {
  return hasPermission(role, 'customers_view')
}

export function canViewReports(role: UserRole): boolean {
  return hasPermission(role, 'reports_view')
}

export function canVerifyPayments(role: UserRole): boolean {
  return hasPermission(role, 'payments_verify')
}
