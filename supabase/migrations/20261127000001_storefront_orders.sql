-- =============================================================================
-- Merkey — Migration 0005 : vitrine + commandes en ligne
--
-- Objectifs :
--   * aligner la base avec le site vitrine Merkey (images, galerie, mise en
--     avant, champs marketing) ;
--   * stocker les commandes passées en ligne (paiement à la livraison) ;
--   * décrémenter le stock uniquement lorsque la commande est confirmée,
--     afin d'éviter les « faux » déstockages sur commandes annulées.
--
-- Additive et rétro-compatible avec l'application stock/POS existante.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Champs vitrine (idempotents)
-- -----------------------------------------------------------------------------
alter table public.categories add column if not exists slug text;
create unique index if not exists categories_slug_key on public.categories(slug);

alter table public.products
  add column if not exists image_url        text,
  add column if not exists gallery          text[]  default '{}',
  add column if not exists compare_at_price numeric,
  add column if not exists is_featured      boolean not null default false,
  add column if not exists is_new           boolean not null default false,
  add column if not exists is_active        boolean not null default true,
  add column if not exists features         text[]  default '{}';

-- Lecture publique du catalogue actif (site vitrine, rôle anon).
alter table public.products   enable row level security;
alter table public.categories enable row level security;

drop policy if exists "storefront read products" on public.products;
create policy "storefront read products" on public.products
  for select to anon, authenticated
  using (is_active = true);

drop policy if exists "storefront read categories" on public.categories;
create policy "storefront read categories" on public.categories
  for select to anon, authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- 2. Images produits (bucket public)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "storefront read product images" on storage.objects;
create policy "storefront read product images" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "staff write product images" on storage.objects;
create policy "staff write product images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_staff());

-- -----------------------------------------------------------------------------
-- 3. Newsletter (idempotent)
-- -----------------------------------------------------------------------------
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.newsletter_subscribers enable row level security;

drop policy if exists "storefront subscribe" on public.newsletter_subscribers;
create policy "storefront subscribe" on public.newsletter_subscribers
  for insert to anon, authenticated
  with check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- -----------------------------------------------------------------------------
