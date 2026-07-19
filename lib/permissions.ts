// lib/permissions.ts


export const UserRole = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  SUPERVISOR: 'supervisor',
  CASHIER: 'cashier',
  DELIVERY: 'delivery',
  SUPPORT: 'support',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// Define a comprehensive list of permissions for granular access control.
export const Permission = {
  // System-level permissions
  SYSTEM_ADMIN: 'system.admin', // Grants all permissions implicitly

  // Dashboard access
  DASHBOARD_VIEW: 'dashboard.view',

  // Point of Sale
  POS_USE: 'pos.use',

  // Order management
  ORDERS_VIEW_ALL: 'orders.view.all',
  ORDERS_VIEW_OWN: 'orders.view.own',
  ORDERS_EDIT: 'orders.edit',
  ORDERS_DELETE: 'orders.delete',
  ORDERS_REOPEN: 'orders.reopen',
  
  // Catalog management
  PRODUCTS_MANAGE: 'products.manage', // Add, edit, delete products & categories
  DISCOUNTS_MANAGE: 'discounts.manage', // Add, edit, delete discounts & offers

  // Customer management
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_MANAGE: 'customers.manage',

  // Reporting
  REPORTS_VIEW_FINANCIAL: 'reports.view.financial', // Profits, revenue
  REPORTS_VIEW_DAILY: 'reports.view.daily',
  REPORTS_VIEW_WEEKLY: 'reports.view.weekly',
  REPORTS_VIEW_MONTHLY: 'reports.view.monthly',
  
  // Closing procedures
  CASHIER_CLOSEOUT: 'cashier.closeout',
  DRIVERS_CLOSEOUT: 'drivers.closeout',

  // Expenses
  EXPENSES_MANAGE: 'expenses.manage',

  // Team management
  TEAM_MANAGE: 'team.manage',

  // Settings
  SETTINGS_MANAGE: 'settings.manage',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

// Map roles to their specific permissions.
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: [
    // Super Admin has all permissions implicitly.
    Permission.SYSTEM_ADMIN,
  ],
  [UserRole.ADMIN]: [
    // Admin has all permissions, granted implicitly by the SYSTEM_ADMIN permission.
    Permission.SYSTEM_ADMIN,
  ],
  [UserRole.MANAGER]: [
    Permission.DASHBOARD_VIEW,
    Permission.PRODUCTS_MANAGE,
    Permission.DISCOUNTS_MANAGE,
    Permission.TEAM_MANAGE,
    Permission.SETTINGS_MANAGE,
  ],
  [UserRole.SUPERVISOR]: [
    Permission.DASHBOARD_VIEW,
    Permission.PRODUCTS_MANAGE,
    Permission.DISCOUNTS_MANAGE,
  ],
  [UserRole.CASHIER]: [
    Permission.DASHBOARD_VIEW,
    Permission.POS_USE,
    Permission.ORDERS_EDIT,
    Permission.CUSTOMERS_VIEW,
    Permission.CASHIER_CLOSEOUT,
    Permission.DRIVERS_CLOSEOUT,
    Permission.EXPENSES_MANAGE,
  ],
  [UserRole.DELIVERY]: [
    Permission.DASHBOARD_VIEW,
    Permission.ORDERS_VIEW_OWN,
  ],
  [UserRole.SUPPORT]: [
    Permission.DASHBOARD_VIEW,
    Permission.CUSTOMERS_VIEW,
    Permission.CUSTOMERS_MANAGE,
  ],
};

// Display names for roles, useful for UI components.
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: 'مسؤول فائق',
  [UserRole.ADMIN]: 'مدير',
  [UserRole.MANAGER]: 'مدير عام',
  [UserRole.SUPERVISOR]: 'مشرف',
  [UserRole.CASHIER]: 'كاشير',
  [UserRole.DELIVERY]: 'مندوب توصيل',
  [UserRole.SUPPORT]: 'دعم العملاء',
};

/**
 * Checks if a user role has a specific permission.
 * The 'admin' role is always granted permission.
 *
 * @param role The role of the user.
 * @param permission The permission to check for.
 * @returns True if the user has the permission, false otherwise.
 */
