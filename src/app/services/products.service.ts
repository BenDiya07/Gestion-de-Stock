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
    imageUrl: row.image_url ?? undefined,
    gallery: row.gallery ?? [],
    compareAtPrice: row.compare_at_price != null ? Number(row.compare_at_price) : undefined,
    features: row.features ?? [],
    isFeatured: row.is_featured ?? false,
    isNew: row.is_new ?? false,
    isActive: row.is_active ?? true,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/** Slug utilisé par le site vitrine Merkey pour filtrer les catégories. */
function categorySlug(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (normalized.includes('bleu') || normalized.includes('blue')) return 'lumierebleue';
  if (normalized.includes('photo') || normalized.includes('grey') || normalized.includes('gray')) {
    return 'photogrey';
  }
  if (normalized.includes('soleil') || normalized.includes('sun')) return 'soleil';
  if (normalized.includes('accessoire') || normalized.includes('étui') || normalized.includes('etui')) {
    return 'accessoires';
  }
  return normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
  if (existing?.id) {
    await supabase
      .from('categories')
      .update({ slug: categorySlug(trimmed) })
      .eq('id', existing.id)
      .is('slug', null);
    return existing.id as string;
  }
  const { data: created, error } = await supabase
    .from('categories')
    .insert({ name: trimmed, slug: categorySlug(trimmed) })
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
    image_url: values.imageUrl || null,
    gallery: values.gallery ?? [],
    compare_at_price: values.compareAtPrice ?? null,
    features: values.features ?? [],
    is_featured: values.isFeatured ?? false,
    is_new: values.isNew ?? false,
    is_active: values.isActive ?? true,
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
  if (input.imageUrl !== undefined) patch.image_url = input.imageUrl || null;
  if (input.gallery !== undefined) patch.gallery = input.gallery;
  if (input.compareAtPrice !== undefined) patch.compare_at_price = input.compareAtPrice ?? null;
  if (input.features !== undefined) patch.features = input.features;
  if (input.isFeatured !== undefined) patch.is_featured = input.isFeatured;
  if (input.isNew !== undefined) patch.is_new = input.isNew;
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  if (Object.keys(patch).length === 0) return;
  const { error } = await requireSupabase().from('products').update(patch).eq('id', id);
  if (error) throw error;
}

/** Téléverse une image produit dans le bucket public `product-images`. */
export async function uploadProductImage(file: File): Promise<string> {
  const supabase = requireSupabase();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await requireSupabase().from('products').delete().eq('id', id);
  if (error) throw error;
}

/** Ajustement manuel de stock (mouvement d'inventaire sur le dépôt central). */
async function dispatchCenterId(): Promise<string> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('stores')
    .select('id')
    .eq('is_dispatch_center', true)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data?.id) return data.id as string;
  const { data: first } = await supabase.from('stores').select('id').limit(1).maybeSingle();
  if (first?.id) return first.id as string;
  throw new Error('Aucune boutique : créez d’abord un dépôt.');
}

export async function adjustStock(productId: string, delta: number, note?: string): Promise<void> {
  const { error } = await requireSupabase().from('stock_movements').insert({
    product_id: productId,
    store_id: await dispatchCenterId(),
    quantity: delta,
    reason: 'adjustment',
    created_by: await currentUserId(),
  });
  if (error) throw error;
}
