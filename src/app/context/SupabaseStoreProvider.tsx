import { type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryClient';
import { StoreContext, type StoreContextType, type TransferStockInput } from './store';
import { useAuth } from './AuthContext';
import type { Product, Supplier, Supply, Sale, User, Client, Store, StoreStock } from '../types';
import type {
  ProductInput,
  SupplierInput,
  SupplyInput,
  SaleInput,
  ClientInput,
  UserInput,
  StoreInput,
  TransferInput,
} from '../schemas';
import * as productsApi from '../services/products.service';
import * as suppliersApi from '../services/suppliers.service';
import * as suppliesApi from '../services/supplies.service';
import * as salesApi from '../services/sales.service';
import * as clientsApi from '../services/clients.service';
import * as usersApi from '../services/users.service';
import * as historyApi from '../services/history.service';
import * as storesApi from '../services/stores.service';

function onError(error: unknown) {
  toast.error('Opération échouée', { description: (error as Error).message });
}

export function SupabaseStoreProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const qc = useQueryClient();

  const invalidate = (keys: ReadonlyArray<readonly unknown[]>) => {
    keys.forEach((key) => qc.invalidateQueries({ queryKey: key }));
  };

  const productsQuery = useQuery({ queryKey: queryKeys.products, queryFn: productsApi.listProducts });
  const suppliersQuery = useQuery({ queryKey: queryKeys.suppliers, queryFn: suppliersApi.listSuppliers });
  const suppliesQuery = useQuery({ queryKey: queryKeys.supplies, queryFn: suppliesApi.listSupplies });
  const salesQuery = useQuery({ queryKey: queryKeys.sales, queryFn: salesApi.listSales });
  const clientsQuery = useQuery({ queryKey: queryKeys.clients, queryFn: clientsApi.listClients });
  const usersQuery = useQuery({ queryKey: queryKeys.users, queryFn: usersApi.listProfiles });
  const historyQuery = useQuery({ queryKey: queryKeys.history, queryFn: historyApi.listHistory });
  const storesQuery = useQuery({ queryKey: queryKeys.stores, queryFn: storesApi.listStores });
  const storeStockQuery = useQuery({ queryKey: queryKeys.storeStock, queryFn: storesApi.listStoreStock });

  const productKeys = [queryKeys.products, queryKeys.history, queryKeys.storeStock];
  const storeKeys = [
    queryKeys.stores,
    queryKeys.storeStock,
    queryKeys.history,
    queryKeys.products,
  ];
  const saleKeys = [
    queryKeys.sales,
    queryKeys.products,
    queryKeys.clients,
    queryKeys.history,
    queryKeys.storeStock,
  ];
  const supplyKeys = [
    queryKeys.supplies,
    queryKeys.products,
    queryKeys.history,
    queryKeys.storeStock,
  ];

  const addProduct = useMutation({
    mutationFn: (input: ProductInput) => productsApi.createProduct(input),
    onSuccess: () => invalidate(productKeys),
    onError,
  });
  const updateProduct = useMutation({
    mutationFn: (vars: { id: string; values: Partial<ProductInput> }) =>
      productsApi.updateProduct(vars.id, vars.values),
    onSuccess: () => invalidate(productKeys),
    onError,
  });
  const deleteProduct = useMutation({
    mutationFn: (id: string) => productsApi.deleteProduct(id),
    onSuccess: () => invalidate(productKeys),
    onError,
  });

  const addSupplier = useMutation({
    mutationFn: (input: SupplierInput) => suppliersApi.createSupplier(input),
    onSuccess: () => invalidate([queryKeys.suppliers, queryKeys.history]),
    onError,
  });
  const updateSupplier = useMutation({
    mutationFn: (vars: { id: string; values: Partial<SupplierInput> }) =>
      suppliersApi.updateSupplier(vars.id, vars.values),
    onSuccess: () => invalidate([queryKeys.suppliers, queryKeys.history]),
    onError,
  });
  const deleteSupplier = useMutation({
    mutationFn: (id: string) => suppliersApi.deleteSupplier(id),
    onSuccess: () => invalidate([queryKeys.suppliers, queryKeys.history]),
    onError,
  });

  const addSupply = useMutation({
    mutationFn: (input: SupplyInput) => suppliesApi.createSupply(input),
    onSuccess: () => invalidate(supplyKeys),
    onError,
  });
  const updateSupply = useMutation({
    mutationFn: (vars: { id: string; status: Supply['status'] }) =>
      suppliesApi.updateSupplyStatus(vars.id, vars.status),
    onSuccess: () => invalidate(supplyKeys),
    onError,
  });

  const addSale = useMutation({
    mutationFn: (input: SaleInput) => salesApi.createSale(input),
    onSuccess: () => invalidate(saleKeys),
    onError,
  });
  const updateSale = useMutation({
    mutationFn: (vars: { id: string; status: Sale['status'] }) =>
      salesApi.updateSaleStatus(vars.id, vars.status),
    onSuccess: () => invalidate(saleKeys),
    onError,
  });

  const addUser = useMutation({
    mutationFn: (input: UserInput) => usersApi.createUser(input),
    onSuccess: () => invalidate([queryKeys.users, queryKeys.history]),
    onError,
  });
  const updateUser = useMutation({
    mutationFn: (vars: { id: string; values: Partial<UserInput> }) =>
      usersApi.updateProfile(vars.id, vars.values),
    onSuccess: () => invalidate([queryKeys.users, queryKeys.history]),
    onError,
  });
  const deleteUser = useMutation({
    mutationFn: (id: string) => usersApi.deleteUser(id),
    onSuccess: () => invalidate([queryKeys.users, queryKeys.history]),
    onError,
  });

  const addClient = useMutation({
    mutationFn: (input: ClientInput) => clientsApi.createClient(input),
    onSuccess: () => invalidate([queryKeys.clients, queryKeys.history]),
    onError,
  });
  const updateClient = useMutation({
    mutationFn: (vars: { id: string; values: Partial<ClientInput> }) =>
      clientsApi.updateClient(vars.id, vars.values),
    onSuccess: () => invalidate([queryKeys.clients, queryKeys.history]),
    onError,
  });
  const deleteClient = useMutation({
    mutationFn: (id: string) => clientsApi.deleteClient(id),
    onSuccess: () => invalidate([queryKeys.clients, queryKeys.history]),
    onError,
  });

  const addStore = useMutation({
    mutationFn: (input: StoreInput) => storesApi.createStore(input),
    onSuccess: () => invalidate(storeKeys),
    onError,
  });
  const updateStore = useMutation({
    mutationFn: (vars: { id: string; values: Partial<StoreInput> }) =>
      storesApi.updateStore(vars.id, vars.values),
    onSuccess: () => invalidate(storeKeys),
    onError,
  });
  const deleteStore = useMutation({
    mutationFn: (id: string) => storesApi.deleteStore(id),
    onSuccess: () => invalidate(storeKeys),
    onError,
  });
  const transferStockMutation = useMutation({
    mutationFn: (vars: { input: TransferInput; fromStoreId: string; toStoreId: string }) =>
      storesApi.transferStock(vars.input, vars.fromStoreId, vars.toStoreId),
    onSuccess: () => invalidate([queryKeys.storeStock, queryKeys.stores, queryKeys.products, queryKeys.history]),
    onError,
  });

  if (!currentUser) return null;

  const value: StoreContextType = {
    products: productsQuery.data ?? [],
    suppliers: suppliersQuery.data ?? [],
    supplies: suppliesQuery.data ?? [],
    sales: salesQuery.data ?? [],
    clients: clientsQuery.data ?? [],
    users: usersQuery.data ?? [],
    stores: storesQuery.data ?? [],
    stockByStore: storeStockQuery.data ?? [],
    history: historyQuery.data ?? [],
    currentUser,
    isDemoMode: false,

    addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) =>
      addProduct.mutate(product as unknown as ProductInput),
    updateProduct: (id: string, product: Partial<Product>) =>
      updateProduct.mutate({ id, values: product as Partial<ProductInput> }),
    deleteProduct: (id: string) => deleteProduct.mutate(id),

    addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt'>) =>
      addSupplier.mutate(supplier as unknown as SupplierInput),
    updateSupplier: (id: string, supplier: Partial<Supplier>) =>
      updateSupplier.mutate({ id, values: supplier as Partial<SupplierInput> }),
    deleteSupplier: (id: string) => deleteSupplier.mutate(id),

    addSupply: (supply: Omit<Supply, 'id' | 'date'>) =>
      addSupply.mutate(supply as unknown as SupplyInput),
    updateSupply: (id: string, supply: Partial<Supply>) => {
      if (supply.status) updateSupply.mutate({ id, status: supply.status });
    },

    addSale: (sale: Omit<Sale, 'id' | 'date'>) => addSale.mutate(sale as unknown as SaleInput),
    updateSale: (id: string, sale: Partial<Sale>) => {
      if (sale.status) updateSale.mutate({ id, status: sale.status });
    },

    addUser: (user: Omit<User, 'id' | 'createdAt'>) =>
      addUser.mutate(user as unknown as UserInput),
    updateUser: (id: string, user: Partial<User>) =>
      updateUser.mutate({ id, values: user as Partial<UserInput> }),
    deleteUser: (id: string) => deleteUser.mutate(id),

    addClient: (client: Omit<Client, 'id' | 'createdAt' | 'totalPurchases'>) =>
      addClient.mutate(client as unknown as ClientInput),
    updateClient: (id: string, client: Partial<Client>) =>
      updateClient.mutate({ id, values: client as Partial<ClientInput> }),
    deleteClient: (id: string) => deleteClient.mutate(id),

    addStore: (store: Omit<Store, 'id' | 'createdAt'>) =>
      addStore.mutate(store as unknown as StoreInput),
    updateStore: (id: string, store: Partial<Store>) =>
      updateStore.mutate({ id, values: store as Partial<StoreInput> }),
    deleteStore: (id: string) => deleteStore.mutate(id),
    transferStock: (input: TransferStockInput) =>
      transferStockMutation.mutate({
        input: input,
        fromStoreId: input.fromStoreId,
        toStoreId: input.toStoreId,
      }),
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
