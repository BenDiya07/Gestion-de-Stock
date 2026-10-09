import { useState } from 'react';
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
import { Plus, Search, Package, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Supply } from '../types';

export function Supplies() {
  const { supplies, products, suppliers, addSupply, updateSupply, currentUser } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Supply>>({
    supplierId: '',
    productId: '',
    quantity: 0,
    cost: 0,
    totalCost: 0,
    status: 'pending',
    notes: '',
  });

  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';

  const filteredSupplies = supplies.filter((supply) => {
    const product = products.find((p) => p.id === supply.productId);
    const supplier = suppliers.find((s) => s.id === supply.supplierId);
    const searchLower = searchTerm.toLowerCase();
    
    return (
      product?.name.toLowerCase().includes(searchLower) ||
      supplier?.name.toLowerCase().includes(searchLower)
    );
  });

  const handleOpenDialog = () => {
    setFormData({
      supplierId: suppliers[0]?.id || '',
      productId: products[0]?.id || '',
      quantity: 0,
      cost: products[0]?.cost || 0,
      totalCost: 0,
      status: 'pending',
      notes: '',
    });
    setIsDialogOpen(true);
  };

  const handleProductChange = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    setFormData({
      ...formData,
      productId,
      supplierId: product?.supplierId || formData.supplierId,
      cost: product?.cost || 0,
      totalCost: (product?.cost || 0) * (formData.quantity || 0),
    });
  };

  const handleQuantityChange = (quantity: number) => {
    setFormData({
      ...formData,
      quantity,
      totalCost: quantity * (formData.cost || 0),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAdmin) {
      toast.error('Accès refusé', {
        description: 'Seuls les administrateurs peuvent ajouter des approvisionnements.',
      });
      return;
    }

    addSupply(formData as Omit<Supply, 'id' | 'date'>);
    toast.success('Approvisionnement créé', {
      description: 'L\'approvisionnement a été créé avec succès.',
    });
    setIsDialogOpen(false);
  };

  const handleStatusChange = (id: string, status: Supply['status']) => {
    if (!isAdmin) {
      toast.error('Accès refusé');
      return;
    }

    updateSupply(id, { status });
    toast.success('Statut mis à jour', {
      description: status === 'received' 
        ? 'Le stock a été mis à jour automatiquement.'
        : 'Le statut a été modifié.',
    });
  };

  const getStatusBadge = (status: Supply['status']) => {
    switch (status) {
      case 'received':
        return <Badge className="bg-green-100 text-green-700">Reçu</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700">En attente</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Annulé</Badge>;
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Gestion des Approvisionnements</h1>
        <p className="text-gray-500 mt-1">Suivez vos commandes fournisseurs</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Liste des Approvisionnements</CardTitle>
            {isAdmin && (
              <Button onClick={handleOpenDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Nouvel Approvisionnement
              </Button>
            )}
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Rechercher par produit ou fournisseur..."
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
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Quantité</TableHead>
                  <TableHead>Coût Unitaire</TableHead>
                  <TableHead>Coût Total</TableHead>
                  <TableHead>Statut</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSupplies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500">
                      Aucun approvisionnement trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSupplies
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((supply) => {
                      const product = products.find((p) => p.id === supply.productId);
                      const supplier = suppliers.find((s) => s.id === supply.supplierId);

                      return (
                        <TableRow key={supply.id}>
                          <TableCell>
                            {new Date(supply.date).toLocaleDateString('fr-FR')}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{product?.name}</p>
                              <p className="text-sm text-gray-500">{product?.sku}</p>
                            </div>
                          </TableCell>
                          <TableCell>{supplier?.name}</TableCell>
                          <TableCell>{supply.quantity}</TableCell>
                          <TableCell>{supply.cost.toFixed(2)} €</TableCell>
                          <TableCell className="font-semibold">
                            {supply.totalCost.toFixed(2)} €
                          </TableCell>
                          <TableCell>{getStatusBadge(supply.status)}</TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {supply.status === 'pending' && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleStatusChange(supply.id, 'received')}
                                      title="Marquer comme reçu"
                                    >
                                      <Check className="w-4 h-4 text-green-600" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleStatusChange(supply.id, 'cancelled')}
                                      title="Annuler"
                                    >
                                      <X className="w-4 h-4 text-red-600" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Summary */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-yellow-100 text-yellow-600 flex items-center justify-center">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">En attente</p>
                    <p className="text-xl font-bold">
                      {supplies.filter((s) => s.status === 'pending').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Reçus</p>
                    <p className="text-xl font-bold">
                      {supplies.filter((s) => s.status === 'received').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Coût total</p>
                    <p className="text-xl font-bold">
                      {supplies
                        .filter((s) => s.status === 'received')
                        .reduce((sum, s) => sum + s.totalCost, 0)
                        .toFixed(2)}{' '}
                      €
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Dialog d'ajout */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvel Approvisionnement</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
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
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="supplierId">Fournisseur *</Label>
                <select
                  id="supplierId"
                  value={formData.supplierId}
                  onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                >
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>

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
                <Label htmlFor="cost">Coût unitaire (€) *</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cost: parseFloat(e.target.value),
                      totalCost: parseFloat(e.target.value) * (formData.quantity || 0),
                    })
                  }
                  required
                />
              </div>

              <div>
                <Label>Coût total</Label>
                <div className="text-2xl font-bold text-blue-600">
                  {formData.totalCost?.toFixed(2) || '0.00'} €
                </div>
              </div>

              <div>
                <Label htmlFor="status">Statut *</Label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as Supply['status'] })
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                >
                  <option value="pending">En attente</option>
                  <option value="received">Reçu</option>
                  <option value="cancelled">Annulé</option>
                </select>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">Créer l'approvisionnement</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
