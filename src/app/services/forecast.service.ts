import { requireSupabase } from '@/lib/supabase';
import type { ForecastOptions, ForecastStatus } from '../lib/forecasting';

/** Ligne de prévision (identique côté serveur PostgreSQL et côté client). */
export interface ForecastRow {
  productId: string;
  name: string;
  sku: string;
  stock: number;
  avgDailyDemand: number;
  demandStdDev: number;
  safetyStock: number;
  reorderPoint: number;
  daysOfStock: number;
  status: ForecastStatus;
}

interface ForecastRowSql {
  product_id: string;
  name: string;
  sku: string;
  stock: number;
  avg_daily_demand: number;
  demand_stddev: number;
  safety_stock: number;
  reorder_point: number;
  days_of_stock: number | null;
  status: ForecastStatus;
}

/**
 * Délègue les calculs statistiques à PostgreSQL via un appel RPC unique.
 * Utilisé en mode Supabase (le client garde le calcul local en mode démo).
 */
export async function fetchForecasts(
  options: ForecastOptions
): Promise<ForecastRow[]> {
  const { data, error } = await requireSupabase().rpc('product_forecast_all', {
    p_window_days: options.windowDays,
    p_lead_time_days: options.leadTimeDays,
    p_service_level: options.serviceLevel,
  });
  if (error) throw error;

  return ((data as ForecastRowSql[]) ?? []).map((row) => ({
    productId: row.product_id,
    name: row.name,
    sku: row.sku,
    stock: Number(row.stock),
    avgDailyDemand: Number(row.avg_daily_demand),
    demandStdDev: Number(row.demand_stddev),
    safetyStock: Number(row.safety_stock),
    reorderPoint: Number(row.reorder_point),
    daysOfStock: row.days_of_stock != null ? Number(row.days_of_stock) : Infinity,
    status: row.status,
  }));
}