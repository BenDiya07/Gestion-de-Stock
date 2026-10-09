import { createContext, useContext } from 'react';
import type {
  Product,
  Supplier,
  Supply,
  Sale,
  User,
  Client,
  Store,
  StoreStock,
  HistoryEntry,
} from '../types';

export interface TransferStockInput {
  productId: string;
  quantity: number;
  fromStoreId: string;
  toStoreId: string;
}

export interface StoreContextType {
  products: Product[];
  suppliers: Supplier[];
  supplies: Supply[];
  sales: Sale[];
  users: User[];
  clients: Client[];
  stores: Store[];
  stockByStore: StoreStock[];
  history: HistoryEntry[];
  currentUser: User;
  isDemoMode: boolean;

  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;

  addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt'>) => void;
  updateSupplier: (id: string, supplier: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;

  addSupply: (supply: Omit<Supply, 'id' | 'date'>) => void;
  updateSupply: (id: string, supply: Partial<Supply>) => void;

  addSale: (sale: Omit<Sale, 'id' | 'date'>) => void;
  updateSale: (id: string, sale: Partial<Sale>) => void;

  addUser: (user: Omit<User, 'id' | 'createdAt'>) => void;
  updateUser: (id: string, user: Partial<User>) => void;
  deleteUser: (id: string) => void;

  addClient: (client: Omit<Client, 'id' | 'createdAt' | 'totalPurchases'>) => void;
  updateClient: (id: string, client: Partial<Client>) => void;
  deleteClient: (id: string) => void;

  addStore: (store: Omit<Store, 'id' | 'createdAt'>) => void;
  updateStore: (id: string, store: Partial<Store>) => void;
  deleteStore: (id: string) => void;
  transferStock: (input: TransferStockInput) => void;
}

export const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function useStore(): StoreContextType {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return context;
}
