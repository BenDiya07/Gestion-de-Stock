import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const queryKeys = {
  products: ['products'] as const,
  suppliers: ['suppliers'] as const,
  supplies: ['supplies'] as const,
  sales: ['sales'] as const,
  clients: ['clients'] as const,
  users: ['users'] as const,
  history: ['history'] as const,
};
