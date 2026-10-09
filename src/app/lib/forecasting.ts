import type { Product, Sale } from '../types';

/**
 * Module d'alerte prédictive de rupture de stock.
 *
 * Au lieu d'un seuil fixe (`minStock`), on calcule un **point de commande
 * dynamique** à partir de la consommation récente :
 *
 *   stock de sécurité = z(service) × écart-type(conso journalière) × √(délai)
 *   point de commande = conso moyenne journalière × délai + stock de sécurité
 *
 * où `z` est le quantile de la loi normale associé au niveau de service visé.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

export type ForecastStatus = 'rupture' | 'critique' | 'a_commander' | 'ok';

export interface ForecastOptions {
  windowDays: number;
  leadTimeDays: number;
  serviceLevel: number;
}

export const DEFAULT_FORECAST_OPTIONS: ForecastOptions = {
  windowDays: 30,
  leadTimeDays: 7,
  serviceLevel: 0.95,
};

export interface ForecastResult {
  avgDailyDemand: number;
  demandStdDev: number;
  safetyStock: number;
  reorderPoint: number;
  daysOfStock: number;
  status: ForecastStatus;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Écart-type de population. */
export function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mu = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - mu) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Quantile de la loi normale pour un niveau de service donné. */
export function zForServiceLevel(level: number): number {
  if (level >= 0.999) return 3.09;
  if (level >= 0.99) return 2.326;
  if (level >= 0.975) return 1.96;
  if (level >= 0.95) return 1.645;
  if (level >= 0.9) return 1.282;
  return 1.0;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * Construit la série de consommation journalière sur `windowDays` jours
 * (jours sans vente comptés à zéro), du plus ancien au plus récent.
 */
export function buildDailySeries(
  sales: Sale[],
  windowDays: number,
  now: Date = new Date()
): number[] {
  const buckets = new Array<number>(windowDays).fill(0);
  const index = new Map<string, number>();

  for (let i = 0; i < windowDays; i += 1) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (windowDays - 1 - i));
    index.set(dayKey(day), i);
  }

  for (const sale of sales) {
    const key = dayKey(new Date(sale.date));
    const idx = index.get(key);
    if (idx !== undefined) buckets[idx] += sale.quantity;
  }

  return buckets;
}

export function computeForecast(
  stock: number,
  series: number[],
  options: ForecastOptions = DEFAULT_FORECAST_OPTIONS
): ForecastResult {
  const avgDailyDemand = mean(series);
  const demandStdDev = stdDev(series);
  const z = zForServiceLevel(options.serviceLevel);

  const safetyStock = z * demandStdDev * Math.sqrt(options.leadTimeDays);
  const reorderPoint = avgDailyDemand * options.leadTimeDays + safetyStock;
  const daysOfStock = avgDailyDemand > 0 ? stock / avgDailyDemand : Infinity;

  let status: ForecastStatus = 'ok';
  if (stock <= 0) status = 'rupture';
  else if (stock <= safetyStock) status = 'critique';
  else if (stock <= reorderPoint) status = 'a_commander';

  return {
    avgDailyDemand: round(avgDailyDemand, 2),
    demandStdDev: round(demandStdDev, 2),
    safetyStock: round(safetyStock, 1),
    reorderPoint: Math.ceil(reorderPoint),
    daysOfStock,
    status,
  };
}

export interface ProductForecast extends ForecastResult {
  product: Product;
}

export function forecastProduct(
  product: Product,
  sales: Sale[],
  options: ForecastOptions = DEFAULT_FORECAST_OPTIONS
): ProductForecast {
  const productSales = sales.filter(
    (s) => s.productId === product.id && s.status === 'completed'
  );
  const series = buildDailySeries(productSales, options.windowDays);
  return { product, ...computeForecast(product.stock, series, options) };
}

export function forecastAll(
  products: Product[],
  sales: Sale[],
  options: ForecastOptions = DEFAULT_FORECAST_OPTIONS
): ProductForecast[] {
  return products.map((product) => forecastProduct(product, sales, options));
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export const FORECAST_STATUS_LABEL: Record<ForecastStatus, string> = {
  rupture: 'Rupture',
  critique: 'Critique',
  a_commander: 'À commander',
  ok: 'OK',
};
