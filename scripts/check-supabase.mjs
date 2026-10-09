#!/usr/bin/env node
// =============================================================================
// Validation de bout en bout de la connexion Supabase.
//
//Usage :  npm run check:supabase
//
//Le script lit `.env` (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) et teste :
//  1. la connexion au projet Supabase ;
//  2. la lecture des données seed (produits, ventes, mouvements) ;
//  3. le RPC `product_forecast_all` (module d'alerte prédictive).
//
//Authentification : le script utilise d'abord les identifiants de test
//(SUPABASE_TEST_EMAIL / SUPABASE_TEST_PASSWORD du `.env`), sinon une session
//anonyme (suffisante pour SELECT + RPC grâce aux politiques RLS).
//
//Si `.env` est absent ou incomplet, le script se termine proprement (code 0).
//============================================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadDotEnv() {
  if (!existsSync(resolve(root, '.env'))) return {};
  const env = {};
  for (const line of readFileSync(resolve(root, '.env'), 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function main() {
  const env = loadDotEnv();
  const url = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  const testEmail = env.SUPABASE_TEST_EMAIL ?? '';
  const testPassword = env.SUPABASE_TEST_PASSWORD ?? '';

  if (!url || !anonKey) {
    console.log('check:supabase — .env non configuré (mode démo) : vérification ignorée.');
    return;
  }

  const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
  const step = (label) => console.log(`\n== ${label} ==`);

  step('1. Connexion');
  let who = 'session anonyme';
  if (testEmail && testPassword) {
    const { error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    if (error) {
      console.error(`Échec authentification ${testEmail} : ${error.message}`);
      process.exitCode = 1;
      return;
    }
    who = `compte ${testEmail}`;
  } else {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error(
        `Session anonyme indisponible : ${error.message}\n` +
          '=> Activez « Sign in anonymously » (Dashboard > Authentication > Providers) ' +
          'ou renseignez SUPABASE_TEST_EMAIL / SUPABASE_TEST_PASSWORD dans .env.'
      );
      process.exitCode = 1;
      return;
    }
  }
  console.log(`Connecté via ${who}`);

  step('2. Données seed');
  const tables = ['products', 'sales', 'clients', 'suppliers', 'stock_movements', 'stores'];
  const labels = ['produits', 'ventes', 'clients', 'fournisseurs', 'mouvements de stock', 'boutiques'];
  let productsCount = 0;

  for (let t = 0; t < tables.length; t++) {
    const table = tables[t];
    const label = labels[t];
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error || count == null) {
      const probe = await supabase.from(table).select('id').limit(1);
      if (probe.error) {
        console.error(
          `Table '${table}' inaccessible : ${probe.error.message}\n` +
            '=> Les migrations 0001-0004 sont-elles appliquées ? (SQL Editor -> init-all.sql)'
        );
      } else {
        console.error(`Impossible de compter '${table}' (statut ${probe.status}).`);
      }
      process.exitCode = 1;
      return;
    }
    console.log(`${label.padStart(18)} : ${count}`);
    if (table === 'products') productsCount = count;
  }

  if (productsCount === 0) {
    console.error('Aucun produit : exécutez le seed (SQL Editor -> init-all.sql).');
    process.exitCode = 1;
    return;
  }

  step('2b. Stock par boutique (invariant somme = stock produit)');
  const { data: storeStock, error: storeStockError } = await supabase
    .from('store_stock')
    .select('product_id, product_sku, store_id, store_name, quantity');
  if (storeStockError) {
    console.error(`Erreur vue store_stock : ${storeStockError.message}`);
    process.exitCode = 1;
    return;
  }
  const lineCount = storeStock.filter((r) => r.quantity > 0).length;
  console.log(`lignes de stock non nulles (produit x boutique) : ${lineCount}`);

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, sku, stock');
  if (productsError) {
    console.error(`Erreur lecture produits : ${productsError.message}`);
    process.exitCode = 1;
    return;
  }
  const byProduct = new Map();
  for (const row of storeStock) {
    byProduct.set(
      row.product_id,
      (byProduct.get(row.product_id) ?? 0) + Number(row.quantity)
    );
  }
  const mismatches = products.filter(
    (p) => (byProduct.get(p.id) ?? 0) !== Number(p.stock)
  );
  if (mismatches.length > 0) {
    console.error(
      `Invariant violé : ${mismatches.map((m) => m.sku).join(', ')} ` +
        `(somme boutiques=${byProduct.get(mismatches[0].id)} != stock=${mismatches[0].stock})`
    );
    process.exitCode = 1;
    return;
  }
  console.log('invariant somme(par boutique) = stock total : OK');

  step('3. RPC product_forecast_all');
  const { data, error } = await supabase.rpc('product_forecast_all', {
    p_window_days: 30,
    p_lead_time_days: 7,
    p_service_level: 0.95,
  });
  if (error) {
    console.error(`Erreur RPC : ${error.message}\n=> Migration 0003 appliquée ?`);
    process.exitCode = 1;
    return;
  }
  if (data.length === 0) {
    console.error('RPC renvoyé 0 ligne : la migration 0002/0003 est-elle appliquée ?');
    process.exitCode = 1;
    return;
  }
  for (const row of data) {
    const days = row.days_of_stock == null ? '∞' : Number(row.days_of_stock).toFixed(1);
    console.log(
      `${String(row.sku).padEnd(8)} stock=${String(row.stock).padStart(4)} ` +
        `conso/j=${String(row.avg_daily_demand).padStart(5)} ss=${String(row.safety_stock).padStart(5)} ` +
        `pointCmd=${String(row.reorder_point).padStart(4)} jours=${days.padStart(5)} -> ${row.status}`
    );
  }

  const fails = data.filter((r) => r.status !== 'ok');
  console.log(
    `\n${data.length} produits analysés, ${fails.length} à surveiller (rupture/critique/a_commander).`
  );
  console.log('\ncheck:supabase — OK. Intégration validée de bout en bout.');

  await supabase.auth.signOut();
}

main()
  .then(() => {})
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });