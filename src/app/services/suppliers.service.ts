import { requireSupabase } from '@/lib/supabase';
import type { Supplier } from '../types';
import type { SupplierRow } from '../types/db';
import { supplierSchema, type SupplierInput } from '../schemas';

export function mapSupplier(row: SupplierRow): Supplier {
  return {
    id: row.id,
    name: row.name,
    contact: row.contact ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    address: row.address ?? '',
    createdAt: new Date(row.created_at),
  };
}

export async function listSuppliers(): Promise<Supplier[]> {
  const { data, error } = await requireSupabase().from('suppliers').select('*').order('name');
  if (error) throw error;
  return (data as SupplierRow[]).map(mapSupplier);
}

export async function createSupplier(input: SupplierInput): Promise<void> {
  const values = supplierSchema.parse(input);
  const { error } = await requireSupabase().from('suppliers').insert({
    name: values.name,
    contact: values.contact,
    email: values.email || null,
    phone: values.phone ?? null,
    address: values.address ?? null,
  });
  if (error) throw error;
}

export async function updateSupplier(id: string, input: Partial<SupplierInput>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.contact !== undefined) patch.contact = input.contact;
  if (input.email !== undefined) patch.email = input.email || null;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.address !== undefined) patch.address = input.address;
  if (Object.keys(patch).length === 0) return;
  const { error } = await requireSupabase().from('suppliers').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteSupplier(id: string): Promise<void> {
  const { error } = await requireSupabase().from('suppliers').delete().eq('id', id);
  if (error) throw error;
}
