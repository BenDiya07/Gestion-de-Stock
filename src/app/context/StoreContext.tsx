import { type ReactNode } from 'react';
import { isDemoMode } from '@/lib/env';
import { MockStoreProvider } from './MockStoreProvider';
import { SupabaseStoreProvider } from './SupabaseStoreProvider';

export { useStore } from './store';
export type { StoreContextType } from './store';

/**
 * Point d'entrée unique du store applicatif.
 *
 * - Sans Supabase configuré : store en mémoire (mode démo).
 * - Avec Supabase : données persistées, authentification et RLS.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  return isDemoMode ? (
    <MockStoreProvider>{children}</MockStoreProvider>
  ) : (
    <SupabaseStoreProvider>{children}</SupabaseStoreProvider>
  );
}
