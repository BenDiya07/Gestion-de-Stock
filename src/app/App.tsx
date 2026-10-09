import { type ReactNode } from 'react';
import { RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { router } from './routes';
import { queryClient } from '@/lib/queryClient';
import { isDemoMode } from '@/lib/env';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StoreProvider } from './context/StoreContext';
import { Login } from './pages/Login';
import { Toaster } from './components/ui/sonner';

function AuthGate({ children }: { children: ReactNode }) {
  const { currentUser, loading } = useAuth();

  if (isDemoMode) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        Chargement…
      </div>
    );
  }

  if (!currentUser) return <Login />;

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate>
          <StoreProvider>
            <RouterProvider router={router} />
          </StoreProvider>
        </AuthGate>
        <Toaster position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
