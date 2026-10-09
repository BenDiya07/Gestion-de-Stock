-- =============================================================================
-- GestiStock Pro — Jeu de données de démonstration (idempotent)
--
-- Exécution :
--   - Local  : `supabase db reset`   (le CLI charge automatiquement seed.sql)
--   - Distant : SQL Editor du dashboard Supabase -> coller ce script -> Run
--
-- Le stock final est entièrement reconstruit à partir du journal des mouvements
-- (supply = entrées, adjustment = inventaire, sales = sorties), ce qui
-- démontre le modèle « stock_movements = source de vérité » de l'architecture.
-- =============================================================================

-- 1) Nettoyage (permet de relancer le script sans doublons).
--    Les comptes auth.users / profiles sont préservés.
delete from public.audit_log;
delete from public.stock_movements;
delete from public.sales;
delete from public.supplies;
delete from public.products;
delete from public.clients;
delete from public.suppliers;

-- 2) Données de démonstration
do $$
declare
  j int; i int; qty int;
  sold int[];
  v_cat_info uuid; v_cat_peri uuid; v_cat_stock uuid; v_cat_acc uuid;
  v_sup1 uuid; v_sup2 uuid; v_sup3 uuid;
  v_cli1 uuid; v_cli2 uuid; v_cli3 uuid; v_cli4 uuid;
  v_prods uuid[] := '{}';
  v_new uuid;
  v_client_name text;
  v_supply_qty int;
  v_adj int;
  v_sale_date timestamptz;

  -- Produits (index j = 1..7)
  v_names text[] := array[
    'Ordinateur Portable Pro', 'Clavier Mécanique RGB', 'Souris sans fil',
    'SSD NVMe 1 To', 'Disque dur HDD 4 To', 'Écran 27" 4K', 'Carte graphique RTX'
  ];
  v_skus text[] := array['PC-001','CL-014','SO-022','SS-108','HD-203','EC-301','CG-405'];
  v_cats text[] := array['Informatique','Périphériques','Périphériques','Stockage','Stockage','Périphériques','Informatique'];
  v_prices numeric[] := array[1199.00, 89.90, 39.90, 109.90, 129.00, 349.00, 899.00];
  v_costs numeric[] := array[850.00, 55.00, 24.00, 78.00, 92.00, 240.00, 640.00];
  v_min  int[] := array[3, 10, 8, 5, 4, 2, 2];
  v_desired_stock int[] := array[9, 12, 8, 25, 3, 10, 0];
  v_sale_count int[] := array[26, 22, 20, 14, 18, 8, 20];
  v_descs text[] := array[
    'Ultrabook 14 pouces, 16 Go RAM, 512 Go SSD',
    'Clavier mécanique rétroéclairé, switches rouges',
    'Souris optique sans fil, 1600 DPI',
    'SSD NVMe 1 To, lecture 7000 Mo/s',
    'Disque dur interne 7200 tr/min',
    'Écran IPS 27 pouces, résolution 4K UHD',
    'Carte graphique gaming, 12 Go VRAM'
  ];
