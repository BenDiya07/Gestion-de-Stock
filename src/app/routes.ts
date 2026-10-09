import { createBrowserRouter } from 'react-router';
import { MainLayout } from './layouts/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { Suppliers } from './pages/Suppliers';
import { Supplies } from './pages/Supplies';
import { Sales } from './pages/Sales';
import { Clients } from './pages/Clients';
import { Users } from './pages/Users';
import { History } from './pages/History';
import { Predictions } from './pages/Predictions';
import { Boutiques } from './pages/Boutiques';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: MainLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: 'products', Component: Products },
      { path: 'predictions', Component: Predictions },
      { path: 'suppliers', Component: Suppliers },
      { path: 'supplies', Component: Supplies },
      { path: 'sales', Component: Sales },
      { path: 'stores', Component: Boutiques },
      { path: 'clients', Component: Clients },
      { path: 'users', Component: Users },
      { path: 'history', Component: History },
    ],
  },
]);