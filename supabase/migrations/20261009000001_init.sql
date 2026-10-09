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
