import { requireSupabase } from '@/lib/supabase';
import type { Client } from '../types';
import type { ClientRow } from '../types/db';
import { clientSchema, type ClientInput } from '../schemas';

export function mapClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? '',
    phone: row.phone ?? '',
    address: row.address ?? '',
    city: row.city ?? '',
    postalCode: row.postal_code ?? '',
    company: row.company ?? undefined,
    notes: row.notes ?? undefined,
    type: row.type,
    status: row.status,
    createdAt: new Date(row.created_at),
    totalPurchases: Number(row.total_purchases),
  };
}

export async function listClients(): Promise<Client[]> {
  const { data, error } = await requireSupabase().from('clients').select('*').order('name');
  if (error) throw error;
  return (data as ClientRow[]).map(mapClient);
}

function toRow(values: ClientInput) {
  return {
    name: values.name,
    email: values.email || null,
    phone: values.phone ?? null,
    address: values.address ?? null,
    city: values.city ?? null,
    postal_code: values.postalCode ?? null,
    company: values.company ?? null,
    notes: values.notes ?? null,
    type: values.type,
    status: values.status,
  };
}

export async function createClient(input: ClientInput): Promise<void> {
  const values = clientSchema.parse(input);
  const { error } = await requireSupabase().from('clients').insert(toRow(values));
  if (error) throw error;
}

export async function updateClient(id: string, input: Partial<ClientInput>): Promise<void> {
  const parsed = clientSchema.partial().parse(input);
  const patch: Record<string, unknown> = {};
  if (parsed.name !== undefined) patch.name = parsed.name;
  if (parsed.email !== undefined) patch.email = parsed.email || null;
  if (parsed.phone !== undefined) patch.phone = parsed.phone;
  if (parsed.address !== undefined) patch.address = parsed.address;
  if (parsed.city !== undefined) patch.city = parsed.city;
  if (parsed.postalCode !== undefined) patch.postal_code = parsed.postalCode;
  if (parsed.company !== undefined) patch.company = parsed.company;
  if (parsed.notes !== undefined) patch.notes = parsed.notes;
  if (parsed.type !== undefined) patch.type = parsed.type;
  if (parsed.status !== undefined) patch.status = parsed.status;

  if (Object.keys(patch).length === 0) return;
  const { error } = await requireSupabase().from('clients').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await requireSupabase().from('clients').delete().eq('id', id);
  if (error) throw error;
}
