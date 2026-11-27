import { requireSupabase } from '@/lib/supabase';
import type { Order, OrderItem, OrderStatus } from '../types';
import type { OrderItemRow, OrderRow } from '../types/db';
import { orderStatusSchema } from '../schemas';

export function mapOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id ?? undefined,
    productName: row.product_name,
    unitPrice: Number(row.unit_price),
    quantity: Number(row.quantity),
    lineTotal: Number(row.line_total),
  };
}

export function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    reference: row.reference,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerCity: row.customer_city ?? undefined,
    note: row.note ?? undefined,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    shipping: Number(row.shipping),
    total: Number(row.total),
    promoCode: row.promo_code ?? undefined,
    paymentMethod: row.payment_method,
    status: row.status,
    stockApplied: row.stock_applied,
    storeId: row.store_id ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    items: (row.order_items ?? []).map(mapOrderItem),
  };
}

export async function listOrders(): Promise<Order[]> {
  const { data, error } = await requireSupabase()
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as OrderRow[]).map(mapOrder);
}

/**
 * Change le statut d'une commande. Le déstockage (ou le réapprovisionnement en
 * cas d'annulation) est appliqué par un trigger côté base : aucune écriture
 * directe dans `stock_movements` n'est nécessaire ici.
 */
export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const value = orderStatusSchema.parse(status);
  const { error } = await requireSupabase()
    .from('orders')
    .update({ status: value })
    .eq('id', id);
  if (error) throw error;
}
