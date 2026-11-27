import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { useStore } from '../context/StoreContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import {
  Search,
  ShoppingBag,
  DollarSign,
  Clock,
  CheckCircle2,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Order, OrderStatus } from '../types';

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  preparing: 'En préparation',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

const STATUS_CLASSES: Record<OrderStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  preparing: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  shipped: 'bg-purple-50 text-purple-700 border-purple-200',
  delivered: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_OPTIONS: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'shipped',
  'delivered',
  'cancelled',
];

export function Orders() {
  const { orders, updateOrderStatus, stores } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const storeName = (storeId?: string) =>
    stores.find((s) => s.id === storeId)?.name ?? 'Dépôt central';

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter(
      (order) =>
        order.reference.toLowerCase().includes(term) ||
        order.customerName.toLowerCase().includes(term) ||
        order.customerPhone.toLowerCase().includes(term) ||
        (order.customerCity ?? '').toLowerCase().includes(term)
    );
  }, [orders, searchTerm]);

  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const deliveredCount = orders.filter((o) => o.status === 'delivered').length;
  const revenue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.total, 0);

  const handleStatusChange = (order: Order, status: OrderStatus) => {
    updateOrderStatus(order.id, status);
    toast.success('Statut mis à jour', {
      description: `${order.reference} → ${STATUS_LABELS[status]}`,
    });
    if (selectedOrder?.id === order.id) {
      setSelectedOrder({ ...selectedOrder, status });
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Vitrine"
        title="Commandes en ligne"
        subtitle="Suivez les commandes passées sur le site Merkey (paiement à la livraison)"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <Clock className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">En attente</p>
              <p className="text-2xl font-semibold">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-5 w-5 text-green-700" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Livrées</p>
              <p className="text-2xl font-semibold">{deliveredCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/15">
              <DollarSign className="h-5 w-5 text-brand" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Chiffre d'affaires</p>
              <p className="text-2xl font-semibold">{revenue.toFixed(2)} $</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Liste des commandes</CardTitle>
            <Badge variant="outline" className="w-fit">
              {orders.length} commande{orders.length > 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher par référence, client ou téléphone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Articles</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500">
                      <div className="flex flex-col items-center gap-2 py-6">
                        <ShoppingBag className="h-8 w-8 text-gray-300" />
                        <span>Aucune commande en ligne pour le moment</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => {
                    const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
                    return (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-sm">{order.reference}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{order.customerName}</p>
                            <p className="text-sm text-gray-500">{order.customerPhone}</p>
                          </div>
                        </TableCell>
                        <TableCell>{order.customerCity ?? '—'}</TableCell>
                        <TableCell>{units}</TableCell>
                        <TableCell className="font-medium">{order.total.toFixed(2)} $</TableCell>
                        <TableCell>
                          <select
                            value={order.status}
                            onChange={(e) =>
                              handleStatusChange(order, e.target.value as OrderStatus)
                            }
                            className={`h-8 rounded-md border px-2 text-xs font-medium ${STATUS_CLASSES[order.status]}`}
                          >
                            {STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>
                                {STATUS_LABELS[status]}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {order.createdAt.toLocaleDateString('fr-FR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(order)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Commande {selectedOrder?.reference}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Client</p>
                  <p className="font-medium">{selectedOrder.customerName}</p>
                  <p className="text-sm text-gray-500">{selectedOrder.customerPhone}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Livraison</p>
                  <p className="font-medium">{selectedOrder.customerCity ?? '—'}</p>
                  <p className="text-sm text-gray-500">
                    {selectedOrder.paymentMethod === 'cod'
                      ? 'Paiement à la livraison'
                      : selectedOrder.paymentMethod}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Statut</p>
                  <Badge variant="outline" className={STATUS_CLASSES[selectedOrder.status]}>
                    {STATUS_LABELS[selectedOrder.status]}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Boutique</p>
                  <p className="font-medium">{storeName(selectedOrder.storeId)}</p>
                </div>
              </div>

              {selectedOrder.note && (
                <div className="rounded-lg bg-gray-50 p-3 text-sm">
                  <span className="font-medium">Note : </span>
                  {selectedOrder.note}
                </div>
              )}

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead>Qté</TableHead>
                      <TableHead>Prix unitaire</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOrder.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.unitPrice.toFixed(2)} $</TableCell>
                        <TableCell className="text-right">
                          {item.lineTotal.toFixed(2)} $
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="ml-auto max-w-xs space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Sous-total</span>
                  <span>{selectedOrder.subtotal.toFixed(2)} $</span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Remise</span>
                    <span>-{selectedOrder.discount.toFixed(2)} $</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Livraison</span>
                  <span>
                    {selectedOrder.shipping > 0
                      ? `${selectedOrder.shipping.toFixed(2)} $`
                      : 'Offerte'}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1 font-semibold">
                  <span>Total</span>
                  <span>{selectedOrder.total.toFixed(2)} $</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
