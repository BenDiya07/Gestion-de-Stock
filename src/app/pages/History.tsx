import { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Search, History as HistoryIcon, Plus, Edit, Trash } from 'lucide-react';

export function History() {
  const { history, products, suppliers, users: allUsers } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const filteredHistory = history.filter((entry) => {
    const matchesSearch =
      entry.entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.userName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || entry.type === filterType;

    return matchesSearch && matchesType;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'create':
        return (
          <Badge className="bg-green-100 text-green-700 flex items-center gap-1 w-fit">
            <Plus className="w-3 h-3" />
            Créé
          </Badge>
        );
      case 'update':
        return (
          <Badge className="bg-blue-100 text-blue-700 flex items-center gap-1 w-fit">
            <Edit className="w-3 h-3" />
            Modifié
          </Badge>
        );
      case 'delete':
        return (
          <Badge className="bg-red-100 text-red-700 flex items-center gap-1 w-fit">
            <Trash className="w-3 h-3" />
            Supprimé
          </Badge>
        );
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    const labels = {
      product: 'Produit',
      supplier: 'Fournisseur',
      supply: 'Approvisionnement',
      sale: 'Vente',
      user: 'Utilisateur',
      client: 'Client',
    };

    return <Badge variant="outline">{labels[type as keyof typeof labels] || type}</Badge>;
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Historique des Actions</h1>
        <p className="text-gray-500 mt-1">Suivez toutes les modifications du système</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HistoryIcon className="w-5 h-5" />
            Journal d'Activité
          </CardTitle>
          <div className="flex gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Rechercher par nom d'entité ou utilisateur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">Tous les types</option>
              <option value="product">Produits</option>
              <option value="supplier">Fournisseurs</option>
              <option value="supply">Approvisionnements</option>
              <option value="sale">Ventes</option>
              <option value="user">Utilisateurs</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Heure</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Élément</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Détails</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500">
                      Aucune entrée d'historique trouvée
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHistory.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}{' '}
                        <span className="text-gray-500">
                          {new Date(entry.timestamp).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </TableCell>
                      <TableCell>{getTypeBadge(entry.type)}</TableCell>
                      <TableCell>{getActionBadge(entry.action)}</TableCell>
                      <TableCell>
                        <span className="font-medium">{entry.entityName}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">
                            {entry.userName.charAt(0)}
                          </div>
                          <span className="text-sm">{entry.userName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {entry.details ? (
                          <span className="text-sm text-gray-600">{entry.details}</span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Summary */}
          {history.length > 0 && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{history.length}</p>
                  <p className="text-sm text-gray-500">Total</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {history.filter((h) => h.action === 'create').length}
                  </p>
                  <p className="text-sm text-gray-500">Créations</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">
                    {history.filter((h) => h.action === 'update').length}
                  </p>
                  <p className="text-sm text-gray-500">Modifications</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">
                    {history.filter((h) => h.action === 'delete').length}
                  </p>
                  <p className="text-sm text-gray-500">Suppressions</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">
                    {new Set(history.map((h) => h.userId)).size}
                  </p>
                  <p className="text-sm text-gray-500">Utilisateurs actifs</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}