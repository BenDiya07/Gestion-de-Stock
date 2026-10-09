import { requireSupabase } from '@/lib/supabase';
import type { Store, StoreStock } from '../types';
import type { StoreRow, StoreStockRow } from '../types/db';
import { storeSchema, transferSchema, type StoreInput, type TransferInput } from '../schemas';

export function mapStore(row: StoreRow): Store {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    address: row.address ?? '',
    isDispatchCenter: row.is_dispatch_center,
    status: row.status,
    createdAt: new Date(row.created_at),
  };
}

export function mapStoreStock(row: StoreStockRow): StoreStock {
  return {
    storeId: row.store_id,
    storeName: row.store_name,
    storeCity: row.store_city,
    isDispatchCenter: row.is_dispatch_center,
    productId: row.product_id,
    productSku: row.product_sku,
    productName: row.product_name,
    quantity: Number(row.quantity),
  };
}

export async function listStores(): Promise<Store[]> {
  const { data, error } = await requireSupabase().from('stores').select('*').order('created_at');
  if (error) throw error;
  return (data as StoreRow[]).map(mapStore);
}

export async function listStoreStock(): Promise<StoreStock[]> {
  const { data, error } = await requireSupabase().from('store_stock').select('*').order('store_name');
  if (error) throw error;
  return (data as StoreStockRow[]).map(mapStoreStock);
}

export async function createStore(input: StoreInput): Promise<void> {
  const values = storeSchema.parse(input);
  const { error } = await requireSupabase().from('stores').insert({
    name: values.name,
    city: values.city,
    address: values.address || null,
    is_dispatch_center: values.isDispatchCenter,
    status: values.status,
  });
  if (error) throw error;
}

export async function updateStore(id: string, input: Partial<StoreInput>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.city !== undefined) patch.city = input.city;
  if (input.address !== undefined) patch.address = input.address || null;
  if (input.isDispatchCenter !== undefined) patch.is_dispatch_center = input.isDispatchCenter;
  if (input.status !== undefined) patch.status = input.status;
  if (Object.keys(patch).length === 0) return;
  const { error } = await requireSupabase().from('stores').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteStore(id: string): Promise<void> {
  const { error } = await requireSupabase().from('stores').delete().eq('id', id);
  if (error) throw error;
}

/** Répartition de stock : dépôt -> boutique (2 mouvements via le RPC DB). */
export async function transferStock(
  input: TransferInput,
  fromStoreId: string,
  toStoreId: string
): Promise<void> {
  const values = transferSchema.parse(input);
  const { error } = await requireSupabase().rpc('transfer_stock', {
    p_product_id: values.productId,
    p_quantity: values.quantity,
    p_from_store_id: fromStoreId,
    p_to_store_id: toStoreId,
  });
  if (error) throw error;
}