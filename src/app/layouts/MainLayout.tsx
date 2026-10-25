import { useEffect, useState } from 'react';
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
  UserCircle,
  Store,
  Glasses,
  Menu,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
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
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand/50 bg-brand/10">
        <Glasses className="absolute h-5 w-5 text-brand" />
      </div>
      <div className="min-w-0 leading-tight">
        <p className="font-display text-2xl font-medium tracking-wide text-white">Merkey</p>
        <p className="truncate text-[11px] uppercase tracking-[0.18em] text-gray-400">
          Lunetterie · Kinshasa
        </p>
      </div>
    </div>
  );
}

function SidebarContent({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const { currentUser, products } = useStore();
  const { signOut } = useAuth();

  const lowStockCount = products.filter((product) => product.stock < product.minStock).length;

  return (
    <>
      <div className="border-b border-white/10 p-6">
        <Logo />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {menuItems.map((item) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={`relative flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-brand" />
              )}
              <Icon className="h-5 w-5 shrink-0" />
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
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-navy">
            {currentUser.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{currentUser.name}</p>
            <p className="text-xs capitalize text-gray-400">{currentUser.role}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              void signOut();
            }}
            className="shrink-0 text-gray-400 transition-colors hover:text-white"
            title="Se déconnecter"
            aria-label="Se déconnecter"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}

export function MainLayout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <div className="flex h-screen h-dvh flex-col bg-gray-50 lg:flex-row">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-navy px-4 py-3 text-white lg:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white transition-colors hover:bg-white/10"
          aria-label="Ouvrir le menu"
          aria-expanded={menuOpen}
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      <aside className="hidden w-64 shrink-0 flex-col bg-navy text-white lg:flex">
        <SidebarContent pathname={location.pathname} />
      </aside>

      {menuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navigation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Fermer le menu"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-navy text-white shadow-2xl">
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Fermer le menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent
              pathname={location.pathname}
              onNavigate={() => setMenuOpen(false)}
            />
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
