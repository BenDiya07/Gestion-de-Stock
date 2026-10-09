import { Link, Outlet, useLocation } from 'react-router';
import {
  LayoutDashboard,
  Package,
  Truck,
  ShoppingCart,
  Users,
  History,
  TrendingUp,
  Building2,
  LogOut,
  AlertTriangle,
  UserCircle,
  Store,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Badge } from '../components/ui/badge';

const menuItems = [
  { path: '/', icon: LayoutDashboard, label: 'Tableau de Bord' },
  { path: '/products', icon: Package, label: 'Produits' },
  { path: '/predictions', icon: TrendingUp, label: 'Prévisions' },
  { path: '/suppliers', icon: Building2, label: 'Fournisseurs' },
  { path: '/supplies', icon: Truck, label: 'Approvisionnements' },
  { path: '/sales', icon: ShoppingCart, label: 'Ventes' },
  { path: '/stores', icon: Store, label: 'Boutiques' },
  { path: '/clients', icon: UserCircle, label: 'Clients' },
  { path: '/users', icon: Users, label: 'Utilisateurs' },
  { path: '/history', icon: History, label: 'Historique' },
];

export function MainLayout() {
  const location = useLocation();
  const { currentUser, products } = useStore();
  
  const lowStockCount = products.filter(p => p.stock < p.minStock).length;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="font-bold text-xl text-gray-900">Merkey</h1>
          <p className="text-sm text-gray-500 mt-1">Lunetterie — Kinshasa</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="flex-1">{item.label}</span>
                {item.path === '/' && lowStockCount > 0 && (
                  <Badge variant="destructive" className="ml-auto">
                    {lowStockCount}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center">
              {currentUser.name.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{currentUser.name}</p>
              <p className="text-xs text-gray-500 capitalize">{currentUser.role}</p>
            </div>
            <button className="text-gray-400 hover:text-gray-600">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}