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
import {
  Warehouse,
  Store,
  MapPin,
  ArrowRightLeft,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Store as StoreType } from '../types';

export function Boutiques() {
  const {
    stores,
    stockByStore,
    products,
    currentUser,
    addStore,
    updateStore,
    deleteStore,
    transferStock,
  } = useStore();

  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';
  const depot = stores.find((s) => s.isDispatchCenter) ?? stores[0];

  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const selectedStore = stores.find((s) => s.id === selectedStoreId) ?? depot;

  const [isStoreDialogOpen, setIsStoreDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreType | null>(null);
  const [storeForm, setStoreForm] = useState({
    name: '',
    city: '',
    address: '',
    isDispatchCenter: false,
    status: 'active' as 'active' | 'inactive',
  });

  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    productId: '',
    quantity: 1,
  });

  const stockFor = (storeId: string, productId: string) =>
    stockByStore.find((s) => s.storeId === storeId && s.productId === productId)?.quantity ?? 0;

  const storeQuantity = (storeId: string) =>
    stockByStore
      .filter((s) => s.storeId === storeId)
      .reduce((sum, s) => sum + s.quantity, 0);

  const depotAvailable = (productId: string) => (depot ? stockFor(depot.id, productId) : 0);

  const handleStoreDialogOpen = (store?: StoreType) => {
    if (store) {
      setEditingStore(store);
      setStoreForm({
        name: store.name,
        city: store.city,
        address: store.address,
        isDispatchCenter: store.isDispatchCenter,
        status: store.status,
      });
    } else {
      setEditingStore(null);
      setStoreForm({ name: '', city: '', address: '', isDispatchCenter: false, status: 'active' });
    }
    setIsStoreDialogOpen(true);
  };

  const handleStoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Accès refusé', {
        description: 'Seuls les administrateurs peuvent modifier les boutiques.',
      });
      return;
    }
    if (editingStore) {
      updateStore(editingStore.id, storeForm);
      toast.success('Boutique modifiée');
    } else {
      addStore(storeForm);
      toast.success('Boutique ajoutée');
    }
    setIsStoreDialogOpen(false);
  };

  const handleDeleteStore = (store: StoreType) => {
    if (!isAdmin) {
      toast.error('Accès refusé');
      return;
    }
    if (confirm(`Supprimer la boutique ${store.name} ?`)) {
      deleteStore(store.id);
      toast.success('Boutique supprimée');
    }
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!depot || !selectedStore) return;
    const localDepot = depot;
    if (localDepot.id === selectedStore.id) {
      toast.error('Action impossible', {
        description: 'La répartition se fait du dépôt vers une boutique.',
      });
      return;
    }
    const qty = transferForm.quantity;
    const available = depotAvailable(transferForm.productId);
    if (qty <= 0 || qty > available) {
      toast.error('Quantité invalide', {
        description: `Stock disponible au dépôt : ${available}.`,
      });
      return;
    }
    transferStock({
      productId: transferForm.productId,
      quantity: qty,
      fromStoreId: localDepot.id,
      toStoreId: selectedStore.id,
    });
    toast.success('Répartition enregistrée', {
      description: `${qty} unité(s) répartie(s) vers ${selectedStore.name}.`,
    });
    setIsTransferOpen(false);
    setTransferForm({ productId: '', quantity: 1 });
  };

  const handleOpenTransfer = () => {
    if (!depot) return;
    const defaultProduct =
      products.find((p) => depotAvailable(p.id) > 0)?.id ?? '';
    setTransferForm({ productId: defaultProduct, quantity: 1 });
    setIsTransferOpen(true);
  };

  const productName = (productId: string) =>
    products.find((p) => p.id === productId)?.name ?? '—';

  return (
    <div className="p-8">
      <PageHeader
        eyebrow="Réseau"
        title="Boutiques Merkey"
        subtitle="Dépôt central, magasins et répartition des lunettes"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Boutiques</p>
                <p className="text-2xl font-bold text-gray-900">{stores.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
                <Warehouse className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Stock au dépôt</p>
                <p className="text-2xl font-bold text-gray-900">
                  {depot ? storeQuantity(depot.id) : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Stock en magasins</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stores
                    .filter((s) => !s.isDispatchCenter)
                    .reduce((sum, s) => sum + storeQuantity(s.id), 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Liste des boutiques */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Points de vente</CardTitle>
              {isAdmin && (
                <Button size="sm" variant="brand" onClick={() => handleStoreDialogOpen()}>
                  <Plus className="w-4 h-4 mr-1" />
                  Ajouter
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Boutique</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Articles</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stores.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500">
                        Aucune boutique
                      </TableCell>
                    </TableRow>
                  ) : (
                    stores.map((store) => (
                      <TableRow
                        key={store.id}
                        className={store.id === selectedStore?.id ? 'bg-blue-50' : ''}
                      >
                        <TableCell>
                          <button
                            className="font-medium text-left hover:underline"
                            onClick={() => setSelectedStoreId(store.id)}
                          >
                            {store.name}
                          </button>
                        </TableCell>
                        <TableCell>{store.city}</TableCell>
                        <TableCell>
                          {store.isDispatchCenter ? (
                            <Badge className="bg-blue-100 text-blue-700">Dépôt</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-600">Agence</Badge>
                          )}
                        </TableCell>
                        <TableCell>{storeQuantity(store.id)}</TableCell>
                        <TableCell className="text-right">
                          {isAdmin && (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStoreDialogOpen(store)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-500"
                                onClick={() => handleDeleteStore(store)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Stock de la boutique sélectionnée */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Stock — {selectedStore?.name ?? '—'}</CardTitle>
              {selectedStore && depot && selectedStore.id !== depot.id && (
                <Button size="sm" variant="brand" onClick={handleOpenTransfer}>
                  <ArrowRightLeft className="w-4 h-4 mr-1" />
                  Répartir
                </Button>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {selectedStore?.city} · {stockByStore.filter((s) => s.storeId === selectedStore?.id).length}{' '}
              référence(s)
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!selectedStore ||
                  stockByStore.filter((s) => s.storeId === selectedStore.id).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-gray-500">
                        Aucun stock
                      </TableCell>
                    </TableRow>
                  ) : (
                    stockByStore
                      .filter((s) => s.storeId === selectedStore.id)
                      .sort((a, b) => a.productName.localeCompare(b.productName))
                      .map((line) => (
                        <TableRow key={line.productId}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{line.productName}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {line.productSku}
                          </TableCell>
                          <TableCell
                            className={`text-right font-semibold ${
                              line.quantity === 0 ? 'text-red-500' : 'text-gray-900'
                            }`}
                          >
                            {line.quantity}
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog boutique */}
      <Dialog open={isStoreDialogOpen} onOpenChange={setIsStoreDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingStore ? 'Modifier la boutique' : 'Nouvelle boutique'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleStoreSubmit}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="storeName">Nom *</Label>
                <Input
                  id="storeName"
                  value={storeForm.name}
                  onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="storeCity">Ville *</Label>
                <Input
                  id="storeCity"
                  value={storeForm.city}
                  onChange={(e) => setStoreForm({ ...storeForm, city: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="storeAddress">Adresse</Label>
                <Input
                  id="storeAddress"
                  value={storeForm.address}
                  onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={storeForm.isDispatchCenter}
                  onChange={(e) =>
                    setStoreForm({ ...storeForm, isDispatchCenter: e.target.checked })
                  }
                />
                Dépôt central (reçoit les approvisionnements)
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsStoreDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">
                {editingStore ? 'Enregistrer' : 'Ajouter'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog répartition */}
      <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Répartir du dépôt vers {selectedStore?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTransferSubmit}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="productId">Produit *</Label>
                <select
                  id="productId"
                  value={transferForm.productId}
                  onChange={(e) => setTransferForm({ ...transferForm, productId: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                >
                  <option value="">Sélectionner un produit</option>
                  {products
                    .filter((p) => depotAvailable(p.id) > 0)
                    .map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} — Dispo dépôt : {depotAvailable(product.id)} ·{' '}
                        {product.price.toFixed(2)} $
                      </option>
                    ))}
                </select>
              </div>

              {transferForm.productId && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700">
                    Stock au dépôt :{' '}
                    <span className="font-semibold">
                      {depotAvailable(transferForm.productId)} unité(s)
                    </span>
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="quantity">
                  Quantité * (max {depotAvailable(transferForm.productId)})
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max={depotAvailable(transferForm.productId) || 1}
                  value={transferForm.quantity}
                  onChange={(e) =>
                    setTransferForm({
                      ...transferForm,
                      quantity: parseInt(e.target.value) || 0,
                    })
                  }
                  required
                />
              </div>

              {transferForm.productId && (
                <p className="text-sm text-gray-500">
                  Transfert de {transferForm.quantity || 0} × {productName(transferForm.productId)}{' '}
                  vers {selectedStore?.name}.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsTransferOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">Répartir</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}