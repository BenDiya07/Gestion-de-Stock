/**
 * Sourcing des variables Supabase.
 *
 * Deux familles de variables sont acceptées :
 *  - `VITE_SUPABASE_*` : variables locales (`.env`) et recommandées sur Vercel ;
 *  - `SUPABASE_URL` / `SUPABASE_ANON_KEY` : variables ajoutées automatiquement
 *    par l'intégration Vercel ↔ Supabase (exposées au client via
 *    `envPrefix` dans vite.config.ts).
 */
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured =
  SUPABASE_URL.trim().length > 0 && SUPABASE_ANON_KEY.trim().length > 0;

export const isDemoMode = !isSupabaseConfigured;
