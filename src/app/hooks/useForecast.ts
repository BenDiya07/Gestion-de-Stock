import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isDemoMode } from '@/lib/env';
import { useStore } from '../context/StoreContext';
import { forecastAll, type ForecastOptions, type ForecastStatus } from '../lib/forecasting';
import { fetchForecasts, type ForecastRow } from '../services/forecast.service';

const STATUS_ORDER: Record<ForecastStatus, number> = {
  rupture: 0,
  critique: 1,
  a_commander: 2,
  ok: 3,
};

function localForecasts(
  products: ReturnType<typeof useStore>['products'],
  sales: ReturnType<typeof useStore>['sales'],
  options: ForecastOptions
): ForecastRow[] {
  return forecastAll(products, sales, options)
    .map((f) => ({
      productId: f.product.id,
      name: f.product.name,
      sku: f.product.sku,
      stock: f.product.stock,
      avgDailyDemand: f.avgDailyDemand,
      demandStdDev: f.demandStdDev,
      safetyStock: f.safetyStock,
      reorderPoint: f.reorderPoint,
      daysOfStock: f.daysOfStock,
      status: f.status,
    }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

/**
 * Prévisions de rupture.
 *
 * - Mode Supabase : les calculs sont délégués à PostgreSQL (RPC
 *   `product_forecast_all`) — un seul appel réseau, agrégations en base.
 * - Mode démo : calcul local à partir des données en mémoire.
 */
export function useForecast(options: ForecastOptions) {
  const { products, sales } = useStore();

  const query = useQuery({
    queryKey: ['forecasts', options.windowDays, options.leadTimeDays, options.serviceLevel],
    queryFn: () => fetchForecasts(options),
    enabled: !isDemoMode,
  });

  const local = useMemo(
    () => (isDemoMode ? localForecasts(products, sales, options) : []),
    [products, sales, options]
  );

  const server = query.data ?? [];

  return {
    forecasts: isDemoMode ? local : [...server].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
    isLoading: isDemoMode ? false : query.isLoading,
  };
}