export function hasPermission(
  role: UserRole | null | undefined,
  permission: Permission
): boolean {
  if (!role) {
    return false;
  }

  const userPermissions = ROLE_PERMISSIONS[role] || [];

  // Admins have all permissions implicitly.
  if (userPermissions.includes(Permission.SYSTEM_ADMIN)) {
    return true;
  }

  // Check if the role has the specific permission.
  return userPermissions.includes(permission);
}

// ============ SPECIFIC PERMISSION CHECKS ============

/**
 * Check if a role can view the dashboard
 */
export function canViewDashboard(role: string | null | undefined): boolean {
  return hasPermission(role as UserRole, Permission.DASHBOARD_VIEW) || role === 'admin' || role === 'super_admin';
}

/**
 * Check if a role can manage orders (edit, update status)
 */
export function canManageOrders(role: string | null | undefined): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'cashier';
}

/**
 * Check if a role can delete orders (only super_admin and admin)
 * This is the only permission needed to delete ANY order regardless of status
 */
export function canDeleteOrders(role: string | null | undefined): boolean {
  return role === 'super_admin' || role === 'admin';
}

/**
 * Check if a role can use the POS system
 */
export function canUsePOS(role: string | null | undefined): boolean {
  return hasPermission(role as UserRole, Permission.POS_USE) || role === 'cashier' || role === 'admin' || role === 'super_admin';
}

/**
 * Check if a role can manage customers
 */
export function canManageCustomers(role: string | null | undefined): boolean {
  return hasPermission(role as UserRole, Permission.CUSTOMERS_MANAGE) || role === 'admin' || role === 'super_admin';
}

/**
 * Check if a role can view customers
 */
export function canViewCustomers(role: string | null | undefined): boolean {
  return canManageCustomers(role) || hasPermission(role as UserRole, Permission.CUSTOMERS_VIEW) || role === 'support';
}

/**
 * Check if a role can manage products
 */
export function canManageProducts(role: string | null | undefined): boolean {
  return hasPermission(role as UserRole, Permission.PRODUCTS_MANAGE) || role === 'manager' || role === 'supervisor' || role === 'admin' || role === 'super_admin';
}

/**
 * Check if a role can manage discounts
 */
export function canManageDiscounts(role: string | null | undefined): boolean {
  return hasPermission(role as UserRole, Permission.DISCOUNTS_MANAGE) || role === 'manager' || role === 'supervisor' || role === 'admin' || role === 'super_admin';
}

/**
 * Check if a role can manage expenses
 */
export function canManageExpenses(role: string | null | undefined): boolean {
  return hasPermission(role as UserRole, Permission.EXPENSES_MANAGE) || role === 'cashier' || role === 'admin' || role === 'super_admin';
}

/**
 * Check if a role can perform cashier closeout
 */
export function canPerformCashierCloseout(role: string | null | undefined): boolean {
  return hasPermission(role as UserRole, Permission.CASHIER_CLOSEOUT) || role === 'cashier' || role === 'admin' || role === 'super_admin';
}

/**
 * Check if a role can perform driver closeout
 */
export function canPerformDriverCloseout(role: string | null | undefined): boolean {
  return hasPermission(role as UserRole, Permission.DRIVERS_CLOSEOUT) || role === 'cashier' || role === 'admin' || role === 'super_admin';
}

/**
 * Check if a role can view financial reports
 */
export function canViewFinancialReports(role: string | null | undefined): boolean {
  return hasPermission(role as UserRole, Permission.REPORTS_VIEW_FINANCIAL) || role === 'manager' || role === 'admin' || role === 'super_admin';
}

/**
 * Check if a role can manage team members
 */
export function canManageTeam(role: string | null | undefined): boolean {
  return hasPermission(role as UserRole, Permission.TEAM_MANAGE) || role === 'manager' || role === 'admin' || role === 'super_admin';
}

/**
 * Check if a role can manage system settings
 */
export function canManageSettings(role: string | null | undefined): boolean {
  return hasPermission(role as UserRole, Permission.SETTINGS_MANAGE) || role === 'manager' || role === 'admin' || role === 'super_admin';
}
