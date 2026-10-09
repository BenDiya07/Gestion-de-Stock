import { describe, expect, it } from 'vitest';
import { mapProduct } from './products.service';
import { mapSupplier } from './suppliers.service';
import { mapSupply } from './supplies.service';
import { mapSale } from './sales.service';
import { mapClient } from './clients.service';
import { mapProfile } from './users.service';
import { mapAudit } from './history.service';

describe('mapProduct', () => {
  it('convertit une ligne produits snake_case en modèle de domaine', () => {
    const product = mapProduct({
      id: 'p1',
      name: 'Ordinateur Portabole',
      sku: 'PC-001',
      category_id: 'c-id',
      supplier_id: 's-id',
      price: 899.99,
      cost: 650,
      stock: 5,
      min_stock: 3,
      description: 'laptop',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      categories: { name: 'Informatique' },
    });

    expect(product.category).toBe('Informatique');
    expect(product.supplierId).toBe('s-id');
    expect(product.price).toBe(899.99);
    expect(product.createdAt).toBeInstanceOf(Date);
  });

  it('tolère l’absence de catégorie et l’embedding sous forme de tableau', () => {
    const withoutCategory = mapProduct({
      id: 'p1', name: 'X', sku: 'X', category_id: null, supplier_id: null,
      price: 1, cost: 1, stock: 1, min_stock: 1, description: null,
      created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
    });
    expect(withoutCategory.category).toBe('');
    expect(withoutCategory.supplierId).toBe('');

    const withArray = mapProduct({
      id: 'p1', name: 'X', sku: 'X', category_id: 'c', supplier_id: null,
      price: 1, cost: 1, stock: 1, min_stock: 1, description: null,
      created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
      categories: [{ name: 'Stockage' }],
    });
    expect(withArray.category).toBe('Stockage');
  });
});

describe('mapSupplier', () => {
  it('convertit et applique des valeurs par défaut', () => {
    const supplier = mapSupplier({
      id: 's1', name: 'Alpha', contact: 'Jean', email: null, phone: null, address: null,
      created_at: '2024-01-01T00:00:00Z',
    });
    expect(supplier.name).toBe('Alpha');
    expect(supplier.email).toBe('');
    expect(supplier.phone).toBe('');
    expect(supplier.createdAt).toBeInstanceOf(Date);
  });
});

describe('mapSupply', () => {
  it('convertit une ligne approvisionnement', () => {
    const supply = mapSupply({
      id: 'app-1', supplier_id: 's1', product_id: 'p1', quantity: 20, cost: 15,
      total_cost: 300, status: 'pending', notes: 'livraison', created_at: '2024-01-01T00:00:00Z',
    });
    expect(supply.supplierId).toBe('s1');
    expect(supply.totalCost).toBe(300);
    expect(supply.status).toBe('pending');
    expect(supply.notes).toBe('livraison');
  });

  it('conserve un statut reçu et des notes vides', () => {
    const supply = mapSupply({
      id: 'a', supplier_id: 's', product_id: 'p', quantity: 1, cost: 1,
      total_cost: 1, status: 'received', notes: null, created_at: '2024-01-01T00:00:00Z',
    });
    expect(supply.status).toBe('received');
    expect(supply.notes).toBe('');
  });
});

describe('mapSale', () => {
  it('convertit une vente et conserve client optionnel', () => {
    const sale = mapSale({
      id: 'v1', product_id: 'p1', client_id: 'c1', customer_name: 'Société ABC',
      quantity: 2, unit_price: 10, total_price: 20, status: 'completed',
      created_at: '2024-01-01T00:00:00Z',
    });
    expect(sale.customerId).toBe('c1');
    expect(sale.customerName).toBe('Société ABC');
    expect(sale.totalPrice).toBe(20);
  });

  it('laisse les champs annexes undefined quand absents', () => {
    const sale = mapSale({
      id: 'v1', product_id: 'p1', client_id: null, customer_name: null,
      quantity: 1, unit_price: 5, total_price: 5, status: 'pending',
      created_at: '2024-01-01T00:00:00Z',
    });
    expect(sale.customerId).toBeUndefined();
    expect(sale.customerName).toBeUndefined();
  });
});

describe('mapClient', () => {
  it('convertit une ligne client', () => {
    const client = mapClient({
      id: 'c1', name: 'Pierre', email: 'p@x.fr', phone: '06', address: 'rue',
      city: 'Lyon', postal_code: '69001', company: 'ACME', notes: 'note',
      type: 'business', status: 'active', total_purchases: 100.5,
      created_at: '2024-01-01T00:00:00Z',
    });
    expect(client.company).toBe('ACME');
    expect(client.totalPurchases).toBe(100.5);
    expect(client.type).toBe('business');
  });
});

describe('mapProfile', () => {
  it('convertit un profil utilisateur', () => {
    const user = mapProfile({
      id: 'u1', full_name: 'Admin Principal', email: 'a@x.fr',
      role: 'admin', status: 'active', created_at: '2024-01-01T00:00:00Z',
    });
    expect(user.name).toBe('Admin Principal');
    expect(user.role).toBe('admin');
    expect(user.createdAt).toBeInstanceOf(Date);
  });
});

describe('mapAudit', () => {
  it('mappe entity_type sales vers sale et joint le nom de l’utilisateur', () => {
    const entry = mapAudit({
      id: 'h1', entity_type: 'sales', action: 'create', entity_id: 'v1',
      entity_name: 'Produit vendu', details: 'Qté: 2', user_id: 'u1',
      created_at: '2024-01-01T00:00:00Z',
      profiles: { full_name: 'Admin Principal' },
    });
    expect(entry.type).toBe('sale');
    expect(entry.action).toBe('create');
    expect(entry.userName).toBe('Admin Principal');
    expect(entry.details).toBe('Qté: 2');
  });

  it('retombe sur Système sans utilisateur associé', () => {
    const entry = mapAudit({
      id: 'h2', entity_type: 'products', action: 'delete', entity_id: 'p1',
      entity_name: 'PC', details: null, user_id: null, created_at: '2024-01-01T00:00:00Z',
    });
    expect(entry.type).toBe('product');
    expect(entry.userName).toBe('Système');
    expect(entry.details).toBeUndefined();
  });
});