-- 4. Commandes en ligne
-- -----------------------------------------------------------------------------
do $$ begin
  create type order_status as enum (
    'pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  reference      text not null unique
                 default ('MRK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  customer_name  text not null,
  customer_phone text not null,
  customer_city  text,
  note           text,
  subtotal       numeric(12,2) not null default 0 check (subtotal >= 0),
  discount       numeric(12,2) not null default 0 check (discount >= 0),
  shipping       numeric(12,2) not null default 0 check (shipping >= 0),
  total          numeric(12,2) not null default 0 check (total >= 0),
  promo_code     text,
  payment_method text not null default 'cod',
  status         order_status not null default 'pending',
  stock_applied  boolean not null default false,
  store_id       uuid references public.stores(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  product_id   uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price   numeric(12,2) not null check (unit_price >= 0),
  quantity     integer not null check (quantity > 0),
  line_total   numeric(12,2) generated always as (unit_price * quantity) stored,
  created_at   timestamptz not null default now()
);

create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_created on public.orders(created_at desc);
create index if not exists idx_order_items_order on public.order_items(order_id);

drop trigger if exists trg_orders_updated on public.orders;
create trigger trg_orders_updated
before update on public.orders
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. RPC create_order : point d'entrée public (anon) du checkout
--    SECURITY DEFINER : le client ne peut pas écrire directement dans les
--    tables, seulement passer par cette fonction contrôlée.
-- -----------------------------------------------------------------------------
create or replace function public.create_order(
  p_customer_name  text,
  p_customer_phone text,
  p_customer_city  text,
  p_note           text,
  p_promo_code     text,
  p_items          jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order    public.orders;
  v_item     jsonb;
  v_product  public.products;
  v_qty      integer;
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_shipping numeric(12,2) := 0;
begin
  if p_customer_name is null or length(trim(p_customer_name)) < 2 then
    raise exception 'Le nom du client est requis.';
  end if;

  if p_customer_phone is null
     or length(regexp_replace(p_customer_phone, '\D', '', 'g')) < 7 then
    raise exception 'Numéro de téléphone invalide.';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Le panier est vide.';
  end if;

  insert into public.orders (customer_name, customer_phone, customer_city, note, promo_code)
  values (
    trim(p_customer_name),
    trim(p_customer_phone),
    nullif(trim(coalesce(p_customer_city, '')), ''),
    nullif(trim(coalesce(p_note, '')), ''),
    nullif(upper(trim(coalesce(p_promo_code, ''))), '')
  )
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    if v_qty <= 0 then
      raise exception 'Quantité invalide dans le panier.';
    end if;

    select * into v_product
      from public.products
     where id = (v_item->>'product_id')::uuid
       and is_active = true;

    if not found then
      raise exception 'Produit introuvable ou indisponible.';
    end if;

    if v_product.stock < v_qty then
      raise exception 'Stock insuffisant pour « % » (disponible : %).', v_product.name, v_product.stock;
    end if;

    insert into public.order_items (order_id, product_id, product_name, unit_price, quantity)
    values (v_order.id, v_product.id, v_product.name, v_product.price, v_qty);

    v_subtotal := v_subtotal + (v_product.price * v_qty);
  end loop;

  if upper(coalesce(p_promo_code, '')) = 'MERKEY10' then
    v_discount := round(v_subtotal * 0.10, 2);
  end if;

  -- Frais de livraison : offerts dès 50 $ (aligné sur la config vitrine).
  if v_subtotal > 0 and v_subtotal < 50 then
    v_shipping := 3.5;
  end if;

  update public.orders
     set subtotal = v_subtotal,
         discount = v_discount,
         shipping = v_shipping,
         total    = greatest(0, v_subtotal - v_discount) + v_shipping
   where id = v_order.id
  returning * into v_order;

  insert into public.audit_log (entity_type, action, entity_id, entity_name, details)
  values ('order', 'create', v_order.id, v_order.reference,
          'Commande en ligne — ' || v_order.customer_name);

  return jsonb_build_object(
    'id', v_order.id,
    'reference', v_order.reference,
    'subtotal', v_order.subtotal,
    'discount', v_order.discount,
    'shipping', v_order.shipping,
    'total', v_order.total,
    'status', v_order.status
  );
end;
$$;

revoke all on function public.create_order(text, text, text, text, text, jsonb) from public;
grant execute on function public.create_order(text, text, text, text, text, jsonb)
  to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. Mouvement de stock lié au statut de la commande
--    * passage à « confirmed » : sortie de stock au dépôt central ;
--    * annulation d'une commande déjà déstockée : ré-entrée de stock.
-- -----------------------------------------------------------------------------
create or replace function public.on_order_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_depot uuid;
begin
  select id into v_depot
    from public.stores
   where is_dispatch_center
   order by created_at
   limit 1;

  if v_depot is null then
    select id into v_depot from public.stores order by created_at limit 1;
  end if;

  if new.status = 'cancelled'
     and old.status <> 'cancelled'
     and old.stock_applied = true then
    update public.orders set stock_applied = false where id = new.id;
    insert into public.stock_movements (product_id, store_id, quantity, reason, reference_id)
    select oi.product_id, coalesce(old.store_id, v_depot), oi.quantity, 'adjustment', new.id
      from public.order_items oi
     where oi.order_id = new.id and oi.product_id is not null;
    return new;
  end if;

  if new.status in ('confirmed', 'preparing', 'shipped', 'delivered')
     and old.stock_applied = false
     and v_depot is not null then
    insert into public.stock_movements (product_id, store_id, quantity, reason, reference_id)
    select oi.product_id, v_depot, -oi.quantity, 'sale', new.id
      from public.order_items oi
     where oi.order_id = new.id and oi.product_id is not null;

    update public.orders
       set stock_applied = true, store_id = v_depot
     where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_order_status_change on public.orders;
create trigger trg_order_status_change
after update of status on public.orders
for each row execute function public.on_order_status_change();

-- -----------------------------------------------------------------------------
-- 7. RLS : lecture/écriture réservées au staff, création via le RPC uniquement
-- -----------------------------------------------------------------------------
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

drop policy if exists orders_select on public.orders;
drop policy if exists orders_update on public.orders;
drop policy if exists orders_delete on public.orders;

create policy orders_select on public.orders
  for select using (public.is_staff());

create policy orders_update on public.orders
  for update using (public.is_staff()) with check (public.is_staff());

create policy orders_delete on public.orders
  for delete using (public.current_role() in ('admin', 'manager'));

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items
  for select using (public.is_staff());

-- -----------------------------------------------------------------------------
-- 8. Backfill des slugs de catégories (best effort, ne casse rien si absent)
-- -----------------------------------------------------------------------------
update public.categories set slug = 'lumierebleue'
 where slug is null and (lower(name) like '%bleu%' or lower(name) like '%blue%');
update public.categories set slug = 'photogrey'
 where slug is null and (lower(name) like '%photo%' or lower(name) like '%grey%' or lower(name) like '%gray%');
update public.categories set slug = 'soleil'
 where slug is null and lower(name) like '%soleil%';
update public.categories set slug = 'accessoires'
 where slug is null and (lower(name) like '%accessoire%' or lower(name) like '%étui%' or lower(name) like '%etui%');
