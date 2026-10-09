-- =============================================================================
-- Merkey — Migration 0004 : multi-boutiques (adaptation lunetterie)
--
-- Modèle retenu :
--   * un dépôt central (`stores.is_dispatch_center = true`) reçoit les
--     approvisionnements puis répartit vers les boutiques ;
--   * `products.stock` reste le stock TOTAL toutes boutiques confondues
--     (les prévisions restent globales) ;
--   * `stock_movements` et `sales` sont localisés par `store_id` et le stock
--     par boutique vit dans `stock_by_store` (maintenu par trigger).
--   * les répartitions passent par le RPC `transfer_stock` (2 mouvements
--     jumelés, un seul appel protéger contre les écritures directes).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table stores
-- -----------------------------------------------------------------------------
create table if not exists public.stores (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  city               text not null default '',
  address            text,
  is_dispatch_center boolean not null default false,
  status             entity_status not null default 'active',
  created_at         timestamptz not null default now()
);

create index if not exists idx_stores_city on public.stores(city);

-- -----------------------------------------------------------------------------
-- 2. Reason de mouvement « transfer »
-- -----------------------------------------------------------------------------
do $$ begin
  alter type public.movement_reason add value if not exists 'transfer';
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 3. Localisation des ventes et des mouvements
-- -----------------------------------------------------------------------------
alter table public.sales add column if not exists store_id uuid references public.stores(id) on delete restrict;
alter table public.stock_movements add column if not exists store_id uuid references public.stores(id) on delete restrict;

-- Rétro-remplissage (si le script est lancé sur une base déjà peuplée) :
-- on garantit l'existence d'un dépôt central avant d'y rattacher les
-- ventes/mouvements existants dépourvus de `store_id`.
insert into public.stores (name, city, address, is_dispatch_center)
select 'Dépôt central', 'Kinshasa', 'Siège social', true
where not exists (select 1 from public.stores where is_dispatch_center);

do $$
declare v_depot uuid;
begin
  select id into v_depot from public.stores where is_dispatch_center order by created_at limit 1;
  if v_depot is null then
    select id into v_depot from public.stores limit 1;
  end if;
  update public.stock_movements set store_id = v_depot where store_id is null;
  update public.sales set store_id = v_depot where store_id is null;
end $$;

alter table public.sales alter column store_id set not null;
alter table public.stock_movements alter column store_id set not null;

create index if not exists idx_sales_store on public.sales(store_id);
create index if not exists idx_stock_movements_store on public.stock_movements(store_id);

-- -----------------------------------------------------------------------------
-- 4. Logique métier : le stock par boutique
--    stock_by_store = projection du journal (source de vérité).
-- -----------------------------------------------------------------------------
create table if not exists public.stock_by_store (
  product_id uuid not null references public.products(id) on delete cascade,
  store_id   uuid not null references public.stores(id) on delete cascade,
  quantity   integer not null default 0 check (quantity >= 0),
  primary key (product_id, store_id)
);

