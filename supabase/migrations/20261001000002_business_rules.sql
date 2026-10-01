-- =====================================================================
-- Saborya CRM — 0002 · Regras de negócio (triggers)
-- =====================================================================

-- ---------------------------------------------------------------------
-- updated_at / updated_by
-- ---------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.tg_set_updated_meta()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['organizations', 'profiles', 'sales'] loop
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.tg_set_updated_at()', t);
  end loop;
  foreach t in array array['companies', 'contacts', 'products', 'opportunities', 'visits',
                           'activities', 'tasks', 'orders'] loop
    execute format('create trigger set_updated_meta before update on public.%I
                    for each row execute function public.tg_set_updated_meta()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Novo usuário do Auth -> perfil
-- O primeiro usuário da organização vira ADMIN. Demais: papel vem de
-- app_metadata (definido só pelo servidor), padrão "vendedor".
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_role public.user_role;
begin
  v_org := coalesce(
    nullif(new.raw_app_meta_data ->> 'organization_id', '')::uuid,
    (select id from public.organizations order by created_at limit 1)
  );
  if v_org is null then
    raise exception 'Nenhuma organização cadastrada. Rode as migrations antes de criar usuários.';
  end if;

  if not exists (select 1 from public.profiles where organization_id = v_org and role = 'admin') then
    v_role := 'admin';
  else
    v_role := coalesce(nullif(new.raw_app_meta_data ->> 'role', '')::public.user_role, 'vendedor');
  end if;

  insert into public.profiles (id, organization_id, full_name, email, phone, role, is_demo)
  values (
    new.id,
    v_org,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    v_role,
    coalesce((new.raw_app_meta_data ->> 'is_demo')::boolean, false)
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Vendedor não altera o próprio papel, comissão, status ou organização.
create or replace function public.tg_protect_profile()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role
       or new.active is distinct from old.active
       or new.organization_id is distinct from old.organization_id then
      raise exception 'Apenas o gestor pode alterar o papel ou o status do usuário.'
        using errcode = '42501';
    end if;
  end if;
  -- Nunca deixar a organização sem admin ativo
  if old.role = 'admin' and (new.role <> 'admin' or not new.active) then
    if not exists (
      select 1 from public.profiles
      where organization_id = old.organization_id and role = 'admin' and active and id <> old.id
    ) then
      raise exception 'A organização precisa de pelo menos um gestor ativo.';
    end if;
  end if;
  return new;
end $$;

create trigger protect_profile before update on public.profiles
  for each row execute function public.tg_protect_profile();

-- Somente o gestor pode transferir o responsável (owner) de um registro.
create or replace function public.tg_protect_owner()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.owner_id is distinct from old.owner_id
     and auth.uid() is not null and not public.is_admin() then
    raise exception 'Apenas o gestor pode transferir o vendedor responsável.' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['companies', 'opportunities', 'visits', 'activities', 'tasks', 'orders'] loop
    execute format('create trigger protect_owner before update on public.%I
                    for each row execute function public.tg_protect_owner()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Clientes: histórico de temperatura/status (nunca apagado)
-- ---------------------------------------------------------------------
create or replace function public.tg_company_status_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.company_status_history (organization_id, company_id, from_status, to_status, changed_by)
    values (new.organization_id, new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid());
  end if;
  return null;
end $$;

create trigger company_status_history
  after insert or update of status on public.companies
  for each row execute function public.tg_company_status_history();

-- Ordem de "temperatura" para promoções automáticas (nunca rebaixa sozinho).
create or replace function public.temperature_rank(t public.lead_temperature)
returns integer language sql immutable set search_path = '' as $$
  select case t when 'frio' then 1 when 'interessado' then 2 when 'quente' then 3
                when 'cliente' then 4 else 0 end;
$$;

create or replace function public.promote_company_status(p_company uuid, p_status public.lead_temperature)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.companies
     set status = p_status
   where id = p_company
     and (status = 'perdido' and p_status = 'cliente'
          or (status <> 'perdido' and public.temperature_rank(p_status) > public.temperature_rank(status)));
end $$;

-- ---------------------------------------------------------------------
-- Oportunidades: mudança de etapa
-- ---------------------------------------------------------------------
create or replace function public.tg_opportunity_before()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_stage public.pipeline_stages;
begin
  if tg_op = 'INSERT' or new.stage_key is distinct from old.stage_key then
    select * into v_stage from public.pipeline_stages where key = new.stage_key;
    new.stage_entered_at := now();
    if v_stage.is_won then
      new.temperature := 'cliente';
      new.closed_at := coalesce(new.closed_at, now());
    elsif v_stage.is_lost then
      new.temperature := 'perdido';
      new.closed_at := coalesce(new.closed_at, now());
    else
      new.closed_at := null;
      if tg_op = 'UPDATE' and old.temperature in ('cliente', 'perdido') then
        new.temperature := 'quente';
      end if;
    end if;
  end if;
  if tg_op = 'INSERT' then
    new.last_activity_at := coalesce(new.last_activity_at, now());
  end if;
  return new;
end $$;

create trigger opportunity_before
  before insert or update on public.opportunities
  for each row execute function public.tg_opportunity_before();

create or replace function public.tg_opportunity_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.stage_key is distinct from old.stage_key then
    insert into public.opportunity_stage_history
      (organization_id, opportunity_id, from_stage, to_stage, changed_by, seconds_in_previous_stage)
    values (
      new.organization_id, new.id,
      case when tg_op = 'UPDATE' then old.stage_key end,
      new.stage_key, auth.uid(),
      case when tg_op = 'UPDATE' then extract(epoch from now() - old.stage_entered_at)::bigint end
    );
  end if;
  if new.deleted_at is null and new.temperature <> 'perdido' then
    perform public.promote_company_status(new.company_id, new.temperature);
  end if;
  return null;
end $$;

create trigger opportunity_after
  after insert or update on public.opportunities
  for each row execute function public.tg_opportunity_after();

-- ---------------------------------------------------------------------
-- Atividades: atualiza "último contato" de cliente e oportunidade
-- ---------------------------------------------------------------------
create or replace function public.tg_activity_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.deleted_at is not null then
    return null;
  end if;
  update public.companies
     set last_contact_at = greatest(coalesce(last_contact_at, new.occurred_at), new.occurred_at)
   where id = new.company_id;
  if new.opportunity_id is not null then
    update public.opportunities
       set last_activity_at = greatest(coalesce(last_activity_at, new.occurred_at), new.occurred_at),
           next_activity_date = coalesce(new.next_action_date, next_activity_date),
           next_activity_note = coalesce(new.next_action, next_activity_note)
     where id = new.opportunity_id;
  end if;
  return null;
end $$;

create trigger activity_after
  after insert on public.activities
  for each row execute function public.tg_activity_after();

-- ---------------------------------------------------------------------
-- Visitas: gera atividade na linha do tempo, atualiza cliente/oportunidade
-- ---------------------------------------------------------------------
create or replace function public.tg_visit_after()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_desc text;
  v_type_label text;
  v_result_label text;
begin
  v_type_label := case new.visit_type
    when 'primeira_visita' then 'Primeira visita' when 'follow_up' then 'Follow-up'
    when 'apresentacao' then 'Apresentação de produto' when 'negociacao' then 'Negociação'
    when 'pos_venda' then 'Pós-venda' else 'Reativação' end;
  v_result_label := case new.result
    when 'sem_interesse' then 'Sem interesse' when 'interessado' then 'Interessado'
    when 'negociacao' then 'Negociação' when 'pedido_realizado' then 'Pedido realizado'
    when 'retornar_depois' then 'Retornar depois' else 'Perdido' end;
  v_desc := 'Visita realizada (' || v_type_label || ')' ||
            coalesce(' — ' || nullif(trim(new.objective), ''), '');

  insert into public.activities
    (organization_id, type, company_id, contact_id, opportunity_id, visit_id, owner_id,
     occurred_at, description, result, next_action, next_action_date, is_demo, created_by)
  values
    (new.organization_id, 'visita', new.company_id, new.contact_id, new.opportunity_id, new.id, new.owner_id,
     new.visited_at, v_desc, v_result_label || coalesce('. ' || nullif(trim(new.notes), ''), ''),
     new.next_step, new.next_contact_date, new.is_demo, coalesce(auth.uid(), new.owner_id));

  update public.companies
     set last_visit_at = greatest(coalesce(last_visit_at, new.visited_at), new.visited_at),
         next_contact_date = coalesce(new.next_contact_date, next_contact_date)
   where id = new.company_id;

  if new.result = 'interessado' then
    perform public.promote_company_status(new.company_id, 'interessado');
  elsif new.result in ('negociacao', 'pedido_realizado') then
    perform public.promote_company_status(new.company_id, 'quente');
  end if;
  return null;
end $$;

create trigger visit_after
  after insert on public.visits
  for each row execute function public.tg_visit_after();

-- ---------------------------------------------------------------------
-- Tarefas: data de conclusão
-- ---------------------------------------------------------------------
create or replace function public.tg_task_before()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'concluida' and (tg_op = 'INSERT' or old.status <> 'concluida') then
    new.completed_at := now();
  elsif new.status <> 'concluida' then
    new.completed_at := null;
  end if;
  return new;
end $$;

create trigger task_before
  before insert or update on public.tasks
  for each row execute function public.tg_task_before();

-- ---------------------------------------------------------------------
-- Pedidos: itens, totais, transições de status
-- ---------------------------------------------------------------------
create or replace function public.order_is_editable(p_status public.order_status)
returns boolean language sql immutable set search_path = '' as $$
  select p_status in ('orcamento', 'pedido_realizado');
$$;

create or replace function public.tg_order_items_guard()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_status public.order_status;
begin
  select status into v_status from public.orders
   where id = coalesce(new.order_id, old.order_id);
  -- Exclusão em cascata do pedido inteiro não passa por aqui com pedido existente.
  if v_status is not null and not public.order_is_editable(v_status) then
    raise exception 'Itens não podem ser alterados após o faturamento ou cancelamento do pedido.'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

create trigger order_items_guard
  before insert or update or delete on public.order_items
  for each row execute function public.tg_order_items_guard();

create or replace function public.recalc_order_totals(p_order uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.orders o
     set subtotal = coalesce((select sum(i.subtotal) from public.order_items i where i.order_id = o.id), 0)
   where o.id = p_order;
end $$;

create or replace function public.tg_order_items_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.recalc_order_totals(old.order_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.order_id <> old.order_id) then
    perform public.recalc_order_totals(new.order_id);
  end if;
  return null;
end $$;

create trigger order_items_after
  after insert or update or delete on public.order_items
  for each row execute function public.tg_order_items_after();

create or replace function public.tg_order_before()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_is_admin boolean := auth.uid() is null or public.is_admin();
begin
  -- Total = subtotal - desconto (nunca negativo)
  if new.discount > new.subtotal then
    new.discount := new.subtotal;
  end if;
  new.total := greatest(new.subtotal - new.discount, 0);

  if tg_op = 'INSERT' then
    if not v_is_admin and new.status not in ('orcamento', 'pedido_realizado') then
      raise exception 'Vendedor só pode criar orçamentos ou pedidos realizados.' using errcode = '42501';
    end if;
  elsif new.status is distinct from old.status then
    if not v_is_admin then
      if not public.order_is_editable(old.status)
         or new.status not in ('orcamento', 'pedido_realizado', 'cancelado') then
        raise exception 'Apenas o gestor pode faturar, despachar ou alterar pedidos já faturados.'
          using errcode = '42501';
      end if;
    end if;
  elsif not v_is_admin and not public.order_is_editable(old.status)
        and (new.discount is distinct from old.discount or new.company_id is distinct from old.company_id) then
    raise exception 'Pedido faturado não pode ser alterado pelo vendedor.' using errcode = '42501';
  end if;

  if new.status = 'faturado' and new.invoiced_at is null then new.invoiced_at := now(); end if;
  if new.status in ('em_entrega', 'entregue') and new.invoiced_at is null then new.invoiced_at := now(); end if;
  if new.status = 'entregue' and new.delivered_at is null then new.delivered_at := now(); end if;
  if new.status = 'cancelado' and new.canceled_at is null then new.canceled_at := now(); end if;
  if new.status <> 'cancelado' then new.canceled_at := null; end if;
  if new.status in ('orcamento', 'pedido_realizado') then new.invoiced_at := null; end if;
  return new;
end $$;

create trigger order_before
  before insert or update on public.orders
  for each row execute function public.tg_order_before();

-- Faturamento -> venda (faturamento) + cliente vira "cliente"
create or replace function public.tg_order_after()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_sale public.sales;
  v_billed boolean := new.status in ('faturado', 'em_entrega', 'entregue') and new.deleted_at is null;
begin
  if tg_op = 'INSERT' then
    insert into public.activities
      (organization_id, type, company_id, contact_id, opportunity_id, order_id, owner_id,
       occurred_at, description, is_demo, created_by)
    values
      (new.organization_id, 'pedido', new.company_id, new.contact_id, new.opportunity_id, new.id, new.owner_id,
       now(),
       case when new.status = 'orcamento' then 'Orçamento #' else 'Pedido #' end || new.order_number || ' registrado',
       new.is_demo, coalesce(auth.uid(), new.owner_id));
  end if;

  select * into v_sale from public.sales where order_id = new.id;

  if v_billed then
    if v_sale.id is null then
      insert into public.sales
        (organization_id, order_id, company_id, seller_id, invoice_number, invoiced_at, amount, is_demo)
      values
        (new.organization_id, new.id, new.company_id, new.owner_id, new.invoice_number,
         new.invoiced_at, new.total, new.is_demo)
      returning * into v_sale;

      insert into public.notifications (organization_id, user_id, title, body, link)
      values (new.organization_id, new.owner_id,
              'Pedido #' || new.order_number || ' faturado',
              'Valor faturado: R$ ' || to_char(new.total, 'FM999G999G990D00'),
              '/pedidos/' || new.id);
    else
      update public.sales
         set status = 'ativa', canceled_at = null, amount = new.total,
             invoice_number = new.invoice_number, invoiced_at = new.invoiced_at,
             seller_id = new.owner_id, company_id = new.company_id
       where id = v_sale.id;
    end if;

    perform public.promote_company_status(new.company_id, 'cliente');

    if new.opportunity_id is not null then
      update public.opportunities
         set stage_key = (select key from public.pipeline_stages where is_won and active order by position limit 1)
       where id = new.opportunity_id
         and stage_key not in (select key from public.pipeline_stages where is_won or is_lost);
    end if;
  elsif v_sale.id is not null and v_sale.status = 'ativa' then
    -- Pedido cancelado / voltou para pré-faturamento: estorna o faturamento
    update public.sales set status = 'cancelada', canceled_at = now() where id = v_sale.id;
  end if;
  return null;
end $$;

create trigger order_after
  after insert or update on public.orders
  for each row execute function public.tg_order_after();

-- ---------------------------------------------------------------------
-- Auditoria genérica
-- ---------------------------------------------------------------------
create or replace function public.tg_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_changed text[];
  v_action text;
  v_record uuid;
  v_company uuid;
  v_label text;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_action := 'insert';
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    select array_agg(n.key order by n.key) into v_changed
      from jsonb_each(v_new) n
     where n.key not in ('updated_at', 'updated_by', 'last_contact_at', 'last_visit_at',
                         'last_activity_at', 'subtotal', 'total')
       and (v_old -> n.key) is distinct from n.value;
    if v_changed is null then
      return null;
    end if;
    v_action := case
      when 'deleted_at' = any (v_changed) and new is not null and (v_new ->> 'deleted_at') is not null then 'archive'
      when tg_table_name = 'opportunities' and 'stage_key' = any (v_changed) then 'stage_change'
      when 'status' = any (v_changed) then 'status_change'
      when 'owner_id' = any (v_changed) then 'owner_change'
      when tg_table_name = 'opportunities' and 'estimated_value' = any (v_changed) then 'value_change'
      else 'update' end;
  else
    v_old := to_jsonb(old);
    v_action := 'delete';
  end if;

  v_record := coalesce(v_new ->> 'id', v_old ->> 'id')::uuid;
  if tg_table_name = 'companies' then
    v_company := v_record;
  else
    v_company := nullif(coalesce(v_new ->> 'company_id', v_old ->> 'company_id'), '')::uuid;
  end if;
  if v_company is not null then
    select coalesce(c.trade_name, c.legal_name) into v_label from public.companies c where c.id = v_company;
  end if;

  insert into public.audit_logs
    (organization_id, table_name, record_id, action, actor_id, company_id, company_label,
     changed_fields, old_data, new_data)
  values
    (coalesce(v_new ->> 'organization_id', v_old ->> 'organization_id',
              case when tg_table_name = 'organizations' then v_record::text end)::uuid,
     tg_table_name, v_record, v_action, auth.uid(), v_company, v_label,
     v_changed, v_old, v_new);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['companies', 'contacts', 'products', 'opportunities', 'visits', 'orders',
                           'sales', 'profiles', 'organizations', 'tasks'] loop
    execute format('create trigger audit after insert or update or delete on public.%I
                    for each row execute function public.tg_audit()', t);
  end loop;
end $$;
