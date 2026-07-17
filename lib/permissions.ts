// lib/permissions.ts

// Define the user roles using a simple enum-like object.
// These are the new, simplified roles for the entire application.
export const UserRole = {
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor',
  CASHIER: 'cashier',
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
  [UserRole.ADMIN]: [
    // Admin has all permissions, granted implicitly by the SYSTEM_ADMIN permission.
    Permission.SYSTEM_ADMIN,
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
};

// Display names for roles, useful for UI components.
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  [UserRole.ADMIN]: 'المدير',
  [UserRole.SUPERVISOR]: 'المشرف',
  [UserRole.CASHIER]: 'الكاشير',
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