begin
  select id into v_cat_info from public.categories where name = 'Informatique';
  select id into v_cat_peri  from public.categories where name = 'Périphériques';
  select id into v_cat_stock from public.categories where name = 'Stockage';
  select id into v_cat_acc   from public.categories where name = 'Accessoires';

  insert into public.suppliers (name, contact, email, phone, address)
  values ('Techno Distrib', 'Marie Dupont', 'contact@techno-distrib.fr', '01 42 00 00 01', '12 rue de la Paix, 75001 Paris')
  returning id into v_sup1;
  insert into public.suppliers (name, contact, email, phone, address)
  values ('Periph Import', 'Karim Benali', 'ventes@periph-import.fr', '04 72 00 00 02', '8 allée des Frênes, 69003 Lyon')
  returning id into v_sup2;
  insert into public.suppliers (name, contact, email, phone, address)
  values ('Storage Pro', 'Sofia Rossi', 'support@storage-pro.eu', '04 91 00 00 03', '140 avenue du Prado, 13008 Marseille')
  returning id into v_sup3;

  insert into public.clients (name, email, phone, city, postal_code, type, status)
  values ('Pierre Martin', 'pierre@exemple.fr', '06 11 22 33 44', 'Paris', '75011', 'individual', 'active')
  returning id into v_cli1;
  insert into public.clients (name, email, phone, city, postal_code, company, type, status)
  values ('Société ABC', 'compta@abc.fr', '01 43 55 66 77', 'Lyon', '69002', 'ABC SARL', 'business', 'active')
  returning id into v_cli2;
  insert into public.clients (name, email, phone, city, postal_code, company, type, status)
  values ('Startup XYZ', 'contact@xyz.io', '09 88 77 66 55', 'Bordeaux', '33000', 'XYZ SAS', 'business', 'active')
  returning id into v_cli3;
  insert into public.clients (name, email, phone, city, postal_code, type, status)
  values ('Julie Durand', 'julie@exemple.fr', '07 55 44 33 22', 'Lille', '59000', 'individual', 'active')
  returning id into v_cli4;

  -- Produits : stock initial 0, reconstruit ensuite par les mouvements.
  for j in 1..array_length(v_names, 1) loop
    insert into public.products (name, sku, category_id, supplier_id, price, cost, stock, min_stock, description)
    values (
      v_names[j], v_skus[j],
      case v_cats[j] when 'Informatique' then v_cat_info when 'Périphériques' then v_cat_peri else v_cat_stock end,
      case v_cats[j] when 'Informatique' then v_sup1 when 'Périphériques' then v_sup2 else v_sup3 end,
      v_prices[j], v_costs[j], 0, v_min[j], v_descs[j]
    )
    returning id into v_new;
    v_prods := v_prods || v_new;
  end loop;

  -- Total de ventes à générer (mêmes formules que ci-dessous) :
  -- permet de dimensionner les entrées pour ne jamais passer sous zéro.
  sold := array_fill(0, array[array_length(v_prods, 1)]);
  for j in 1..array_length(v_prods, 1) loop
    for i in 1..v_sale_count[j] loop
      sold[j] := sold[j] + 1 + mod(i * 3 + j, 3);
    end loop;
  end loop;

  -- Approvisionnements reçus (entrées de stock), puis ajustement d'inventaire.
  -- stock après ces deux opérations = vendu_total + stock_cible (jamais négatif).
  for j in 1..array_length(v_prods, 1) loop
    v_supply_qty := v_sale_count[j] * 4;
    insert into public.supplies (supplier_id, product_id, quantity, cost, status, notes, created_at)
    values (
      case v_cats[j] when 'Informatique' then v_sup1 when 'Périphériques' then v_sup2 else v_sup3 end,
      v_prods[j], v_supply_qty, v_costs[j], 'received', 'Livraison de référence',
      now() - interval '10 days'
    );
    v_adj := sold[j] + v_desired_stock[j] - v_supply_qty;
    insert into public.stock_movements (product_id, quantity, reason, created_at)
    values (v_prods[j], v_adj, 'adjustment', now() - interval '45 days');
  end loop;

  -- Un approvisionnement en attente (aucun impact sur le stock).
  insert into public.supplies (supplier_id, product_id, quantity, cost, status, notes, created_at)
  values (v_sup3, v_prods[4], 10, v_costs[4], 'pending', 'Complément commandé',
          now() - interval '2 days');

  -- Ventes « completed » sur la fenêtre glissante (30 derniers jours) :
  -- motrice du module d'alerte prédictive (consommation quotidienne).
  for j in 1..array_length(v_prods, 1) loop
    for i in 1..v_sale_count[j] loop
      qty := 1 + mod(i * 3 + j, 3);
      v_sale_date := now() - mod(i * 2 + j, 30) * interval '1 day' - (i * 17) * interval '1 minute';
      if mod(i + j, 2) = 0 then
        select name into v_client_name from public.clients
        where id = (array[v_cli1, v_cli2, v_cli3, v_cli4])[1 + mod(i * 2 + j, 4)];
        insert into public.sales (product_id, client_id, customer_name, quantity, unit_price, status, created_at)
        values (v_prods[j], (array[v_cli1, v_cli2, v_cli3, v_cli4])[1 + mod(i * 2 + j, 4)], v_client_name,
                qty, v_prices[j], 'completed', v_sale_date);
      else
        insert into public.sales (product_id, quantity, unit_price, status, created_at)
        values (v_prods[j], qty, v_prices[j], 'completed', v_sale_date);
      end if;
    end loop;
  end loop;
end $$;

-- 3) Profil de l'administrateur de test.
--    L'utilisateur auth `admin@magasin.test` a ete cree AVANT les migrations :
--    le trigger handle_new_user n'a donc pas cree son profil. Ce bloc le cree
--    retroactivement avec le role admin (aucun effet si l'uid n'existe pas).
insert into public.profiles (id, full_name, email, role, status)
select id, 'Admin', email, 'admin'::user_role, 'active'::entity_status
from auth.users
where id = '61efd89d-a696-45b2-852f-ff3b593d6af1'
on conflict (id) do nothing;