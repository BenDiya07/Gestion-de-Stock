/**
 * Formes brutes des lignes PostgreSQL (snake_case).
 * Les services convertissent ces lignes vers le modèle de domaine camelCase
 * défini dans `types/index.ts`.
 */

export interface ProfileRow {
  id: string;
  full_name: string;
  email: string | null;
  role: 'admin' | 'manager' | 'employee';
  status: 'active' | 'inactive';
  created_at: string;
}

export interface StoreRow {
  id: string;
  name: string;
  city: string;
  address: string | null;
  is_dispatch_center: boolean;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface StoreStockRow {
  store_id: string;
  store_name: string;
  store_city: string;
  is_dispatch_center: boolean;
  product_id: string;
  product_sku: string;
  product_name: string;
  quantity: number;
}

export interface SupplierRow {
  id: string;
  name: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
}

export interface CategoryRef {
  name: string | null;
}

export interface ProductRow {
  id: string;
  name: string;
  sku: string;
  category_id: string | null;
  supplier_id: string | null;
  price: number;
  cost: number;
  stock: number;
  min_stock: number;
  description: string | null;
  created_at: string;
  updated_at: string;
  categories?: CategoryRef | CategoryRef[] | null;
}

export interface SupplyRow {
  id: string;
  supplier_id: string;
  product_id: string;
  quantity: number;
  cost: number;
  total_cost: number;
  status: 'pending' | 'received' | 'cancelled';
  notes: string | null;
  created_at: string;
}

export interface SaleRow {
  id: string;
  product_id: string;
  store_id: string | null;
  client_id: string | null;
  customer_name: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: 'completed' | 'pending' | 'cancelled';
  created_at: string;
}

export interface ClientRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  company: string | null;
  notes: string | null;
  type: 'individual' | 'business';
  status: 'active' | 'inactive';
  total_purchases: number;
  created_at: string;
}

export interface AuditRow {
  id: string;
  entity_type: string;
  action: 'create' | 'update' | 'delete';
  entity_id: string | null;
  entity_name: string | null;
  details: string | null;
  user_id: string | null;
  created_at: string;
}