create or replace function public.apply_stock_bucket()
returns trigger language plpgsql as $$
declare v_cur int;
begin
  select quantity into v_cur from public.stock_by_store
   where product_id = new.product_id and store_id = new.store_id;

  if v_cur is null then
    -- Nouvelle ligne : il est impossible de retirer du stock absent.
    if new.quantity < 0 then
      raise exception 'Stock insuffisant pour % dans la boutique %.', new.product_id, new.store_id;
    end if;
    insert into public.stock_by_store (product_id, store_id, quantity)
    values (new.product_id, new.store_id, new.quantity);
  else
    -- Ligne existante : on ne passe jamais par un INSERT négatif (le CHECK
    -- de colonne serait évalué avant la résolution de conflit et ferait
    -- échouer l'écriture même si le solde final reste positif).
    update public.stock_by_store
       set quantity = quantity + new.quantity
     where product_id = new.product_id and store_id = new.store_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_stock_bucket on public.stock_movements;
create trigger trg_apply_stock_bucket
after insert on public.stock_movements
for each row execute function public.apply_stock_bucket();

-- Projection initiale du stock par boutique à partir du journal existant.
insert into public.stock_by_store (product_id, store_id, quantity)
select product_id, store_id, sum(quantity)
  from public.stock_movements
 group by product_id, store_id;

-- -----------------------------------------------------------------------------
-- 5. Triggers : les tr�iggers vente / appro génèrent des mouvements localisés
--    (les approvisionnements arrivent au dépôt central).
-- -----------------------------------------------------------------------------
create or replace function public.on_sale_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_product_name text;
begin
  if new.status = 'completed' then
    insert into public.stock_movements (product_id, store_id, quantity, reason, reference_id, created_by)
    values (new.product_id, new.store_id, -new.quantity, 'sale', new.id, new.created_by);
  end if;

  select name into v_product_name from public.products where id = new.product_id;
  insert into public.audit_log (entity_type, action, entity_id, entity_name, details, user_id)
  values ('sale', 'create', new.id, v_product_name, 'Qté: ' || new.quantity, new.created_by);
  return new;
end;
$$;

create or replace function public.on_supply_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_product_name text;
declare v_depot uuid;
begin
  select id into v_depot from public.stores where is_dispatch_center order by created_at limit 1;
  if v_depot is null then
    select id into v_depot from public.stores limit 1;
  end if;

  if new.status = 'received' then
    insert into public.stock_movements (product_id, store_id, quantity, reason, reference_id, created_by)
    values (new.product_id, v_depot, new.quantity, 'supply', new.id, new.created_by);
  end if;

  select name into v_product_name from public.products where id = new.product_id;
  insert into public.audit_log (entity_type, action, entity_id, entity_name, details, user_id)
  values ('supply', 'create', new.id, v_product_name, 'Qté: ' || new.quantity, new.created_by);
  return new;
end;
$$;

create or replace function public.on_supply_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_depot uuid;
begin
  if new.status = 'received' and old.status is distinct from 'received' then
    select id into v_depot from public.stores where is_dispatch_center order by created_at limit 1;
    if v_depot is null then
      select id into v_depot from public.stores limit 1;
    end if;
    insert into public.stock_movements (product_id, store_id, quantity, reason, reference_id, created_by)
    values (new.product_id, v_depot, new.quantity, 'supply', new.id, auth.uid());
    insert into public.audit_log (entity_type, action, entity_id, entity_name, user_id)
    values ('supply', 'update', new.id, (select name from public.products where id = new.product_id), auth.uid());
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. RPC transfer_stock : répartition dépôt -> boutique (ou bizarre -> boutique)
--    Écriture protégée : 2 mouvements jumelés, jamais de solde négatif.
-- -----------------------------------------------------------------------------
create or replace function public.transfer_stock(
  p_product_id uuid,
  p_quantity integer,
  p_from_store_id uuid,
  p_to_store_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ref uuid;
  v_name text;
begin
  if p_quantity <= 0 then
    raise exception 'La quantite a transferer doit etre strictement positive.';
  end if;
  if p_from_store_id = p_to_store_id then
    raise exception 'La boutique d''origine et la destination sont identiques.';
  end if;

  v_ref := gen_random_uuid();

  insert into public.stock_movements (product_id, store_id, quantity, reason, reference_id, created_by)
  values (p_product_id, p_from_store_id, -p_quantity, 'transfer', v_ref, auth.uid());

  insert into public.stock_movements (product_id, store_id, quantity, reason, reference_id, created_by)
  values (p_product_id, p_to_store_id, p_quantity, 'transfer', v_ref, auth.uid());

  select name into v_name from public.products where id = p_product_id;
  insert into public.audit_log (entity_type, action, entity_id, entity_name, details, user_id)
  values ('transfer', 'create', v_ref, v_name, 'Qté: ' || p_quantity || ' (répartition)', auth.uid());
end;
$$;

revoke all on function public.transfer_stock(uuid, integer, uuid, uuid) from public;
grant execute on function public.transfer_stock(uuid, integer, uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 7. Vue stock par boutique (lecture simple pour l'interface)
-- -----------------------------------------------------------------------------
create or replace view public.store_stock
with (security_invoker = true) as
select
  s.id       as store_id,
  s.name     as store_name,
  s.city     as store_city,
  s.is_dispatch_center,
  b.product_id,
  p.sku      as product_sku,
  p.name     as product_name,
  coalesce(b.quantity, 0) as quantity
from public.stores s
cross join public.products p
left join public.stock_by_store b
       on b.store_id = s.id and b.product_id = p.id;

-- -----------------------------------------------------------------------------
-- 8. RLS
-- -----------------------------------------------------------------------------
alter table public.stores enable row level security;
alter table public.stock_by_store enable row level security;

drop policy if exists stores_select on public.stores;
drop policy if exists stores_insert on public.stores;
drop policy if exists stores_update on public.stores;
drop policy if exists stores_delete on public.stores;

create policy stores_select on public.stores
  for select using (auth.uid() is not null);
create policy stores_insert on public.stores
  for insert with check (public.current_role() in ('admin', 'manager'));
create policy stores_update on public.stores
  for update using (public.current_role() in ('admin', 'manager'))
  with check (public.current_role() in ('admin', 'manager'));
create policy stores_delete on public.stores
  for delete using (public.current_role() = 'admin');

drop policy if exists stock_by_store_select on public.stock_by_store;
create policy stock_by_store_select on public.stock_by_store
  for select using (auth.uid() is not null);

-- Audit
drop trigger if exists trg_audit_stores on public.stores;
create trigger trg_audit_stores
after insert or update or delete on public.stores
for each row execute function public.audit_row();