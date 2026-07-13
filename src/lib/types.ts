export interface Organisation {
  id: string
  name: string
  slug: string
  plan: 'trial' | 'starter' | 'professional' | 'enterprise'
  is_active: boolean
  trial_ends_at: string | null
  max_stores: number
  max_staff: number
  max_products: number
  created_at: string
}

export interface User {
  id: string
  email: string
  name: string
  pin: string | null
  role: 'staff' | 'manager' | 'super_admin'
  is_active: boolean
  organisation_id: string
  store_id: string | null
  last_login_at: string | null
  created_at: string
}

export interface Store {
  id: string
  name: string
  location: string
  organisation_id: string
  created_at: string
}

export interface Category {
  id: string
  name: string
  colour: string
  organisation_id: string
  created_at: string
}

export interface Supplier {
  id: string
  name: string
  contact_person: string
  phone: string
  email: string
  product_types: string
  organisation_id: string
  created_at: string
}

export interface Product {
  id: string
  name: string
  sku: string
  barcode: string
  size: string
  opening_stock: number
  current_stock: number
  reorder_level: number
  cost_price: number
  sell_price: number
  organisation_id: string
  store_id: string
  category_id: string | null
  supplier_id: string | null
  created_at: string
  updated_at: string
  category?: Category
  supplier?: Supplier
}

export interface Sale {
  id: string
  total: number
  payment_method: 'cash' | 'card' | 'mpesa'
  organisation_id: string
  store_id: string
  staff_id: string
  created_at: string
  sale_items?: SaleItem[]
  staff?: { name: string }
}

export interface SaleItem {
  id: string
  name: string
  qty: number
  price: number
  cost: number
  sale_id: string
  product_id: string
}

export interface StockMovement {
  id: string
  product_id: string
  store_id: string
  organisation_id: string
  movement_type: 'purchase' | 'sale' | 'adjustment' | 'damaged' | 'expired' | 'stock_take' | 'opening'
  quantity: number
  reference_id: string | null
  notes: string
  created_by: string
  created_at: string
  product?: { name: string }
}

export interface Purchase {
  id: string
  supplier_id: string | null
  store_id: string
  organisation_id: string
  total_cost: number
  notes: string
  received_by: string
  created_at: string
  items_data: PurchaseItem[]
  supplier?: { name: string }
}

export interface PurchaseItem {
  productId: string
  name: string
  qty: number
  costPrice: number
}

export interface Expense {
  id: string
  date: string
  category: string
  description: string
  amount: number
  organisation_id: string
  store_id: string
  recorded_by: string
  created_at: string
}

export interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
  is_read: boolean
  user_id: string
  organisation_id: string
  created_at: string
}

export type PageType = 'dashboard' | 'inventory' | 'pos' | 'staff' | 'suppliers' | 'expenses' | 'categories' | 'stock-count' | 'reports' | 'settings'