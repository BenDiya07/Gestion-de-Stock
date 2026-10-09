export interface Store {
  id: string;
  name: string;
  city: string;
  address: string;
  isDispatchCenter: boolean;
  status: 'active' | 'inactive';
  createdAt: Date;
}

export interface StoreStock {
  storeId: string;
  storeName: string;
  storeCity: string;
  isDispatchCenter: boolean;
  productId: string;
  productSku: string;
  productName: string;
  quantity: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  supplierId: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  createdAt: Date;
}

export interface Supply {
  id: string;
  supplierId: string;
  productId: string;
  quantity: number;
  cost: number;
  totalCost: number;
  date: Date;
  status: 'pending' | 'received' | 'cancelled';
  notes?: string;
}

export interface Sale {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  date: Date;
  customerId?: string;
  customerName?: string;
  storeId?: string;
  status: 'completed' | 'pending' | 'cancelled';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'employee';
  status: 'active' | 'inactive';
  createdAt: Date;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  company?: string;
  notes?: string;
  type: 'individual' | 'business';
  status: 'active' | 'inactive';
  createdAt: Date;
  totalPurchases: number;
}

export interface HistoryEntry {
  id: string;
  type: 'product' | 'supplier' | 'supply' | 'sale' | 'user' | 'client' | 'store' | 'transfer';
  action: 'create' | 'update' | 'delete';
  entityId: string;
  entityName: string;
  userId: string;
  userName: string;
  timestamp: Date;
  details?: string;
}