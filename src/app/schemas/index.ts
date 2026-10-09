import { z } from 'zod';

/**
 * Schémas de validation (Zod).
 *
 * Ils complètent les contraintes PostgreSQL : la validation est appliquée côté
 * client pour l'ergonomie, et les contraintes de base garantissent l'intégrité.
 */

export const productSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis'),
  sku: z.string().trim().min(1, 'Le SKU est requis'),
  category: z.string().trim().min(1, 'La catégorie est requise'),
  price: z.coerce.number().nonnegative('Le prix doit être positif'),
  cost: z.coerce.number().nonnegative("Le coût doit être positif"),
  stock: z.coerce.number().int().nonnegative('Le stock doit être positif'),
  minStock: z.coerce.number().int().nonnegative('Le stock minimum doit être positif'),
  supplierId: z.string().uuid().or(z.literal('')).optional(),
  description: z.string().optional(),
});
export type ProductInput = z.infer<typeof productSchema>;

export const supplierSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis'),
  contact: z.string().trim().min(1, 'Le contact est requis'),
  email: z.string().email('Email invalide').or(z.literal('')).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});
export type SupplierInput = z.infer<typeof supplierSchema>;

export const supplySchema = z.object({
  supplierId: z.string().uuid('Fournisseur invalide'),
  productId: z.string().uuid('Produit invalide'),
  quantity: z.coerce.number().int().positive('Quantité invalide'),
  cost: z.coerce.number().nonnegative('Coût invalide'),
  status: z.enum(['pending', 'received', 'cancelled']).default('pending'),
  notes: z.string().optional(),
});
export type SupplyInput = z.infer<typeof supplySchema>;

export const saleSchema = z.object({
  productId: z.string().uuid('Produit invalide'),
  quantity: z.coerce.number().int().positive('Quantité invalide'),
  unitPrice: z.coerce.number().nonnegative('Prix invalide'),
  customerName: z.string().optional(),
  status: z.enum(['completed', 'pending', 'cancelled']).default('completed'),
});
export type SaleInput = z.infer<typeof saleSchema>;

export const clientSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis'),
  email: z.string().email('Email invalide').or(z.literal('')).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  company: z.string().optional(),
  notes: z.string().optional(),
  type: z.enum(['individual', 'business']).default('individual'),
  status: z.enum(['active', 'inactive']).default('active'),
});
export type ClientInput = z.infer<typeof clientSchema>;

export const userSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis'),
  email: z.string().email('Email invalide'),
  role: z.enum(['admin', 'manager', 'employee']).default('employee'),
  status: z.enum(['active', 'inactive']).default('active'),
});
export type UserInput = z.infer<typeof userSchema>;
