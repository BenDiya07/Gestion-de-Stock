-- =============================================================================
-- GestiStock Pro — Schéma cible (PostgreSQL / Supabase)
-- Migration 0001 : schéma, intégrité référentielle, RLS, logique métier, audit.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Types énumérés
-- -----------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('admin', 'manager', 'employee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type entity_status as enum ('active', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type supply_status as enum ('pending', 'received', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sale_status as enum ('completed', 'pending', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type client_type as enum ('individual', 'business');
exception when duplicate_object then null; end $$;

do $$ begin
  create type movement_reason as enum ('supply', 'sale', 'adjustment');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 2. Tables
-- -----------------------------------------------------------------------------

-- Profils applicatifs (extension de auth.users)
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  email      text,
  role       user_role not null default 'employee',
  status     entity_status not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  contact    text,
  email      text,
  phone      text,
  address    text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sku         text not null unique,
  category_id uuid references public.categories(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  price       numeric(12,2) not null default 0 check (price >= 0),
  cost        numeric(12,2) not null default 0 check (cost >= 0),
  stock       integer not null default 0 check (stock >= 0),
  min_stock   integer not null default 0 check (min_stock >= 0),
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.clients (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  email          text,
  phone          text,
  address        text,
  city           text,
  postal_code    text,
  company        text,
  notes          text,
  type           client_type not null default 'individual',
  status         entity_status not null default 'active',
  total_purchases numeric(12,2) not null default 0,
  created_at     timestamptz not null default now()
);

create table if not exists public.supplies (
  id          uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  product_id  uuid not null references public.products(id) on delete restrict,
  quantity    integer not null check (quantity > 0),
  cost        numeric(12,2) not null check (cost >= 0),
  total_cost  numeric(12,2) generated always as (quantity * cost) stored,
  status      supply_status not null default 'pending',
  notes       text,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id) on delete set null
);

create table if not exists public.sales (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete restrict,
  client_id     uuid references public.clients(id) on delete set null,
  customer_name text,
  quantity      integer not null check (quantity > 0),
  unit_price    numeric(12,2) not null check (unit_price >= 0),
  total_price   numeric(12,2) generated always as (quantity * unit_price) stored,
  status        sale_status not null default 'completed',
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id) on delete set null
);

