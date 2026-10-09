-- =============================================================================
-- Merkey — Jeu de données de démonstration (idempotent)
--
-- Exécution :
--   - Local  : `supabase db reset`   (le CLI charge automatiquement seed.sql)
--   - Distant : `npx supabase db push --linked --include-seed`
--
-- Scénario « lunetterie multi-boutiques » conforme au modèle Merkey :
--   * 1 dépôt central (Kinshasa) qui reçoit les approvisionnements ;
--   * 4 boutiques (Kinshasa Centre, Lubumbashi, Goma, Mbuji-Mayi) ;
--   * des répartitions dépôt -> boutique via le RPC `transfer_stock` ;
--   * des ventes sur la fenêtre glissante (30 jours) motrices du module
--     d'alerte prédictive ;
--   * le stock final (global et par boutique) est entièrement reconstruit à
--     partir du journal des mouvements (stock_movements = source de vérité).
-- =============================================================================

-- 1) Nettoyage (permet de relancer le script sans doublons).
--    Les comptes auth.users / profiles sont préservés.
delete from public.audit_log;
delete from public.stock_movements;
delete from public.stock_by_store;
delete from public.sales;
delete from public.supplies;
delete from public.products;
delete from public.clients;
delete from public.suppliers;
delete from public.stores;

-- 2) Données de démonstration
do $$
declare
  j int; i int; qty int; c int; cityc int;
  v_cats uuid[] := '{}'; v_stores uuid[] := '{}';
  v_sup1 uuid; v_sup2 uuid; v_sup3 uuid;
  v_cli1 uuid; v_cli2 uuid; v_cli3 uuid; v_cli4 uuid;
  v_prods uuid[] := '{}';
  v_new uuid;
  v_client_name text;
  v_cat uuid;
  v_supply_qty int;
  v_exp int[][];
  v_target int[][] := array[
    array[3,2,3,4], array[2,2,3,3], array[4,3,4,5], array[2,2,2,2],
    array[3,2,3,2], array[3,2,3,2], array[1,2,2,1], array[5,5,5,5]
  ];
  v_expected_total int;
  v_target_total int;
  v_sale_date timestamptz;

  -- Produits (j = 1..8)
  v_names text[] := array[
    'Lunettes Anti-lumière Bleue Noir', 'Lunettes Anti-lumière Bleue Écaille',
    'Photogray Classic', 'Photogray Premium',
    'Lunettes de Soleil Aviator', 'Lunettes de Soleil Polarisées',
    'Lunettes de Soleil Oversize', 'Étui de protection'
  ];
  v_skus text[] := array['MRK-ALB-001','MRK-ALB-002','MRK-PHG-001','MRK-PHG-002','MRK-SOL-001','MRK-SOL-002','MRK-SOL-003','MRK-ACC-001'];
  v_cat_names text[] := array['Anti-lumière bleue','Photogray','Lunettes de soleil','Accessoires'];
  v_cat_idx int[] := array[1,1,2,2,3,3,3,4];
  v_prices numeric[] := array[15.00, 15.00, 17.00, 22.00, 12.00, 18.00, 14.00, 3.00];
  v_costs numeric[] := array[6.00, 6.00, 7.00, 9.00, 5.00, 8.00, 6.00, 1.00];
  v_min  int[] := array[5, 5, 6, 4, 4, 4, 3, 10];
  v_sale_count int[] := array[26, 22, 24, 14, 18, 16, 10, 8];
  v_descs text[] := array[
    'Verres filtrant la lumière bleue, monture noire mate',
    'Verres filtrant la lumière bleue, monture écaille',
    'Verres photochromatiques qui s''assombrissent au soleil',
    'Verres photochromatiques haut de gamme, traitements antireflet',
    'Monture métallique classique aviator',
    'Verres polarisés, monture noire',
    'Grande monture tendance',
    'Étui rigide avec chiffon microfibre'
  ];
