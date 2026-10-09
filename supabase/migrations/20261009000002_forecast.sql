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