-- Journal immuable des mouvements : source de vérité du stock.
create table if not exists public.stock_movements (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products(id) on delete cascade,
  quantity     integer not null, -- > 0 entrée, < 0 sortie
  reason       movement_reason not null,
  reference_id uuid,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Journal d'audit (ex « Historique »)
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null,
  action      text not null check (action in ('create', 'update', 'delete')),
  entity_id   uuid,
  entity_name text,
  details     text,
  user_id     uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_products_supplier on public.products(supplier_id);
create index if not exists idx_stock_movements_product on public.stock_movements(product_id);
create index if not exists idx_sales_product on public.sales(product_id);
create index if not exists idx_sales_client on public.sales(client_id);

-- -----------------------------------------------------------------------------
-- 3. Fonctions utilitaires
-- -----------------------------------------------------------------------------

-- Rôle de l'utilisateur connecté (SECURITY DEFINER : évite la récursion RLS).
create or replace function public.current_role()
returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

-- updated_at automatique
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Création automatique du profil lors de l'inscription (auth.users -> profiles).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'employee'),
    'active'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Logique métier : stock et audit (délégués à la base, transactionnels)
-- -----------------------------------------------------------------------------

-- Applique un mouvement au stock courant.
create or replace function public.apply_stock_movement()
returns trigger language plpgsql as $$
begin
  update public.products
     set stock = stock + new.quantity,
         updated_at = now()
   where id = new.product_id;
  return new;
end;
$$;

-- Une vente « completed » génère une sortie de stock.
create or replace function public.on_sale_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_product_name text;
begin
  if new.status = 'completed' then
    insert into public.stock_movements (product_id, quantity, reason, reference_id, created_by)
    values (new.product_id, -new.quantity, 'sale', new.id, new.created_by);
  end if;

  select name into v_product_name from public.products where id = new.product_id;
  insert into public.audit_log (entity_type, action, entity_id, entity_name, details, user_id)
  values ('sale', 'create', new.id, v_product_name, 'Qté: ' || new.quantity, new.created_by);
  return new;
end;
$$;

-- Un approvisionnement « received » génère une entrée de stock.
create or replace function public.on_supply_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_product_name text;
begin
  if new.status = 'received' then
    insert into public.stock_movements (product_id, quantity, reason, reference_id, created_by)
    values (new.product_id, new.quantity, 'supply', new.id, new.created_by);
  end if;

  select name into v_product_name from public.products where id = new.product_id;
  insert into public.audit_log (entity_type, action, entity_id, entity_name, details, user_id)
  values ('supply', 'create', new.id, v_product_name, 'Qté: ' || new.quantity, new.created_by);
  return new;
end;
$$;

-- Passage d'un approvisionnement à « received » : entrée de stock.
create or replace function public.on_supply_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'received' and old.status is distinct from 'received' then
    insert into public.stock_movements (product_id, quantity, reason, reference_id, created_by)
    values (new.product_id, new.quantity, 'supply', new.id, auth.uid());
    insert into public.audit_log (entity_type, action, entity_id, entity_name, user_id)
    values ('supply', 'update', new.id, (select name from public.products where id = new.product_id), auth.uid());
  end if;
  return new;
end;
$$;

-- Audit générique pour les tables simples.
create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_action text;
  v_id     uuid;
  v_name   text;
begin
  v_action := case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'delete' end;
  if tg_op = 'DELETE' then
    v_id := old.id; v_name := coalesce(old.name, old.id::text);
  else
    v_id := new.id; v_name := coalesce(new.name, new.id::text);
  end if;

  insert into public.audit_log (entity_type, action, entity_id, entity_name, user_id)
  values (tg_table_name, v_action, v_id, v_name, auth.uid());
  return coalesce(new, old);
end;
$$;

-- Consommation d'une vente : met à jour le total du client associé.
create or replace function public.on_sale_touch_client()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.client_id is not null and new.status = 'completed' then
    update public.clients
       set total_purchases = total_purchases + new.total_price
     where id = new.client_id;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Triggers
-- -----------------------------------------------------------------------------
drop trigger if exists trg_profiles_updated on public.profiles;
drop trigger if exists trg_products_updated on public.products;

create trigger trg_products_updated
before update on public.products
for each row execute function public.set_updated_at();

create trigger trg_apply_stock_movement
after insert on public.stock_movements
for each row execute function public.apply_stock_movement();

create trigger trg_on_sale_created
after insert on public.sales
for each row execute function public.on_sale_created();

create trigger trg_on_sale_touch_client
after insert on public.sales
for each row execute function public.on_sale_touch_client();

create trigger trg_on_supply_created
after insert on public.supplies
for each row execute function public.on_supply_created();

create trigger trg_on_supply_status_change
after update on public.supplies
for each row execute function public.on_supply_status_change();

drop trigger if exists trg_audit_products on public.products;
drop trigger if exists trg_audit_suppliers on public.suppliers;
drop trigger if exists trg_audit_clients on public.clients;
drop trigger if exists trg_audit_categories on public.categories;
create trigger trg_audit_products  after insert or update or delete on public.products  for each row execute function public.audit_row();
create trigger trg_audit_suppliers after insert or update or delete on public.suppliers for each row execute function public.audit_row();
create trigger trg_audit_clients   after insert or update or delete on public.clients   for each row execute function public.audit_row();
create trigger trg_audit_categories after insert or update or delete on public.categories for each row execute function public.audit_row();

-- Inscription : création du profil.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 6. Row Level Security (la sécurité est appliquée par la base)
-- -----------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.categories      enable row level security;
alter table public.suppliers       enable row level security;
alter table public.products        enable row level security;
alter table public.clients         enable row level security;
alter table public.supplies        enable row level security;
alter table public.sales           enable row level security;
alter table public.stock_movements enable row level security;
alter table public.audit_log       enable row level security;

-- profiles -------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists profiles_admin_all on public.profiles;

create policy profiles_select on public.profiles
  for select using (auth.uid() is not null);

create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_admin_all on public.profiles
  for all using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- categories -----------------------------------------------------------------
drop policy if exists categories_select on public.categories;
drop policy if exists categories_manage on public.categories;

create policy categories_select on public.categories
  for select using (auth.uid() is not null);

create policy categories_manage on public.categories
  for all using (public.current_role() in ('admin', 'manager'))
  with check (public.current_role() in ('admin', 'manager'));

-- suppliers ------------------------------------------------------------------
drop policy if exists suppliers_select on public.suppliers;
drop policy if exists suppliers_insert on public.suppliers;
drop policy if exists suppliers_update on public.suppliers;
drop policy if exists suppliers_delete on public.suppliers;

create policy suppliers_select on public.suppliers
  for select using (auth.uid() is not null);
create policy suppliers_insert on public.suppliers
  for insert with check (public.current_role() in ('admin', 'manager'));
create policy suppliers_update on public.suppliers
  for update using (public.current_role() in ('admin', 'manager'))
  with check (public.current_role() in ('admin', 'manager'));
create policy suppliers_delete on public.suppliers
  for delete using (public.current_role() = 'admin');

-- products -------------------------------------------------------------------
drop policy if exists products_select on public.products;
drop policy if exists products_insert on public.products;
drop policy if exists products_update on public.products;
drop policy if exists products_delete on public.products;

create policy products_select on public.products
  for select using (auth.uid() is not null);
create policy products_insert on public.products
  for insert with check (public.current_role() in ('admin', 'manager'));
create policy products_update on public.products
  for update using (public.current_role() in ('admin', 'manager'))
  with check (public.current_role() in ('admin', 'manager'));
create policy products_delete on public.products
  for delete using (public.current_role() = 'admin');

-- clients --------------------------------------------------------------------
drop policy if exists clients_select on public.clients;
drop policy if exists clients_insert on public.clients;
drop policy if exists clients_update on public.clients;
drop policy if exists clients_delete on public.clients;

create policy clients_select on public.clients
  for select using (auth.uid() is not null);
create policy clients_insert on public.clients
  for insert with check (public.is_staff());
create policy clients_update on public.clients
  for update using (public.is_staff()) with check (public.is_staff());
create policy clients_delete on public.clients
  for delete using (public.current_role() in ('admin', 'manager'));

-- supplies -------------------------------------------------------------------
drop policy if exists supplies_select on public.supplies;
drop policy if exists supplies_insert on public.supplies;
drop policy if exists supplies_update on public.supplies;
drop policy if exists supplies_delete on public.supplies;

create policy supplies_select on public.supplies
  for select using (auth.uid() is not null);
create policy supplies_insert on public.supplies
  for insert with check (public.current_role() in ('admin', 'manager'));
create policy supplies_update on public.supplies
  for update using (public.current_role() in ('admin', 'manager'))
  with check (public.current_role() in ('admin', 'manager'));
create policy supplies_delete on public.supplies
  for delete using (public.current_role() = 'admin');

-- sales ----------------------------------------------------------------------
drop policy if exists sales_select on public.sales;
drop policy if exists sales_insert on public.sales;
drop policy if exists sales_update on public.sales;
drop policy if exists sales_delete on public.sales;

create policy sales_select on public.sales
  for select using (auth.uid() is not null);
create policy sales_insert on public.sales
  for insert with check (public.is_staff());
create policy sales_update on public.sales
  for update using (public.current_role() in ('admin', 'manager'))
  with check (public.current_role() in ('admin', 'manager'));
create policy sales_delete on public.sales
  for delete using (public.current_role() in ('admin', 'manager'));

-- stock_movements : lecture seule (écriture via triggers SECURITY DEFINER) -----
drop policy if exists stock_movements_select on public.stock_movements;
create policy stock_movements_select on public.stock_movements
  for select using (auth.uid() is not null);

-- audit_log : lecture admin/manager ------------------------------------------
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log
  for select using (public.current_role() in ('admin', 'manager'));

-- -----------------------------------------------------------------------------
-- 7. Données de référence (catégories)
-- -----------------------------------------------------------------------------
insert into public.categories (name) values
  ('Informatique'), ('Accessoires'), ('Périphériques'), ('Stockage')
on conflict (name) do nothing;
-- =============================================================================
-- Migration 0002 : prévision de rupture de stock (point de commande dynamique)
-- =============================================================================

-- Index pour accélérer l'agrégation des ventes par produit/date.
create index if not exists idx_sales_product_date
  on public.sales(product_id, created_at);

-- Point de commande dynamique et stock de sécurité pour un produit.
--
--   stock de sécurité = z(service) × écart-type(conso jour) × √(délai)
--   point de commande = conso moyenne jour × délai + stock de sécurité
create or replace function public.product_forecast(
  p_product_id uuid,
  p_window_days int default 30,
  p_lead_time_days int default 7,
  p_service_level numeric default 0.95
)
returns table (
  product_id uuid,
  avg_daily_demand numeric,
  demand_stddev numeric,
  safety_stock numeric,
  reorder_point numeric,
  days_of_stock numeric
)
language sql stable security definer set search_path = public as $$
  with daily as (
    select d::date as day,
           coalesce(sum(s.quantity), 0)::numeric as qty
    from generate_series(
           (current_date - (p_window_days - 1)),
           current_date,
           interval '1 day'
         ) as d
    left join public.sales s
      on s.product_id = p_product_id
     and s.status = 'completed'
     and s.created_at::date = d::date
    group by d::date
  ),
  stats as (
    select coalesce(avg(qty), 0) as mu,
           coalesce(stddev_pop(qty), 0) as sigma
    from daily
  ),
  z as (
    select case
      when p_service_level >= 0.999 then 3.09
      when p_service_level >= 0.99  then 2.326
      when p_service_level >= 0.975 then 1.96
      when p_service_level >= 0.95  then 1.645
      when p_service_level >= 0.90  then 1.282
      else 1.0
    end as val
  )
  select
    p_product_id,
    round(stats.mu, 3),
    round(stats.sigma::numeric, 3),
    round((z.val * stats.sigma * sqrt(p_lead_time_days))::numeric, 1),
    ceil(stats.mu * p_lead_time_days + z.val * stats.sigma * sqrt(p_lead_time_days)),
    case when stats.mu > 0 then round(pr.stock / stats.mu, 1) else null end
  from stats, z, public.products pr
  where pr.id = p_product_id;
$$;

comment on function public.product_forecast is
  'Point de commande dynamique par produit (consommation sur fenêtre glissante, niveau de service).';

-- Vue d'ensemble : prévision pour tous les produits (seuil par défaut).
create or replace view public.product_forecast_all
with (security_invoker = true) as
  select
    p.id as product_id,
    p.name,
    p.sku,
    p.stock,
    p.min_stock,
    f.avg_daily_demand,
    f.safety_stock,
    f.reorder_point,
    f.days_of_stock,
    case
      when p.stock <= 0 then 'rupture'
      when p.stock <= f.safety_stock then 'critique'
      when p.stock <= f.reorder_point then 'a_commander'
      else 'ok'
    end as status
  from public.products p
  cross join lateral public.product_forecast(p.id) f;
-- =============================================================================
-- Migration 0003 : prévisions pour tous les produits en un seul appel RPC.
-- Remplace la vue (sans paramètres) par une fonction paramétrable.
-- =============================================================================

drop view if exists public.product_forecast_all;

create or replace function public.product_forecast_all(
  p_window_days int default 30,
  p_lead_time_days int default 7,
  p_service_level numeric default 0.95
)
returns table (
  product_id uuid,
  name text,
  sku text,
  stock integer,
  avg_daily_demand numeric,
  demand_stddev numeric,
  safety_stock numeric,
  reorder_point numeric,
  days_of_stock numeric,
  status text
)
language sql stable security definer set search_path = public as $$
  select
    p.id as product_id,
    p.name,
    p.sku,
    p.stock,
    f.avg_daily_demand,
    f.demand_stddev,
    f.safety_stock,
    f.reorder_point,
    f.days_of_stock,
    case
      when p.stock <= 0 then 'rupture'
      when p.stock <= f.safety_stock then 'critique'
      when p.stock <= f.reorder_point then 'a_commander'
      else 'ok'
    end as status
  from public.products p
  cross join lateral public.product_forecast(
    p.id, p_window_days, p_lead_time_days, p_service_level
  ) f;
$$;

comment on function public.product_forecast_all is
  'Prévision de rupture pour tous les produits (RPC : un seul appel PostgREST).';-- =============================================================================
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