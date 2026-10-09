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
import { Plus, Pencil, Trash2, Search, UserCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { User } from '../types';

export function Users() {
  const { users, addUser, updateUser, deleteUser, currentUser } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    email: '',
    role: 'employee',
    status: 'active',
  });

  const isAdmin = currentUser.role === 'admin';

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData(user);
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        email: '',
        role: 'employee',
        status: 'active',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAdmin) {
      toast.error('Accès refusé', {
        description: 'Seuls les administrateurs peuvent gérer les utilisateurs.',
      });
      return;
    }

    if (editingUser) {
      updateUser(editingUser.id, formData);
      toast.success('Utilisateur modifié', {
        description: `${formData.name} a été modifié avec succès.`,
      });
    } else {
      addUser(formData as Omit<User, 'id' | 'createdAt'>);
      toast.success('Utilisateur ajouté', {
        description: `${formData.name} a été ajouté avec succès.`,
      });
    }
    setIsDialogOpen(false);
  };

  const handleDelete = (user: User) => {
    if (!isAdmin) {
      toast.error('Accès refusé', {
        description: 'Seuls les administrateurs peuvent supprimer les utilisateurs.',
      });
      return;
    }

    if (user.id === currentUser.id) {
      toast.error('Action impossible', {
        description: 'Vous ne pouvez pas supprimer votre propre compte.',
      });
      return;
    }

    if (confirm(`Êtes-vous sûr de vouloir supprimer ${user.name} ?`)) {
      deleteUser(user.id);
      toast.success('Utilisateur supprimé', {
        description: `${user.name} a été supprimé avec succès.`,
      });
    }
  };

  const getRoleBadge = (role: User['role']) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-purple-100 text-purple-700">Administrateur</Badge>;
      case 'manager':
        return <Badge className="bg-blue-100 text-blue-700">Gestionnaire</Badge>;
      case 'employee':
        return <Badge className="bg-gray-100 text-gray-700">Employé</Badge>;
    }
  };

  const getStatusBadge = (status: User['status']) => {
    return status === 'active' ? (
      <Badge className="bg-green-100 text-green-700">Actif</Badge>
    ) : (
      <Badge variant="outline" className="bg-gray-100 text-gray-700">Inactif</Badge>
    );
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Gestion des Utilisateurs</h1>
        <p className="text-gray-500 mt-1">Gérez les accès et les rôles</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Liste des Utilisateurs</CardTitle>
            {isAdmin && (
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un Utilisateur
              </Button>
            )}
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Rechercher par nom ou email..."
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
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date de Création</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500">
                      Aucun utilisateur trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                            <UserCircle className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            {user.id === currentUser.id && (
                              <Badge variant="outline" className="text-xs mt-1">
                                Vous
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>{getStatusBadge(user.status)}</TableCell>
                      <TableCell>
                        {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDialog(user)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            {user.id !== currentUser.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(user)}
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Summary */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-2xl font-bold text-gray-900">{users.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500">Administrateurs</p>
                <p className="text-2xl font-bold text-purple-600">
                  {users.filter((u) => u.role === 'admin').length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500">Gestionnaires</p>
                <p className="text-2xl font-bold text-blue-600">
                  {users.filter((u) => u.role === 'manager').length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500">Actifs</p>
                <p className="text-2xl font-bold text-green-600">
                  {users.filter((u) => u.status === 'active').length}
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Dialog d'ajout/modification */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Modifier l\'Utilisateur' : 'Ajouter un Utilisateur'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">Nom complet *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="role">Rôle *</Label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value as User['role'] })
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                >
                  <option value="admin">Administrateur</option>
                  <option value="manager">Gestionnaire</option>
                  <option value="employee">Employé</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.role === 'admin' && 'Accès complet à toutes les fonctionnalités'}
                  {formData.role === 'manager' && 'Peut gérer les produits et stocks'}
                  {formData.role === 'employee' && 'Accès en lecture seule'}
                </p>
              </div>

              <div>
                <Label htmlFor="status">Statut *</Label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as User['status'] })
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  required
                >
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">{editingUser ? 'Modifier' : 'Ajouter'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