begin
  -- Catégories (idempotent)
  for j in 1..array_length(v_cat_names, 1) loop
    select id into v_cat from public.categories where name = v_cat_names[j];
    if v_cat is null then
      insert into public.categories (name) values (v_cat_names[j]) returning id into v_cat;
    end if;
    v_cats := v_cats || v_cat;
  end loop;

  -- Magasins : un dépôt central + quatre boutiques.
  insert into public.stores (name, city, address, is_dispatch_center)
  values ('Dépôt central — Kinshasa', 'Kinshasa', 'Boulevard Lumumba, Limete, Kinshasa', true)
  returning id into v_new; v_stores := v_stores || v_new;
  insert into public.stores (name, city, address)
  values ('Merkey Kinshasa — Centre', 'Kinshasa', 'Boulevard du 30 Juin, Gombe')
  returning id into v_new; v_stores := v_stores || v_new;
  insert into public.stores (name, city, address)
  values ('Merkey Lubumbashi', 'Lubumbashi', 'Avenue Lumumba, Quartier du Golf')
  returning id into v_new; v_stores := v_stores || v_new;
  insert into public.stores (name, city, address)
  values ('Merkey Goma', 'Goma', 'Avenue de la Paix, Quartier Himbi')
  returning id into v_new; v_stores := v_stores || v_new;
  insert into public.stores (name, city, address)
  values ('Merkey Mbuji-Mayi', 'Mbuji-Mayi', 'Boulevard Laurent-Désiré Kabila')
  returning id into v_new; v_stores := v_stores || v_new;

  insert into public.suppliers (name, contact, email, phone, address)
  values ('Merkey Import (Kinshasa)', 'Patrick Kabasele', 'import@merkeyrdc.com', '+243 81 000 00 01', 'Boulevard du 30 Juin, Gombe, Kinshasa')
  returning id into v_sup1;
  insert into public.suppliers (name, contact, email, phone, address)
  values ('Optic World Suppliers', 'Wang Li', 'sales@opticworld.cn', '+86 755 1234 5678', 'Optic Village, Guangzhou, Chine')
  returning id into v_sup2;
  insert into public.suppliers (name, contact, email, phone, address)
  values ('Vision Trade SARL', 'Ahmed Ben Salah', 'contact@visiontrade.cd', '+243 89 000 00 02', 'Chaussée Kasavubu, Lubumbashi')
  returning id into v_sup3;

  insert into public.clients (name, email, phone, city, type, status)
  values ('Grace Mukendi', 'grace@exemple.cd', '+243 81 111 22 33', 'Kinshasa', 'individual', 'active')
  returning id into v_cli1;
  insert into public.clients (name, email, phone, city, company, type, status)
  values ('Café RDC SARL', 'comptes@caferdc.cd', '+243 82 222 33 44', 'Lubumbashi', 'Café RDC', 'business', 'active')
  returning id into v_cli2;
  insert into public.clients (name, email, phone, city, company, type, status)
  values ('Boutique Élance', 'contact@elance.cd', '+243 99 333 44 55', 'Goma', 'Élance SARL', 'business', 'active')
  returning id into v_cli3;
  insert into public.clients (name, email, phone, city, type, status)
  values ('Joël Kabeya', 'joel@exemple.cd', '+243 85 444 55 66', 'Mbuji-Mayi', 'individual', 'active')
  returning id into v_cli4;

  -- Produits : stock initial 0, reconstruit ensuite par les mouvements.
  for j in 1..array_length(v_names, 1) loop
    insert into public.products (name, sku, category_id, supplier_id, price, cost, stock, min_stock, description)
    values (
      v_names[j], v_skus[j],
      v_cats[v_cat_idx[j]],
      case j when 1 then v_sup1 when 2 then v_sup1 when 3 then v_sup1 when 4 then v_sup2 else v_sup3 end,
      v_prices[j], v_costs[j], 0, v_min[j], v_descs[j]
    )
    returning id into v_new;
    v_prods := v_prods || v_new;
  end loop;

  -- Compter les ventes attendues par boutique (v_exp[j][c]) pour dimensionner
  -- les répartitions : la boutique ne doit jamais passer sous zéro.
  v_exp := array_fill(0::int, array[8,4]);
  for j in 1..array_length(v_prods, 1) loop
    for i in 1..v_sale_count[j] loop
      qty := 1 + mod(i * 3 + j, 3);
      cityc := 1 + mod(i * 2 + j, 4);
      v_exp[j][cityc] := v_exp[j][cityc] + qty;
    end loop;
  end loop;

  -- Approvisionnements reçus au dépôt central, puis répartitions.
  -- supply_qty = stock_cible_total + total_des_ventes (jamais de solde négatif).
  for j in 1..array_length(v_prods, 1) loop
    v_expected_total := 0; v_target_total := 0;
    for c in 1..4 loop
      v_expected_total := v_expected_total + v_exp[j][c];
      v_target_total := v_target_total + v_target[j][c];
    end loop;

    v_supply_qty := v_target_total + v_expected_total;
    insert into public.supplies (supplier_id, product_id, quantity, cost, status, notes, created_at)
    values (
      case j when 1 then v_sup1 when 2 then v_sup1 when 3 then v_sup1 when 4 then v_sup2 else v_sup3 end,
      v_prods[j], v_supply_qty, v_costs[j], 'received', 'Livraison de référence',
      now() - interval '10 days'
    );

    -- Répartition dépôt -> boutique, dimensionnée pour couvrir les ventes.
    for c in 1..4 loop
      if v_target[j][c] + v_exp[j][c] > 0 then
        perform public.transfer_stock(
          v_prods[j], v_target[j][c] + v_exp[j][c], v_stores[1], v_stores[c + 1]
        );
      end if;
    end loop;
  end loop;

  -- Un approvisionnement en attente (aucun impact sur le stock).
  insert into public.supplies (supplier_id, product_id, quantity, cost, status, notes, created_at)
  values (v_sup2, v_prods[4], 10, v_costs[4], 'pending', 'Complément commandé',
          now() - interval '2 days');

  -- Ventes « completed » localisées par boutique ; motrices du module prédictif.
  for j in 1..array_length(v_prods, 1) loop
    for i in 1..v_sale_count[j] loop
      qty := 1 + mod(i * 3 + j, 3);
      cityc := 1 + mod(i * 2 + j, 4);
      v_sale_date := now() - mod(i * 2 + j, 30) * interval '1 day' - (i * 17) * interval '1 minute';
      if mod(i + j, 2) = 0 then
        select name into v_client_name from public.clients
        where id = (array[v_cli1, v_cli2, v_cli3, v_cli4])[1 + mod(i * 2 + j, 4)];
        insert into public.sales (product_id, store_id, client_id, customer_name, quantity, unit_price, status, created_at)
        values (v_prods[j], v_stores[cityc + 1], (array[v_cli1, v_cli2, v_cli3, v_cli4])[1 + mod(i * 2 + j, 4)], v_client_name,
                qty, v_prices[j], 'completed', v_sale_date);
      else
        insert into public.sales (product_id, store_id, quantity, unit_price, status, created_at)
        values (v_prods[j], v_stores[cityc + 1], qty, v_prices[j], 'completed', v_sale_date);
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