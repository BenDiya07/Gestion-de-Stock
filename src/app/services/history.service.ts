import { requireSupabase } from '@/lib/supabase';
import type { HistoryEntry } from '../types';

interface AuditRowWithUser {
  id: string;
  entity_type: string;
  action: 'create' | 'update' | 'delete';
  entity_id: string | null;
  entity_name: string | null;
  details: string | null;
  user_id: string | null;
  created_at: string;
  profiles?: { full_name: string } | { full_name: string }[] | null;
}

const TYPE_MAP: Record<string, HistoryEntry['type']> = {
  products: 'product',
  suppliers: 'supplier',
  supplies: 'supply',
  sales: 'sale',
  profiles: 'user',
  clients: 'client',
};

function userName(row: AuditRowWithUser): string {
  const ref = row.profiles;
  if (!ref) return 'Système';
  return Array.isArray(ref) ? ref[0]?.full_name ?? 'Système' : ref.full_name;
}

export function mapAudit(row: AuditRowWithUser): HistoryEntry {
  return {
    id: row.id,
    type: TYPE_MAP[row.entity_type] ?? 'product',
    action: row.action,
    entityId: row.entity_id ?? '',
    entityName: row.entity_name ?? '',
    userId: row.user_id ?? '',
    userName: userName(row),
    timestamp: new Date(row.created_at),
    details: row.details ?? undefined,
  };
}

export async function listHistory(): Promise<HistoryEntry[]> {
  const { data, error } = await requireSupabase()
    .from('audit_log')
    .select('*, profiles:user_id(full_name)')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data as AuditRowWithUser[]).map(mapAudit);
}
