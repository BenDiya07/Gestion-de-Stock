import { test, expect } from '@playwright/test';

// Tests de fumée exécutés en mode démo (aucune variable Supabase requise).

test('affiche le tableau de bord', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tableau de Bord' })).toBeVisible();
});

test('navigue vers la gestion des produits', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Produits' }).click();
  await expect(page.getByRole('heading', { name: 'Gestion des Produits' })).toBeVisible();
});

test('affiche la page de prévisions', async ({ page }) => {
  await page.goto('/predictions');
  await expect(
    page.getByRole('heading', { name: /prédictive de rupture/i })
  ).toBeVisible();
  await expect(page.getByText('Prévisions par produit')).toBeVisible();
});
