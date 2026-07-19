// lib/team-roles-and-permissions.ts
// Comprehensive role and permission definitions for the Team management page

export interface RolePermissionGroup {
  category: string
  label: string
  permissions: Array<{
    key: string
    label: string
    description: string
    pages?: string[]
    apis?: string[]
  }>
}

export interface RoleDefinition {
  value: string
  labelAr: string
  labelEn: string
  description: string
  permissionGroups: RolePermissionGroup[]
}

export const TEAM_ROLES: RoleDefinition[] = [
  {
    value: 'super_admin',
    labelAr: 'مسؤول فائق',
    labelEn: 'Super Admin',
    description: 'Full system access',
    permissionGroups: [
      {
        category: 'system',
        label: 'System & Configuration',
        permissions: [
          {
            key: 'system_admin',
            label: 'System Administration',
            description: 'Full access to all system features',
            pages: ['All pages'],
            apis: ['All APIs'],
          },
        ],
      },
    ],
  },
  {
    value: 'admin',
    labelAr: 'مدير',
    labelEn: 'Admin',
    description: 'Administrative access with full permissions',
    permissionGroups: [
      {
        category: 'orders',
        label: 'Order Management',
        permissions: [
          {
            key: 'orders_view_all',
            label: 'View All Orders',
            description: 'View orders from all sources (app, restaurant, delivery)',
            pages: ['/dashboard/orders', '/dashboard/restaurant-orders', '/dashboard/payments'],
            apis: ['/api/pos/orders'],
          },
          {
            key: 'orders_edit',
            label: 'Edit Orders',
            description: 'Edit order details, status, and information',
            pages: ['/dashboard/orders', '/dashboard/restaurant-orders'],
            apis: ['/api/pos/orders (PATCH)'],
          },
          {
            key: 'orders_delete',
            label: 'Delete Orders',
            description: 'Delete any order regardless of status (pending, completed, delivered)',
            pages: ['/dashboard/orders', '/dashboard/restaurant-orders', '/dashboard/payments'],
            apis: ['/api/pos/orders (DELETE)'],
          },
        ],
      },
      {
        category: 'system',
        label: 'System Management',
        permissions: [
          {
            key: 'team_manage',
            label: 'Manage Team',
            description: 'Add, edit, and remove team members',
            pages: ['/dashboard/team'],
            apis: ['/api/team'],
          },
          {
            key: 'settings_manage',
            label: 'Manage Settings',
            description: 'Configure system settings and preferences',
            pages: ['/dashboard/settings'],
            apis: ['/api/settings'],
          },
        ],
      },
    ],
  },
  {
    value: 'manager',
    labelAr: 'مدير عام',
    labelEn: 'Manager',
    description: 'Management and operational access',
    permissionGroups: [
      {
        category: 'catalog',
        label: 'Catalog Management',
        permissions: [
          {
            key: 'products_manage',
            label: 'Manage Products',
            description: 'Add, edit, and delete products and categories',
            pages: ['/dashboard/products', '/dashboard/categories'],
            apis: ['/api/products', '/api/categories'],
          },
          {
            key: 'discounts_manage',
            label: 'Manage Discounts',
            description: 'Create and manage discount codes and offers',
            pages: ['/dashboard/discounts'],
            apis: ['/api/discounts'],
          },
        ],
      },
      {
        category: 'team',
        label: 'Team Management',
        permissions: [
          {
            key: 'team_manage',
            label: 'Manage Team',
            description: 'Add, edit, and remove team members',
            pages: ['/dashboard/team'],
            apis: ['/api/team'],
          },
        ],
      },
    ],
  },
  {
    value: 'supervisor',
    labelAr: 'مشرف',
    labelEn: 'Supervisor',
    description: 'Catalog supervision access',
    permissionGroups: [
      {
        category: 'catalog',
        label: 'Catalog Management',
        permissions: [
          {
            key: 'products_manage',
            label: 'Manage Products',
            description: 'Add, edit, and delete products and categories',
            pages: ['/dashboard/products', '/dashboard/categories'],
            apis: ['/api/products', '/api/categories'],
          },
          {
            key: 'discounts_manage',
            label: 'Manage Discounts',
            description: 'Create and manage discount codes and offers',
            pages: ['/dashboard/discounts'],
            apis: ['/api/discounts'],
          },
        ],
      },
    ],
  },
  {
    value: 'cashier',
    labelAr: 'كاشير',
    labelEn: 'Cashier',
    description: 'Point-of-sale and order management access',
    permissionGroups: [
      {
        category: 'pos',
        label: 'Point of Sale',
        permissions: [
          {
            key: 'pos_use',
            label: 'Use POS System',
            description: 'Access and use the point-of-sale system',
            pages: ['/dashboard/pos'],
            apis: ['/api/pos/orders'],
          },
          {
            key: 'orders_edit',
            label: 'Edit Orders',
            description: 'Edit order details and status',
            pages: ['/dashboard/orders', '/dashboard/restaurant-orders'],
            apis: ['/api/pos/orders (PATCH)'],
          },
        ],
      },
      {
        category: 'operations',
        label: 'Operations',
        permissions: [
          {
            key: 'cashier_closeout',
            label: 'Perform Cashier Closeout',
            description: 'Close daily shift and settle drawer',
            pages: ['/dashboard/daily-closing', '/dashboard/closings'],
            apis: ['/api/closings'],
          },
          {
            key: 'driver_closeout',
            label: 'Perform Driver Closeout',
            description: 'Close driver shift and settle payments',
            pages: ['/dashboard/driver-closing', '/dashboard/closings'],
            apis: ['/api/closings'],
          },
          {
            key: 'expenses_manage',
            label: 'Manage Expenses',
            description: 'Add and track business expenses',
            pages: ['/dashboard/expenses'],
            apis: ['/api/expenses'],
          },
        ],
      },
      {
        category: 'customers',
        label: 'Customer Management',
        permissions: [
          {
            key: 'customers_view',
            label: 'View Customers',
            description: 'View customer information and history',
            pages: ['/dashboard/customers'],
            apis: ['/api/customers'],
          },
        ],
      },
    ],
  },
  {
    value: 'delivery',
    labelAr: 'مندوب توصيل',
    labelEn: 'Delivery',
    description: 'Delivery operations access only',
    permissionGroups: [
      {
        category: 'orders',
        label: 'Order Management',
        permissions: [
          {
            key: 'orders_view_own',
            label: 'View Own Orders',
            description: 'View only their assigned delivery orders',
            pages: ['/dashboard/orders', '/dashboard/delivery'],
            apis: ['/api/pos/orders?assigned=true'],
          },
        ],
      },
    ],
  },
  {
    value: 'support',
    labelAr: 'دعم العملاء',
    labelEn: 'Support',
    description: 'Customer support and inquiries',
    permissionGroups: [
      {
        category: 'customers',
        label: 'Customer Management',
        permissions: [
          {
            key: 'customers_view',
            label: 'View Customers',
            description: 'View customer information and history',
            pages: ['/dashboard/customers'],
            apis: ['/api/customers'],
          },
          {
            key: 'customers_manage',
            label: 'Manage Customers',
            description: 'Edit customer information and notes',
            pages: ['/dashboard/customers'],
            apis: ['/api/customers (PATCH, DELETE)'],
          },
        ],
      },
      {
        category: 'orders',
        label: 'Order Management',
        permissions: [
          {
            key: 'orders_view_all',
            label: 'View All Orders',
            description: 'View all orders for support and inquiries',
            pages: ['/dashboard/orders'],
            apis: ['/api/pos/orders'],
          },
        ],
      },
    ],
  },
];

export function getRoleDefinition(roleValue: string): RoleDefinition | undefined {
  return TEAM_ROLES.find(role => role.value === roleValue);
}

export function getAllPermissionsForRole(roleValue: string): Array<{ key: string; label: string; description: string }> {
  const role = getRoleDefinition(roleValue);
  if (!role) return [];
  
  const permissions: Array<{ key: string; label: string; description: string }> = [];
  role.permissionGroups.forEach(group => {
    group.permissions.forEach(perm => {
      permissions.push({
        key: perm.key,
        label: perm.label,
        description: perm.description,
      });
    });
  });
  return permissions;
}
