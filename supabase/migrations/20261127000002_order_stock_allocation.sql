-- =============================================================================
-- Correctif commandes en ligne : allocation du stock depuis les boutiques
-- qui en disposent réellement, et restitution exacte lors d'une annulation.
--
-- Problème corrigé : le dépôt central n'a pas de stock dans le seed, donc
-- confirmer une commande échouait sur stock_by_store_quantity_check alors
-- que le stock global était suffisant.
-- =============================================================================

create or replace function public.on_order_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r  public.order_items%rowtype;
  b  record;
  v_remaining int;
  v_alloc     int;
  v_primary   uuid;
  v_dispatch  uuid;
begin
  select id into v_dispatch
    from public.stores
   where is_dispatch_center
   order by created_at
   limit 1;

  -- Confirmation (ou passage à un statut ultérieur) : on prélève le stock
  -- dans les boutiques disponibles, en priorité le dépôt, puis les plus
  -- gros stocks. Une seule transaction : tout ou rien.
  if new.status in ('confirmed', 'preparing', 'shipped', 'delivered')
     and old.stock_applied = false then

    for r in
      select *
        from public.order_items
       where order_id = new.id
         and product_id is not null
    loop
      v_remaining := r.quantity;

      for b in
        select s.store_id, s.quantity as available
          from public.stock_by_store s
         where s.product_id = r.product_id
           and s.quantity > 0
         order by (s.store_id = v_dispatch) desc, s.quantity desc, s.store_id
      loop
        v_alloc := least(b.available, v_remaining);

        if v_primary is null then
          v_primary := b.store_id;
        end if;

        insert into public.stock_movements (product_id, store_id, quantity, reason, reference_id)
        values (r.product_id, b.store_id, -v_alloc, 'sale', new.id);

        v_remaining := v_remaining - v_alloc;
        exit when v_remaining = 0;
      end loop;

      if v_remaining > 0 then
        raise exception 'Stock insuffisant pour le produit %.', r.product_id;
      end if;
    end loop;

    update public.orders
       set stock_applied = true,
           store_id = coalesce(v_primary, v_dispatch, old.store_id)
     where id = new.id;

    return new;
  end if;

  -- Annulation d'une commande déjà déstockée : on reverse exactement les
  -- mouvements 'sale' initiaux (produit + boutique + quantité).
  if new.status = 'cancelled'
     and old.status <> 'cancelled'
     and old.stock_applied = true then

    for b in
      select product_id, store_id, -quantity as qty
        from public.stock_movements
       where reference_id = new.id
         and reason = 'sale'
         and quantity < 0
       order by created_at
    loop
      insert into public.stock_movements (product_id, store_id, quantity, reason, reference_id)
      values (b.product_id, b.store_id, b.qty, 'adjustment', new.id);
    end loop;

    update public.orders set stock_applied = false where id = new.id;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_order_status_change on public.orders;
create trigger trg_order_status_change
after update of status on public.orders
for each row execute function public.on_order_status_change();
