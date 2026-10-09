import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { useStore } from '../context/StoreContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Plus, Search, TrendingUp, DollarSign, Package } from 'lucide-react';
import { toast } from 'sonner';
import type { Sale } from '../types';

export function Sales() {
  const { sales, products, addSale, currentUser, stores, stockByStore } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Sale>>({
    productId: '',
    quantity: 0,
    unitPrice: 0,
    totalPrice: 0,
    customerName: '',
    status: 'completed',
  });

  const storeName = (storeId?: string) =>
    stores.find((s) => s.id === storeId)?.name ?? '—';

  const storeStock = (storeId: string, productId: string) =>
    stockByStore.find((s) => s.storeId === storeId && s.productId === productId)?.quantity ?? 0;

  const selectedStoreId = formData.storeId ?? '';

  const handleStoreChange = (storeId: string) => {
    setFormData((prev) => {
      const product = products.find((p) => p.id === (prev.productId ?? ''));
      const available = storeStock(storeId, prev.productId ?? '');
      if (product && (prev.quantity ?? 0) > available) {
        toast.error('Stock insuffisant', {
          description: `Seulement ${available} unité(s) dans cette boutique.`,
        });
      }
      return { ...prev, storeId };
    });
  };

  const currentAvailable = selectedStoreId
    ? storeStock(selectedStoreId, formData.productId ?? '')
    : 0;

  const filteredSales = sales.filter((sale) => {
    const product = products.find((p) => p.id === sale.productId);
    const searchLower = searchTerm.toLowerCase();
    
    return (
      product?.name.toLowerCase().includes(searchLower) ||
      sale.customerName?.toLowerCase().includes(searchLower) ||
      storeName(sale.storeId).toLowerCase().includes(searchLower)
    );
  });

  const handleOpenDialog = () => {
    const defaultStore =
      stores.find((s) => s.isDispatchCenter) ?? stores[0];
    setFormData({
      productId: products[0]?.id || '',
      quantity: 1,
      unitPrice: products[0]?.price || 0,
      totalPrice: products[0]?.price || 0,
      customerName: '',
      status: 'completed',
      storeId: defaultStore?.id,
    });
    setIsDialogOpen(true);
  };

  const handleProductChange = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    setFormData((prev) => {
      const available = storeStock(prev.storeId ?? '', productId);
      const prevQuantity = prev.quantity ?? 0;
      if (prev.storeId && prevQuantity > available) {
        toast.error('Stock insuffisant', {
          description: `Seulement ${available} unité(s) dans cette boutique.`,
        });
      }
      const quantity = prev.storeId && prevQuantity > available ? 0 : prevQuantity;
      return {
        ...prev,
        productId,
        unitPrice: product?.price || 0,
        quantity,
        totalPrice: (product?.price || 0) * quantity,
      };
    });
  };

  const handleQuantityChange = (quantity: number) => {
    const product = products.find((p) => p.id === (formData.productId ?? ''));
    const max = selectedStoreId
      ? storeStock(selectedStoreId, formData.productId ?? '')
      : product?.stock ?? 0;

    if (quantity > max) {
      toast.error('Stock insuffisant', {
        description: `Seulement ${max} unité(s) disponible(s).`,
      });
      return;
    }

    setFormData({
      ...formData,
      quantity,
      totalPrice: quantity * (formData.unitPrice || 0),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const product = products.find((p) => p.id === formData.productId);
    
    if (!product) {
      toast.error('Produit invalide');
      return;
    }

    const max = selectedStoreId
      ? storeStock(selectedStoreId, formData.productId ?? '')
      : product.stock;

    if ((formData.quantity || 0) > max) {
      toast.error('Stock insuffisant', {
        description: `Seulement ${max} unité(s) disponible(s).`,
      });
      return;
    }

    addSale(formData as Omit<Sale, 'id' | 'date'>);
    toast.success('Vente enregistrée', {
      description: 'La vente a été enregistrée avec succès.',
    });
    setIsDialogOpen(false);
  };

  const totalSales = sales
    .filter((s) => s.status === 'completed')
    .reduce((sum, s) => sum + s.totalPrice, 0);
  
  const totalQuantity = sales
    .filter((s) => s.status === 'completed')
    .reduce((sum, s) => sum + s.quantity, 0);

  const getStatusBadge = (status: Sale['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700">Complété</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700">En attente</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Annulé</Badge>;
    }
  };

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="Ventes"
        title="Gestion des Ventes"
        subtitle="Enregistrez et suivez vos ventes par boutique"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total des Ventes</p>
                <p className="text-2xl font-bold text-gray-900">{totalSales.toFixed(2)} $</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Articles Vendus</p>
                <p className="text-2xl font-bold text-gray-900">{totalQuantity}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Nombre de Ventes</p>
                <p className="text-2xl font-bold text-gray-900">
                  {sales.filter((s) => s.status === 'completed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Historique des Ventes</CardTitle>
            <Button variant="brand" onClick={handleOpenDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle Vente
            </Button>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Rechercher par produit ou client..."
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
                  <TableHead>Date</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead>Boutique</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Quantité</TableHead>
                  <TableHead>Prix Unit.</TableHead>
                  <TableHead>Prix Total</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500">
                      Aucune vente trouvée
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSales
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((sale) => {
                      const product = products.find((p) => p.id === sale.productId);

                      return (
                        <TableRow key={sale.id}>
                          <TableCell>
                            {new Date(sale.date).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{product?.name}</p>
                              <p className="text-sm text-gray-500">{product?.sku}</p>
                            </div>
                          </TableCell>
                          <TableCell>{storeName(sale.storeId)}</TableCell>
                          <TableCell>{sale.customerName || 'N/A'}</TableCell>
                          <TableCell>{sale.quantity}</TableCell>
                          <TableCell>{sale.unitPrice.toFixed(2)} $</TableCell>
                          <TableCell className="font-semibold text-green-600">
                            {sale.totalPrice.toFixed(2)} $
                          </TableCell>
                          <TableCell>{getStatusBadge(sale.status)}</TableCell>
                        </TableRow>
                      );
                    })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog d'ajout */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle Vente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="storeId">Boutique *</Label>
                <select
                  id="storeId"
                  value={formData.storeId ?? ''}
                  onChange={(e) => handleStoreChange(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                >
                  <option value="">Sélectionner une boutique</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                      {store.isDispatchCenter ? ' (Dépôt)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="productId">Produit *</Label>
                <select
                  id="productId"
                  value={formData.productId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                >
                  <option value="">Sélectionner un produit</option>
                  {products
                    .filter((p) =>
                      selectedStoreId ? storeStock(selectedStoreId, p.id) > 0 : p.stock > 0
                    )
                    .map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} - Stock:{' '}
                        {selectedStoreId
                          ? storeStock(selectedStoreId, product.id)
                          : product.stock}{' '}
                        - {product.price.toFixed(2)} $
                      </option>
                    ))}
                </select>
              </div>

              {formData.productId && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700">
                    Stock disponible:{' '}
                    <span className="font-semibold">
                      {selectedStoreId
                        ? currentAvailable
                        : products.find((p) => p.id === formData.productId)?.stock || 0}{' '}
                      unité(s)
                    </span>
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="quantity">Quantité *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => handleQuantityChange(parseInt(e.target.value))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="unitPrice">Prix unitaire ($) *</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  step="0.01"
                  value={formData.unitPrice}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      unitPrice: parseFloat(e.target.value),
                      totalPrice: parseFloat(e.target.value) * (formData.quantity || 0),
                    })
                  }
                  required
                />
              </div>

              <div>
                <Label>Prix total</Label>
                <div className="text-2xl font-bold text-green-600">
                  {formData.totalPrice?.toFixed(2) || '0.00'} $
                </div>
              </div>

              <div>
                <Label htmlFor="customerName">Nom du client</Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  placeholder="Client particulier"
                />
              </div>

              <div>
                <Label htmlFor="status">Statut *</Label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as Sale['status'] })
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                >
                  <option value="completed">Complété</option>
                  <option value="pending">En attente</option>
                  <option value="cancelled">Annulé</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">Enregistrer la vente</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
