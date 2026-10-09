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
  'Prévision de rupture pour tous les produits (RPC : un seul appel PostgREST).';