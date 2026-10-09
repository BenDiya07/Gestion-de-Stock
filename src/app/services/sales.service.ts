import { requireSupabase, currentUserId } from '@/lib/supabase';
import type { Sale } from '../types';
import type { SaleRow } from '../types/db';
import { saleSchema, type SaleInput } from '../schemas';

export function mapSale(row: SaleRow): Sale {
  return {
    id: row.id,
    productId: row.product_id,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    totalPrice: Number(row.total_price),
    date: new Date(row.created_at),
    customerId: row.client_id ?? undefined,
    customerName: row.customer_name ?? undefined,
    storeId: row.store_id ?? undefined,
    status: row.status,
  };
}

export async function listSales(): Promise<Sale[]> {
  const { data, error } = await requireSupabase()
    .from('sales')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as SaleRow[]).map(mapSale);
}

async function resolveClientId(name?: string): Promise<string | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  const supabase = requireSupabase();
  const { data } = await supabase
    .from('clients')
    .select('id')
    .ilike('name', trimmed)
    .maybeSingle();
  return (data?.id as string) ?? null;
}

export async function createSale(input: SaleInput): Promise<void> {
  const values = saleSchema.parse(input);
  const { error } = await requireSupabase().from('sales').insert({
    product_id: values.productId,
    store_id: values.storeId || null,
    quantity: values.quantity,
    unit_price: values.unitPrice,
    customer_name: values.customerName || null,
    client_id: await resolveClientId(values.customerName),
    status: values.status,
    created_by: await currentUserId(),
  });
  // La contrainte `stock >= 0` et le trigger de mouvement refusent toute
  // vente menant à un stock négatif : l'erreur est remontée telle quelle.
  if (error) throw error;
}

export async function updateSaleStatus(id: string, status: Sale['status']): Promise<void> {
  const { error } = await requireSupabase().from('sales').update({ status }).eq('id', id);
  if (error) throw error;
}
