import { useState, type ReactNode } from 'react';
import { StoreContext, type StoreContextType } from './store';
import type { Product, Supplier, Supply, Sale, User, Client, HistoryEntry } from '../types';
import {
  mockClients,
  mockProducts,
  mockSales,
  mockSuppliers,
  mockSupplies,
  mockUsers,
} from '../data/mockData';

/**
 * Store en mémoire (mode démo). Utilisé lorsque Supabase n'est pas configuré.
 * Les mises à jour de stock utilisent des updaters fonctionnels pour éviter
 * les fermetures périmées (bug corrigé par rapport au prototype initial).
 */
export function MockStoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [suppliers, setSuppliers] = useState<Supplier[]>(mockSuppliers);
  const [supplies, setSupplies] = useState<Supply[]>(mockSupplies);
  const [sales, setSales] = useState<Sale[]>(mockSales);
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [clients, setClients] = useState<Client[]>(mockClients);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentUser] = useState<User>(mockUsers[0]);

  const record = (
    type: HistoryEntry['type'],
    action: HistoryEntry['action'],
    entityId: string,
    entityName: string,
    details?: string
  ) => {
    const entry: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      action,
      entityId,
      entityName,
      userId: currentUser.id,
      userName: currentUser.name,
      timestamp: new Date(),
      details,
    };
    setHistory((prev) => [entry, ...prev]);
  };

  const changeStock = (productId: string, delta: number) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, stock: p.stock + delta, updatedAt: new Date() } : p))
    );
  };

  const addProduct: StoreContextType['addProduct'] = (product) => {
    const newProduct: Product = {
      ...product,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setProducts((prev) => [...prev, newProduct]);
    record('product', 'create', newProduct.id, newProduct.name);
  };

  const updateProduct: StoreContextType['updateProduct'] = (id, updates) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: new Date() } : p))
    );
    const name = products.find((p) => p.id === id)?.name ?? id;
    record('product', 'update', id, name);
  };

  const deleteProduct: StoreContextType['deleteProduct'] = (id) => {
    const name = products.find((p) => p.id === id)?.name ?? id;
    setProducts((prev) => prev.filter((p) => p.id !== id));
    record('product', 'delete', id, name);
  };

  const addSupplier: StoreContextType['addSupplier'] = (supplier) => {
    const newSupplier: Supplier = { ...supplier, id: Date.now().toString(), createdAt: new Date() };
    setSuppliers((prev) => [...prev, newSupplier]);
    record('supplier', 'create', newSupplier.id, newSupplier.name);
  };

  const updateSupplier: StoreContextType['updateSupplier'] = (id, updates) => {
    setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    record('supplier', 'update', id, suppliers.find((s) => s.id === id)?.name ?? id);
  };

  const deleteSupplier: StoreContextType['deleteSupplier'] = (id) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
    record('supplier', 'delete', id, suppliers.find((s) => s.id === id)?.name ?? id);
  };

  const addSupply: StoreContextType['addSupply'] = (supply) => {
    const newSupply: Supply = { ...supply, id: Date.now().toString(), date: new Date() };
    setSupplies((prev) => [...prev, newSupply]);
    if (newSupply.status === 'received') {
      changeStock(newSupply.productId, newSupply.quantity);
    }
    const product = products.find((p) => p.id === supply.productId);
    if (product) record('supply', 'create', newSupply.id, product.name, `Qté: ${supply.quantity}`);
  };

  const updateSupply: StoreContextType['updateSupply'] = (id, updates) => {
    const oldSupply = supplies.find((s) => s.id === id);
    setSupplies((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    if (oldSupply && updates.status === 'received' && oldSupply.status !== 'received') {
      changeStock(oldSupply.productId, oldSupply.quantity);
    }
  };

  const addSale: StoreContextType['addSale'] = (sale) => {
    const newSale: Sale = { ...sale, id: Date.now().toString(), date: new Date() };
    setSales((prev) => [...prev, newSale]);
    if (newSale.status === 'completed') {
      changeStock(newSale.productId, -newSale.quantity);
    }
    const product = products.find((p) => p.id === sale.productId);
    if (product) record('sale', 'create', newSale.id, product.name, `Qté: ${sale.quantity}`);
  };

  const updateSale: StoreContextType['updateSale'] = (id, updates) => {
    setSales((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const addUser: StoreContextType['addUser'] = (user) => {
    const newUser: User = { ...user, id: Date.now().toString(), createdAt: new Date() };
    setUsers((prev) => [...prev, newUser]);
    record('user', 'create', newUser.id, newUser.name);
  };

  const updateUser: StoreContextType['updateUser'] = (id, updates) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updates } : u)));
    record('user', 'update', id, users.find((u) => u.id === id)?.name ?? id);
  };

  const deleteUser: StoreContextType['deleteUser'] = (id) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    record('user', 'delete', id, users.find((u) => u.id === id)?.name ?? id);
  };

  const addClient: StoreContextType['addClient'] = (client) => {
    const newClient: Client = {
      ...client,
      id: Date.now().toString(),
      createdAt: new Date(),
      totalPurchases: 0,
    };
    setClients((prev) => [...prev, newClient]);
    record('client', 'create', newClient.id, newClient.name);
  };

  const updateClient: StoreContextType['updateClient'] = (id, updates) => {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    record('client', 'update', id, clients.find((c) => c.id === id)?.name ?? id);
  };

  const deleteClient: StoreContextType['deleteClient'] = (id) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
    record('client', 'delete', id, clients.find((c) => c.id === id)?.name ?? id);
  };

  const value: StoreContextType = {
    products,
    suppliers,
    supplies,
    sales,
    users,
    clients,
    history,
    currentUser,
    isDemoMode: true,
    addProduct,
    updateProduct,
    deleteProduct,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    addSupply,
    updateSupply,
    addSale,
    updateSale,
    addUser,
    updateUser,
    deleteUser,
    addClient,
    updateClient,
    deleteClient,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
