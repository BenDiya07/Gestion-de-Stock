import { requireSupabase, currentUserId } from '@/lib/supabase';
import type { Product } from '../types';
import type { ProductRow } from '../types/db';
import { productSchema, type ProductInput } from '../schemas';

function categoryName(row: ProductRow): string {
  const ref = row.categories;
  if (!ref) return '';
  return Array.isArray(ref) ? ref[0]?.name ?? '' : ref.name ?? '';
}

export function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    category: categoryName(row),
    price: Number(row.price),
    cost: Number(row.cost),
    stock: Number(row.stock),
    minStock: Number(row.min_stock),
    supplierId: row.supplier_id ?? '',
    description: row.description ?? '',
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

async function resolveCategoryId(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const supabase = requireSupabase();
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('name', trimmed)
    .maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data: created, error } = await supabase
    .from('categories')
    .insert({ name: trimmed })
    .select('id')
    .single();
  if (error) throw error;
  return (created?.id as string) ?? null;
}

export async function listProducts(): Promise<Product[]> {
  const { data, error } = await requireSupabase()
    .from('products')
    .select('*, categories(name)')
    .order('name');
  if (error) throw error;
  return (data as ProductRow[]).map(mapProduct);
}

export async function createProduct(input: ProductInput): Promise<void> {
  const values = productSchema.parse(input);
  const category_id = await resolveCategoryId(values.category);
  const { error } = await requireSupabase().from('products').insert({
    name: values.name,
    sku: values.sku,
    category_id,
    supplier_id: values.supplierId || null,
    price: values.price,
    cost: values.cost,
    stock: values.stock,
    min_stock: values.minStock,
    description: values.description ?? null,
  });
  if (error) throw error;
}

export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.sku !== undefined) patch.sku = input.sku;
  if (input.price !== undefined) patch.price = input.price;
  if (input.cost !== undefined) patch.cost = input.cost;
  if (input.stock !== undefined) patch.stock = input.stock;
  if (input.minStock !== undefined) patch.min_stock = input.minStock;
  if (input.description !== undefined) patch.description = input.description;
  if (input.supplierId !== undefined) patch.supplier_id = input.supplierId || null;
  if (input.category !== undefined) patch.category_id = await resolveCategoryId(input.category);

  if (Object.keys(patch).length === 0) return;
  const { error } = await requireSupabase().from('products').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await requireSupabase().from('products').delete().eq('id', id);
  if (error) throw error;
}

/** Ajustement manuel de stock (mouvement d'inventaire). */
export async function adjustStock(productId: string, delta: number, note?: string): Promise<void> {
  const { error } = await requireSupabase().from('stock_movements').insert({
    product_id: productId,
    quantity: delta,
    reason: 'adjustment',
    created_by: await currentUserId(),
    // note conservée dans l'audit via trigger applicatif si besoin
  });
  if (error) throw error;
}
