import { useStore } from '../context/StoreContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Package,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Users,
} from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';

export function Dashboard() {
  const { products, sales, supplies, users } = useStore();

  // Calculs statistiques
  const lowStockProducts = products.filter(p => p.stock < p.minStock);
  const totalProducts = products.reduce((sum, p) => sum + p.stock, 0);
  const totalSalesValue = sales
    .filter(s => s.status === 'completed')
    .reduce((sum, s) => sum + s.totalPrice, 0);
  const recentSales = sales.slice(0, 5);
  const pendingSupplies = supplies.filter(s => s.status === 'pending');

  const stats = [
    {
      title: 'Produits en Stock',
      value: totalProducts.toString(),
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Ventes du Mois',
      value: `${totalSalesValue.toFixed(2)} €`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Alertes Stock Bas',
      value: lowStockProducts.length.toString(),
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
    },
    {
      title: 'Utilisateurs Actifs',
      value: users.filter(u => u.status === 'active').length.toString(),
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Tableau de Bord</h1>
        <p className="text-gray-500 mt-1">Vue d'ensemble de votre magasin</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <div className={`${stat.bgColor} ${stat.color} p-3 rounded-lg`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Alertes Stock Bas */}
      {lowStockProducts.length > 0 && (
        <Alert variant="destructive" className="mb-8">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Alertes de Stock Bas</AlertTitle>
          <AlertDescription>
            {lowStockProducts.length} produit(s) ont un stock inférieur au minimum requis.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Produits en Rupture/Stock Bas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Produits à Réapprovisionner
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {lowStockProducts.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun produit en stock bas</p>
              ) : (
                lowStockProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="destructive">
                        {product.stock} / {product.minStock}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">Stock actuel / Min</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Ventes Récentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-green-600" />
              Ventes Récentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSales.length === 0 ? (
                <p className="text-sm text-gray-500">Aucune vente récente</p>
              ) : (
                recentSales.map((sale) => {
                  const product = products.find(p => p.id === sale.productId);
                  return (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{product?.name}</p>
                        <p className="text-sm text-gray-500">
                          {sale.customerName || 'Client inconnu'} • Qté: {sale.quantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">
                          {sale.totalPrice.toFixed(2)} €
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(sale.date).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Approvisionnements en Attente */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              Approvisionnements en Attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingSupplies.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun approvisionnement en attente</p>
              ) : (
                pendingSupplies.map((supply) => {
                  const product = products.find(p => p.id === supply.productId);
                  return (
                    <div
                      key={supply.id}
                      className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{product?.name}</p>
                        <p className="text-sm text-gray-500">Qté: {supply.quantity}</p>
                      </div>
                      <Badge variant="outline" className="bg-yellow-100">
                        En attente
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Valeur du Stock */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              Statistiques du Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Valeur totale du stock</span>
                <span className="font-bold text-gray-900">
                  {products.reduce((sum, p) => sum + p.cost * p.stock, 0).toFixed(2)} €
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Nombre de produits</span>
                <span className="font-bold text-gray-900">{products.length}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Marge potentielle</span>
                <span className="font-bold text-green-600">
                  {products.reduce((sum, p) => sum + (p.price - p.cost) * p.stock, 0).toFixed(2)} €
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
