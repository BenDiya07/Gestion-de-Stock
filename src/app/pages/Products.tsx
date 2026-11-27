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
import { Plus, Pencil, Trash2, Search, AlertTriangle, Upload, Loader2, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { Product } from '../types';
import { uploadProductImage } from '../services/products.service';

const emptyProductForm: Partial<Product> = {
  name: '',
  sku: '',
  category: '',
  price: 0,
  cost: 0,
  stock: 0,
  minStock: 0,
  supplierId: '',
  description: '',
  imageUrl: '',
  gallery: [],
  compareAtPrice: undefined,
  features: [],
  isFeatured: false,
  isNew: false,
  isActive: true,
};

export function Products() {
  const {
    products,
    suppliers,
    addProduct,
    updateProduct,
    deleteProduct,
    currentUser,
    isDemoMode,
  } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState<Partial<Product>>({ ...emptyProductForm });
  const [featuresText, setFeaturesText] = useState('');
  const [galleryText, setGalleryText] = useState('');

  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData(product);
      setFeaturesText((product.features ?? []).join('\n'));
      setGalleryText((product.gallery ?? []).join('\n'));
    } else {
      setEditingProduct(null);
      setFormData({ ...emptyProductForm, supplierId: suppliers[0]?.id || '' });
      setFeaturesText('');
      setGalleryText('');
    }
    setIsDialogOpen(true);
  };

  const handleImageUpload = async (file: File | undefined) => {
    if (!file) return;
    if (isDemoMode) {
      toast.error('Mode démo', {
        description: 'Connectez Supabase pour téléverser des images.',
      });
      return;
    }
    setUploading(true);
    try {
      const url = await uploadProductImage(file);
      setFormData((prev) => ({ ...prev, imageUrl: url }));
      toast.success('Image téléversée');
    } catch (error) {
      toast.error('Échec du téléversement', { description: (error as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const textToList = (value: string) =>
    value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAdmin) {
      toast.error('Accès refusé', {
        description: 'Seuls les administrateurs peuvent modifier les produits.',
      });
      return;
    }

    const payload: Partial<Product> = {
      ...formData,
      features: textToList(featuresText),
      gallery: textToList(galleryText),
    };

    if (editingProduct) {
      updateProduct(editingProduct.id, payload);
      toast.success('Produit modifié', {
        description: `${payload.name} a été modifié avec succès.`,
      });
    } else {
      addProduct(payload as Omit<Product, 'id' | 'createdAt' | 'updatedAt'>);
      toast.success('Produit ajouté', {
        description: `${payload.name} a été ajouté avec succès.`,
      });
    }
    setIsDialogOpen(false);
  };

  const handleDelete = (product: Product) => {
    if (!isAdmin) {
      toast.error('Accès refusé', {
        description: 'Seuls les administrateurs peuvent supprimer les produits.',
      });
      return;
    }

    if (confirm(`Êtes-vous sûr de vouloir supprimer ${product.name} ?`)) {
      deleteProduct(product.id);
      toast.success('Produit supprimé', {
        description: `${product.name} a été supprimé avec succès.`,
      });
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Catalogue"
        title="Gestion des Produits"
        subtitle="Gérez votre catalogue de lunettes"
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Liste des Produits</CardTitle>
            {isAdmin && (
              <Button
                variant="brand"
                className="w-full sm:w-auto"
                onClick={() => handleOpenDialog()}
              >
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un Produit
              </Button>
            )}
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Rechercher par nom, SKU ou catégorie..."
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
                  <TableHead>Nom</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Prix</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Stock Min</TableHead>
                  <TableHead>Statut</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500">
                      Aucun produit trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => {
                    const supplier = suppliers.find((s) => s.id === product.supplierId);
                    const isLowStock = product.stock < product.minStock;

                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="h-10 w-10 rounded-md object-cover"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100">
                                <ImageIcon className="h-4 w-4 text-gray-400" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{product.name}</p>
                              <p className="text-sm text-gray-500">{supplier?.name}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{product.category}</Badge>
                        </TableCell>
                        <TableCell>{product.price.toFixed(2)} $</TableCell>
                        <TableCell>
                          <span
                            className={
                              isLowStock ? 'text-red-600 font-semibold' : 'text-gray-900'
                            }
                          >
                            {product.stock}
                          </span>
                        </TableCell>
                        <TableCell>{product.minStock}</TableCell>
                        <TableCell>
                          {isLowStock ? (
                            <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                              <AlertTriangle className="w-3 h-3" />
                              Stock bas
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              OK
                            </Badge>
                          )}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenDialog(product)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(product)}
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
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
        </CardContent>
      </Card>

      {/* Dialog d'ajout/modification */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Modifier le Produit' : 'Ajouter un Produit'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
              <div className="col-span-full">
                <Label htmlFor="name">Nom du produit *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="sku">SKU *</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="category">Catégorie *</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="price">Prix de vente ($) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: parseFloat(e.target.value) })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="cost">Coût d'achat ($) *</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) =>
                    setFormData({ ...formData, cost: parseFloat(e.target.value) })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="stock">Stock actuel *</Label>
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock}
                  onChange={(e) =>
                    setFormData({ ...formData, stock: parseInt(e.target.value) })
                  }
                  required
                />
              </div>

              <div>
                <Label htmlFor="minStock">Stock minimum *</Label>
                <Input
                  id="minStock"
                  type="number"
                  value={formData.minStock}
                  onChange={(e) =>
                    setFormData({ ...formData, minStock: parseInt(e.target.value) })
                  }
                  required
                />
              </div>

              <div className="col-span-full">
                <Label htmlFor="supplierId">Fournisseur *</Label>
                <select
                  id="supplierId"
                  value={formData.supplierId}
                  onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                >
                  <option value="">Sélectionner un fournisseur</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-full">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  rows={3}
                />
              </div>

              <div className="col-span-full rounded-lg border border-dashed p-3">
                <Label htmlFor="imageFile">Image du produit (vitrine)</Label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                  {formData.imageUrl ? (
                    <img
                      src={formData.imageUrl}
                      alt="Aperçu"
                      className="h-16 w-16 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-md bg-gray-100">
                      <ImageIcon className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <Input
                      id="imageUrl"
                      placeholder="https://... (URL de l'image)"
                      value={formData.imageUrl ?? ''}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    />
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-brand">
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      <span>{uploading ? 'Téléversement...' : 'Téléverser une image'}</span>
                      <input
                        id="imageFile"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading || isDemoMode}
                        onChange={(e) => void handleImageUpload(e.target.files?.[0])}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="compareAtPrice">Prix barré ($)</Label>
                <Input
                  id="compareAtPrice"
                  type="number"
                  step="0.01"
                  value={formData.compareAtPrice ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      compareAtPrice:
                        e.target.value === '' ? undefined : parseFloat(e.target.value),
                    })
                  }
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.isActive ?? true}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  Visible sur la vitrine
                </label>
              </div>

              <div className="col-span-full">
                <Label htmlFor="features">Caractéristiques (une par ligne)</Label>
                <textarea
                  id="features"
                  value={featuresText}
                  onChange={(e) => setFeaturesText(e.target.value)}
                  className="flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder={'Protection UV 400\nMonture légère\nÉtui inclus'}
                  rows={3}
                />
              </div>

              <div className="col-span-full">
                <Label htmlFor="gallery">Galerie (une URL par ligne)</Label>
                <textarea
                  id="gallery"
                  value={galleryText}
                  onChange={(e) => setGalleryText(e.target.value)}
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  rows={2}
                />
              </div>

              <div className="col-span-full flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.isFeatured ?? false}
                    onChange={(e) =>
                      setFormData({ ...formData, isFeatured: e.target.checked })
                    }
                  />
                  Mise en avant
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.isNew ?? false}
                    onChange={(e) => setFormData({ ...formData, isNew: e.target.checked })}
                  />
                  Nouveauté
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">
                {editingProduct ? 'Modifier' : 'Ajouter'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
