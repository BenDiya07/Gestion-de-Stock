import { requireSupabase } from '@/lib/supabase';
import type { User } from '../types';
import type { ProfileRow } from '../types/db';
import { userSchema, type UserInput } from '../schemas';

export function mapProfile(row: ProfileRow): User {
  return {
    id: row.id,
    name: row.full_name,
    email: row.email ?? '',
    role: row.role,
    status: row.status,
    createdAt: new Date(row.created_at),
  };
}

export async function listProfiles(): Promise<User[]> {
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('*')
    .order('created_at');
  if (error) throw error;
  return (data as ProfileRow[]).map(mapProfile);
}

export async function updateProfile(id: string, input: Partial<UserInput>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.full_name = input.name;
  if (input.role !== undefined) patch.role = input.role;
  if (input.status !== undefined) patch.status = input.status;
  if (Object.keys(patch).length === 0) return;
  const { error } = await requireSupabase().from('profiles').update(patch).eq('id', id);
  if (error) throw error;
}

/**
 * La création/suppression de comptes est une opération d'administration qui
 * nécessite la clé `service_role`. Elle est déléguée à une Edge Function
 * (`admin-users`) qui vérifie que l'appelant est bien administrateur.
 */
export async function createUser(input: UserInput): Promise<void> {
  const values = userSchema.parse(input);
  const { error } = await requireSupabase().functions.invoke('admin-users', {
    body: {
      action: 'create',
      email: values.email,
      fullName: values.name,
      role: values.role,
    },
  });
  if (error) throw error;
}

export async function deleteUser(id: string): Promise<void> {
  const { error } = await requireSupabase().functions.invoke('admin-users', {
    body: { action: 'delete', id },
  });
  if (error) throw error;
}
