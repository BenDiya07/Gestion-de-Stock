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
import { Plus, Pencil, Trash2, Search, UserCircle, Mail, Phone, MapPin, Building } from 'lucide-react';
import { toast } from 'sonner';
import type { Client } from '../types';

export function Clients() {
  const { clients, sales, addClient, updateClient, deleteClient, currentUser } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [formData, setFormData] = useState<Partial<Client>>({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    company: '',
    notes: '',
    type: 'individual',
    status: 'active',
  });

  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      c.company?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenDialog = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData(client);
    } else {
      setEditingClient(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        postalCode: '',
        company: '',
        notes: '',
        type: 'individual',
        status: 'active',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAdmin) {
      toast.error('Accès refusé', {
        description: 'Seuls les administrateurs peuvent modifier les clients.',
      });
      return;
    }

    if (editingClient) {
      updateClient(editingClient.id, formData);
      toast.success('Client modifié', {
        description: `${formData.name} a été modifié avec succès.`,
      });
    } else {
      addClient(formData as Omit<Client, 'id' | 'createdAt' | 'totalPurchases'>);
      toast.success('Client ajouté', {
        description: `${formData.name} a été ajouté avec succès.`,
      });
    }
    setIsDialogOpen(false);
  };

  const handleDelete = (client: Client) => {
    if (!isAdmin) {
      toast.error('Accès refusé', {
        description: 'Seuls les administrateurs peuvent supprimer les clients.',
      });
      return;
    }

    const clientSales = sales.filter((s) => s.customerId === client.id);
    
    if (clientSales.length > 0) {
      toast.error('Suppression impossible', {
        description: `Ce client a ${clientSales.length} vente(s) associée(s).`,
      });
      return;
    }

    if (confirm(`Êtes-vous sûr de vouloir supprimer ${client.name} ?`)) {
      deleteClient(client.id);
      toast.success('Client supprimé', {
        description: `${client.name} a été supprimé avec succès.`,
      });
    }
  };

  const getClientSalesCount = (clientId: string) => {
    return sales.filter((s) => s.customerId === clientId).length;
  };

  const getTypeBadge = (type: Client['type']) => {
    return type === 'business' ? (
      <Badge className="bg-purple-100 text-purple-700">Entreprise</Badge>
    ) : (
      <Badge className="bg-blue-100 text-blue-700">Particulier</Badge>
    );
  };

  const getStatusBadge = (status: Client['status']) => {
    return status === 'active' ? (
      <Badge className="bg-green-100 text-green-700">Actif</Badge>
    ) : (
      <Badge variant="outline" className="bg-gray-100 text-gray-700">Inactif</Badge>
    );
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Gestion des Clients</h1>
        <p className="text-gray-500 mt-1">Gérez votre base de clients</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <UserCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Clients</p>
                <p className="text-2xl font-bold text-gray-900">{clients.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                <Building className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Entreprises</p>
                <p className="text-2xl font-bold text-gray-900">
                  {clients.filter((c) => c.type === 'business').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
                <UserCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Clients Actifs</p>
                <p className="text-2xl font-bold text-gray-900">
                  {clients.filter((c) => c.status === 'active').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                <UserCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Achats</p>
                <p className="text-2xl font-bold text-gray-900">
                  {clients.reduce((sum, c) => sum + c.totalPurchases, 0).toFixed(2)} €
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Liste des Clients</CardTitle>
            <div className="flex gap-2">
              <div className="flex gap-1 border rounded-lg p-1">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  Grille
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                >
                  Table
                </Button>
              </div>
              {isAdmin && (
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter un Client
                </Button>
              )}
            </div>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Rechercher par nom, email, téléphone ou entreprise..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClients.length === 0 ? (
                <p className="col-span-full text-center text-gray-500 py-8">
                  Aucun client trouvé
                </p>
              ) : (
                filteredClients.map((client) => (
                  <Card key={client.id} className="relative hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                            {client.type === 'business' ? (
                              <Building className="w-6 h-6" />
                            ) : (
                              <UserCircle className="w-6 h-6" />
                            )}
                          </div>
                          <div>
                            <CardTitle className="text-lg">{client.name}</CardTitle>
                            <div className="flex gap-2 mt-1">
                              {getTypeBadge(client.type)}
                              {getStatusBadge(client.status)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {client.company && (
                          <div className="flex items-center gap-2 text-sm">
                            <Building className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-700">{client.company}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700">{client.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700">{client.phone}</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                          <span className="text-gray-700">
                            {client.address}, {client.postalCode} {client.city}
                          </span>
                        </div>
                        <div className="pt-3 border-t border-gray-200">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-500">Total achats:</span>
                            <span className="font-semibold text-green-600">
                              {client.totalPurchases.toFixed(2)} €
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Nombre de ventes:</span>
                            <span className="font-semibold">{getClientSalesCount(client.id)}</span>
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="flex gap-2 pt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => handleOpenDialog(client)}
                            >
                              <Pencil className="w-4 h-4 mr-2" />
                              Modifier
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(client)}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Total Achats</TableHead>
                    <TableHead>Statut</TableHead>
                    {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-gray-500">
                        Aucun client trouvé
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                              {client.type === 'business' ? (
                                <Building className="w-4 h-4" />
                              ) : (
                                <UserCircle className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{client.name}</p>
                              {client.company && (
                                <p className="text-sm text-gray-500">{client.company}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{client.email}</TableCell>
                        <TableCell>{client.phone}</TableCell>
                        <TableCell>{client.city}</TableCell>
                        <TableCell>{getTypeBadge(client.type)}</TableCell>
                        <TableCell className="font-semibold text-green-600">
                          {client.totalPurchases.toFixed(2)} €
                        </TableCell>
                        <TableCell>{getStatusBadge(client.status)}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenDialog(client)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(client)}
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog d'ajout/modification */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingClient ? 'Modifier le Client' : 'Ajouter un Client'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="col-span-2">
                <Label htmlFor="type">Type de client *</Label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as Client['type'] })
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                >
                  <option value="individual">Particulier</option>
                  <option value="business">Entreprise</option>
                </select>
              </div>

              <div>
                <Label htmlFor="name">Nom complet *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              {formData.type === 'business' && (
                <div>
                  <Label htmlFor="company">Nom de l'entreprise</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  />
                </div>
              )}

              <div className={formData.type === 'individual' ? 'col-span-2' : ''}>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="phone">Téléphone *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="address">Adresse *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="postalCode">Code postal *</Label>
                <Input
                  id="postalCode"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="city">Ville *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  required
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="status">Statut *</Label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as Client['status'] })
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                >
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
              </div>

              <div className="col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">{editingClient ? 'Modifier' : 'Ajouter'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
