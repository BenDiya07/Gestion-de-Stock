import { describe, expect, it } from 'vitest';
import type { Product, Sale } from '../types';
import {
  buildDailySeries,
  computeForecast,
  mean,
  stdDev,
  zForServiceLevel,
  forecastProduct,
} from './forecasting';

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Produit test',
    sku: 'TST-001',
    category: 'Divers',
    price: 10,
    cost: 5,
    stock: 100,
    minStock: 10,
    supplierId: 's1',
    description: '',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function sale(date: Date, quantity: number, overrides: Partial<Sale> = {}): Sale {
  return {
    id: Math.random().toString(36),
    productId: 'p1',
    quantity,
    unitPrice: 10,
    totalPrice: 10 * quantity,
    date,
    status: 'completed',
    ...overrides,
  };
}

describe('mean / stdDev', () => {
  it('calcule la moyenne', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(mean([])).toBe(0);
  });

  it('calcule l’écart-type de population', () => {
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 5);
    expect(stdDev([5, 5, 5])).toBe(0);
  });
});

describe('zForServiceLevel', () => {
  it('associe les quantiles usuels', () => {
    expect(zForServiceLevel(0.95)).toBeCloseTo(1.645, 3);
    expect(zForServiceLevel(0.99)).toBeCloseTo(2.326, 3);
    expect(zForServiceLevel(0.5)).toBe(1.0);
  });
});

describe('buildDailySeries', () => {
  it('agrège les ventes par jour et complète les jours vides', () => {
    const now = new Date('2024-03-10T12:00:00');
    const sales = [
      sale(new Date('2024-03-10T09:00:00'), 2),
      sale(new Date('2024-03-10T18:00:00'), 3),
      sale(new Date('2024-03-08T10:00:00'), 1),
    ];
    const series = buildDailySeries(sales, 5, now);
    expect(series).toHaveLength(5);
    expect(series[4]).toBe(5); // aujourd'hui
    expect(series[2]).toBe(1); // il y a 2 jours
    expect(series[0]).toBe(0);
  });

  it('ignore les ventes hors fenêtre', () => {
    const now = new Date('2024-03-10T12:00:00');
    const series = buildDailySeries([sale(new Date('2024-01-01T10:00:00'), 99)], 5, now);
    expect(series.every((v) => v === 0)).toBe(true);
  });
});

describe('computeForecast', () => {
  it('ne déclenche aucune alerte sans demande', () => {
    const result = computeForecast(50, [0, 0, 0, 0, 0, 0, 0]);
    expect(result.avgDailyDemand).toBe(0);
    expect(result.safetyStock).toBe(0);
    expect(result.reorderPoint).toBe(0);
    expect(result.status).toBe('ok');
  });

  it('calcule un point de commande dynamique', () => {
    // 2 unités/jour constants : sigma = 0, délai 7 -> point = 14
    const series = new Array(30).fill(2);
    const result = computeForecast(100, series, {
      windowDays: 30,
      leadTimeDays: 7,
      serviceLevel: 0.95,
    });
    expect(result.avgDailyDemand).toBe(2);
    expect(result.safetyStock).toBe(0);
    expect(result.reorderPoint).toBe(14);
    expect(result.status).toBe('ok');
  });

  it('passe en “à commander” sous le point de commande', () => {
    const series = new Array(30).fill(2); // point = 14
    expect(computeForecast(14, series).status).toBe('a_commander');
    expect(computeForecast(10, series).status).toBe('a_commander');
  });

  it('passe en rupture à stock nul', () => {
    expect(computeForecast(0, new Array(30).fill(2)).status).toBe('rupture');
  });

  it('intègre un stock de sécurité quand la demande varie', () => {
    const series = [0, 4, 0, 4, 0, 4, 0, 4];
    const result = computeForecast(50, series, {
      windowDays: 8,
      leadTimeDays: 4,
      serviceLevel: 0.95,
    });
    expect(result.safetyStock).toBeGreaterThan(0);
    expect(result.reorderPoint).toBeGreaterThan(result.avgDailyDemand * 4);
  });
});

describe('forecastProduct', () => {
  it('utilise uniquement les ventes completed du produit', () => {
    const now = new Date();
    const sales = [
      sale(now, 3),
      sale(now, 1, { status: 'pending' }),
      sale(now, 5, { productId: 'other' }),
    ];
    const result = forecastProduct(product(), sales, {
      windowDays: 1,
      leadTimeDays: 7,
      serviceLevel: 0.95,
    });
    expect(result.avgDailyDemand).toBe(3);
  });
});
