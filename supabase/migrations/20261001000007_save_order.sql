-- =====================================================================
-- Saborya CRM — 0007 · Gravação atômica de pedido (cabeçalho + itens)
-- SECURITY INVOKER: RLS e triggers de regra de negócio continuam valendo.
-- =====================================================================

create or replace function public.save_order(p_id uuid, p_header jsonb, p_items jsonb)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_id uuid;
  v_status public.order_status;
  v_opp uuid := nullif(p_header ->> 'opportunity_id', '')::uuid;
  v_new_status public.order_status := coalesce(nullif(p_header ->> 'status', ''), 'pedido_realizado')::public.order_status;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Adicione pelo menos um produto.' using errcode = 'P0001';
  end if;
  if v_new_status not in ('orcamento', 'pedido_realizado') then
    raise exception 'Use o faturamento para alterar o pedido para faturado/entrega.' using errcode = 'P0001';
  end if;

  if p_id is null then
    insert into public.orders (company_id, contact_id, opportunity_id, owner_id, order_date, status, notes)
    values (
      (p_header ->> 'company_id')::uuid,
      nullif(p_header ->> 'contact_id', '')::uuid,
      v_opp,
      coalesce(nullif(p_header ->> 'owner_id', '')::uuid, auth.uid()),
      coalesce(nullif(p_header ->> 'order_date', '')::date, current_date),
      v_new_status,
      nullif(p_header ->> 'notes', '')
    )
    returning id into v_id;
  else
    select status into v_status from public.orders where id = p_id;
    if not found then
      raise exception 'Pedido não encontrado.' using errcode = 'P0001';
    end if;
    if not public.order_is_editable(v_status) then
      raise exception 'Pedido faturado ou cancelado não pode ser editado.' using errcode = 'P0001';
    end if;
    update public.orders set
      company_id = (p_header ->> 'company_id')::uuid,
      contact_id = nullif(p_header ->> 'contact_id', '')::uuid,
      opportunity_id = v_opp,
      owner_id = coalesce(nullif(p_header ->> 'owner_id', '')::uuid, owner_id),
      order_date = coalesce(nullif(p_header ->> 'order_date', '')::date, order_date),
      status = v_new_status,
      notes = nullif(p_header ->> 'notes', '')
    where id = p_id;
    delete from public.order_items where order_id = p_id;
    v_id := p_id;
  end if;

  insert into public.order_items (order_id, product_id, quantity, unit_price)
  select v_id, (i ->> 'product_id')::uuid, (i ->> 'quantity')::numeric, (i ->> 'unit_price')::numeric
    from jsonb_array_elements(p_items) i;

  update public.orders set discount = coalesce(nullif(p_header ->> 'discount', '')::numeric, 0) where id = v_id;

  -- Pedido realizado avança a oportunidade para a etapa "Pedido".
  if v_opp is not null and v_new_status = 'pedido_realizado' then
    update public.opportunities o
       set stage_key = 'pedido'
      from public.pipeline_stages cur, public.pipeline_stages tgt
     where o.id = v_opp and cur.key = o.stage_key and tgt.key = 'pedido'
       and not cur.is_won and not cur.is_lost and cur.position < tgt.position;
  end if;

  return v_id;
end $$;

revoke execute on function public.save_order(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_order(uuid, jsonb, jsonb) to authenticated, service_role;
