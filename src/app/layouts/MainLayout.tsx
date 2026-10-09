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
  Glasses,
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

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-brand/50 bg-brand/10">
        <Glasses className="absolute h-5 w-5 text-brand" />
      </div>
      <div className="leading-tight">
        <p className="font-display text-2xl font-medium tracking-wide text-white">Merkey</p>
        <p className="text-[11px] tracking-[0.18em] uppercase text-gray-400">
          Lunetterie · Kinshasa
        </p>
      </div>
    </div>
  );
}

export function MainLayout() {
  const location = useLocation();
  const { currentUser, products } = useStore();

  const lowStockCount = products.filter(p => p.stock < p.minStock).length;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col bg-navy text-white">
        <div className="border-b border-white/10 p-6">
          <Logo />
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-brand" />
                )}
                <Icon className="h-5 w-5" />
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

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-white/5 px-4 py-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-semibold text-navy">
              {currentUser.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-white">{currentUser.name}</p>
              <p className="text-xs capitalize text-gray-400">{currentUser.role}</p>
            </div>
            <button className="text-gray-400 transition-colors hover:text-white" title="Se déconnecter">
              <LogOut className="h-4 w-4" />
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