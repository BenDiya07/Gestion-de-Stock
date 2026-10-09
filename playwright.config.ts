import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    // On chauffe le module d'entrée : cela déclenche l'optimisation des
    // dépendances Vite avant le lancement des tests (évite les ERR_ABORTED
    // au premier chargement parallèle).
    url: 'http://localhost:5173/src/main.tsx',
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      // Force le mode démo pour les tests de fumée, même si .env est présent.
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
    },
  },
});
