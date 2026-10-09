import { requireSupabase, currentUserId } from '@/lib/supabase';
import type { Supply } from '../types';
import type { SupplyRow } from '../types/db';
import { supplySchema, type SupplyInput } from '../schemas';

export function mapSupply(row: SupplyRow): Supply {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    productId: row.product_id,
    quantity: Number(row.quantity),
    cost: Number(row.cost),
    totalCost: Number(row.total_cost),
    date: new Date(row.created_at),
    status: row.status,
    notes: row.notes ?? '',
  };
}

export async function listSupplies(): Promise<Supply[]> {
  const { data, error } = await requireSupabase()
    .from('supplies')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as SupplyRow[]).map(mapSupply);
}

export async function createSupply(input: SupplyInput): Promise<void> {
  const values = supplySchema.parse(input);
  const { error } = await requireSupabase().from('supplies').insert({
    supplier_id: values.supplierId,
    product_id: values.productId,
    quantity: values.quantity,
    cost: values.cost,
    status: values.status,
    notes: values.notes ?? null,
    created_by: await currentUserId(),
  });
  if (error) throw error;
}

export async function updateSupplyStatus(
  id: string,
  status: Supply['status']
): Promise<void> {
  const { error } = await requireSupabase()
    .from('supplies')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}
