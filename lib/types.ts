// User Roles
export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'manager'
  | 'cashier'
  | 'delivery'
  | 'support'
  | 'customer'

// Permissions
export type Permission =
  | 'dashboard_access'
  | 'team_management'
  | 'orders_view'
  | 'orders_edit'
  | 'products_manage'
  | 'customers_view'
  | 'reports_view'
  | 'settings_edit'
  | 'pos_manage'
  | 'payments_verify'
  | 'notifications_send'

// Database Types
export interface User {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Restaurant {
  id: string
  name: string
  address: string
  phone: string
  logo_url: string | null
  owner_id: string
  created_at: string
}

export interface TeamMember {
  id: string
  user_id: string
  restaurant_id: string
  role: UserRole
  status: 'active' | 'inactive' | 'suspended'
  created_at: string
}

export interface Product {
  id: string
  restaurant_id: string
  category_id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  rating: number
  review_count: number
  created_at: string
}

export interface Category {
  id: string
  restaurant_id: string
  name: string
  image_url: string | null
  display_order: number
}

export interface Order {
  id: string
  restaurant_id: string
  customer_id: string
  status: OrderStatus
  total: number
  payment_method: 'cash' | 'vodafone_cash' | 'instapay'
  delivery_address: string
  notes: string | null
  created_at: string
  updated_at: string
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_delivery'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'rejected'
  | 'refunded'

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  notes: string | null
}

export interface Customer {
  id: string
  user_id: string
  restaurant_id: string
  phone: string | null
  loyalty_points: number
  vip_status: boolean
}

export interface Payment {
  id: string
  order_id: string
  method: 'cash' | 'vodafone_cash' | 'instapay'
  amount: number
  receipt_url: string | null
  verified: boolean
  verified_by: string | null
  created_at: string
}

export interface Coupon {
  id: string
  restaurant_id: string
  code: string
  discount_percent: number | null
  discount_amount: number | null
  expiry: string
  usage_limit: number | null
  used_count: number
}

export interface Notification {
  id: string
  recipient_id: string
  title: string
  message: string
  type: 'order_update' | 'promotion' | 'system'
  read: boolean
  created_at: string
}
