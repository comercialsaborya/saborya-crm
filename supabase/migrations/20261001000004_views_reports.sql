-- =====================================================================
-- Saborya CRM — 0004 · Views de listagem e funções de relatório
--
-- As views abaixo aplicam o escopo explicitamente (organização +
-- gestor/responsável) no registro principal, via public.row_visible().
-- Isso permite exibir nomes de clientes/vendedores relacionados mesmo que
-- o cliente tenha sido transferido para outro vendedor, sem expor
-- registros de outros vendedores.
--
-- As funções de relatório são SECURITY DEFINER e aplicam o mesmo escopo:
-- vendedor sempre enxerga apenas os próprios números; gestor pode filtrar
-- por vendedor ou ver todos.
-- =====================================================================

create or replace function public.org_tz()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select o.timezone from public.organizations o where o.id = public.current_org_id()),
    'America/Sao_Paulo');
$$;

create or replace function public.row_visible(p_org uuid, p_owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_org = public.current_org_id()
     and (public.is_admin() or p_owner = auth.uid());
$$;

-- Escopo de vendedor para relatórios: gestor filtra (ou vê todos); vendedor só a si.
create or replace function public.seller_filter(p_requested uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select case when public.is_admin() then p_requested else auth.uid() end;
$$;

-- ---------------------------------------------------------------------
-- Views de listagem
-- ---------------------------------------------------------------------
create or replace view public.company_overview as
select
  c.*,
  coalesce(c.trade_name, c.legal_name) as display_name,
  p.full_name as owner_name,
  coalesce(s.revenue, 0)::numeric(14,2) as revenue_total,
  coalesce(v.volume, 0)::numeric(14,2) as volume_total,
  coalesce(s.orders_count, 0) as invoiced_orders,
  s.last_purchase_at,
  coalesce(op.open_count, 0) as open_opportunities,
  coalesce(op.open_value, 0)::numeric(14,2) as open_value,
  t.next_task_date,
  coalesce(t.next_task_date, c.next_contact_date) as next_action_date,
  ((now() at time zone public.org_tz())::date
    - (coalesce(c.last_contact_at, c.created_at) at time zone public.org_tz())::date) as days_without_contact
from public.companies c
left join public.profiles p on p.id = c.owner_id
left join lateral (
  select sum(sa.amount) as revenue, count(*) as orders_count, max(sa.invoiced_at) as last_purchase_at
  from public.sales sa where sa.company_id = c.id and sa.status = 'ativa'
) s on true
left join lateral (
  select sum(oi.quantity) as volume
  from public.sales sa join public.order_items oi on oi.order_id = sa.order_id
  where sa.company_id = c.id and sa.status = 'ativa'
) v on true
left join lateral (
  select count(*) as open_count, sum(o.estimated_value) as open_value
  from public.opportunities o join public.pipeline_stages ps on ps.key = o.stage_key
  where o.company_id = c.id and o.deleted_at is null and not ps.is_won and not ps.is_lost
) op on true
left join lateral (
  select min(tk.due_date) as next_task_date
  from public.tasks tk
  where tk.company_id = c.id and tk.status = 'pendente' and tk.deleted_at is null
) t on true
where public.row_visible(c.organization_id, c.owner_id);

create or replace view public.contact_list as
select
  ct.*,
  coalesce(c.trade_name, c.legal_name) as company_name,
  c.owner_id,
  c.city,
  c.state
from public.contacts ct
join public.companies c on c.id = ct.company_id
where public.row_visible(c.organization_id, c.owner_id);

create or replace view public.opportunity_board as
select
  o.*,
  coalesce(c.trade_name, c.legal_name) as company_name,
  c.city,
  c.state,
  ct.name as contact_name,
  ct.whatsapp as contact_whatsapp,
  ct.phone as contact_phone,
  p.full_name as owner_name,
  ps.name as stage_name,
  ps.position as stage_position,
  ps.is_won,
  ps.is_lost,
  ((now() at time zone public.org_tz())::date
    - (coalesce(o.last_activity_at, o.created_at) at time zone public.org_tz())::date) as days_without_contact,
  ((now() at time zone public.org_tz())::date
    - (o.stage_entered_at at time zone public.org_tz())::date) as days_in_stage,
  nt.due_date as next_task_date,
  nt.title as next_task_title
from public.opportunities o
join public.pipeline_stages ps on ps.key = o.stage_key
left join public.companies c on c.id = o.company_id
left join public.contacts ct on ct.id = o.contact_id
left join public.profiles p on p.id = o.owner_id
left join lateral (
  select tk.due_date, tk.title from public.tasks tk
  where tk.opportunity_id = o.id and tk.status = 'pendente' and tk.deleted_at is null
  order by tk.due_date limit 1
) nt on true
where public.row_visible(o.organization_id, o.owner_id);

create or replace view public.visit_list as
select
  v.*,
  coalesce(c.trade_name, c.legal_name) as company_name,
  c.city,
  c.state,
  ct.name as contact_name,
  p.full_name as owner_name,
  coalesce((
    select array_agg(pr.name order by pr.name)
    from public.visit_products vp join public.products pr on pr.id = vp.product_id
    where vp.visit_id = v.id
  ), '{}') as product_names
from public.visits v
left join public.companies c on c.id = v.company_id
left join public.contacts ct on ct.id = v.contact_id
left join public.profiles p on p.id = v.owner_id
where public.row_visible(v.organization_id, v.owner_id);

create or replace view public.activity_list as
select
  a.*,
  coalesce(c.trade_name, c.legal_name) as company_name,
  ct.name as contact_name,
  p.full_name as owner_name
from public.activities a
left join public.companies c on c.id = a.company_id
left join public.contacts ct on ct.id = a.contact_id
left join public.profiles p on p.id = a.owner_id
where public.row_visible(a.organization_id, a.owner_id);

create or replace view public.task_list as
select
  t.*,
  coalesce(c.trade_name, c.legal_name) as company_name,
  ct.name as contact_name,
  ct.whatsapp as contact_whatsapp,
  ct.phone as contact_phone,
  o.title as opportunity_title,
  p.full_name as owner_name
from public.tasks t
left join public.companies c on c.id = t.company_id
left join public.contacts ct on ct.id = t.contact_id
left join public.opportunities o on o.id = t.opportunity_id
left join public.profiles p on p.id = t.owner_id
where public.row_visible(t.organization_id, t.owner_id);

create or replace view public.order_list as
select
  o.*,
  coalesce(c.trade_name, c.legal_name) as company_name,
  c.city,
  c.state,
  ct.name as contact_name,
  p.full_name as owner_name,
  coalesce(i.total_quantity, 0)::numeric(14,2) as total_quantity,
  coalesce(i.item_count, 0) as item_count,
  coalesce(i.product_ids, '{}') as product_ids,
  coalesce(i.product_names, '{}') as product_names
from public.orders o
left join public.companies c on c.id = o.company_id
left join public.contacts ct on ct.id = o.contact_id
left join public.profiles p on p.id = o.owner_id
left join lateral (
  select sum(oi.quantity) as total_quantity, count(*) as item_count,
         array_agg(distinct oi.product_id) as product_ids,
         array_agg(distinct pr.name) as product_names
  from public.order_items oi join public.products pr on pr.id = oi.product_id
  where oi.order_id = o.id
) i on true
where public.row_visible(o.organization_id, o.owner_id);

create or replace view public.invoiced_sales as
select
  s.*,
  o.order_number,
  o.order_date,
  o.status as order_status,
  o.subtotal as order_subtotal,
  o.discount as order_discount,
  coalesce(c.trade_name, c.legal_name) as company_name,
  c.city,
  c.state,
  p.full_name as seller_name,
  coalesce(i.total_quantity, 0)::numeric(14,2) as total_quantity,
  coalesce(i.product_ids, '{}') as product_ids,
  coalesce(i.categories, '{}') as categories,
  coalesce(i.product_summary, '') as product_summary
from public.sales s
join public.orders o on o.id = s.order_id
left join public.companies c on c.id = s.company_id
left join public.profiles p on p.id = s.seller_id
left join lateral (
  select sum(oi.quantity) as total_quantity,
         array_agg(distinct oi.product_id) as product_ids,
         array_agg(distinct pr.category) as categories,
         string_agg(pr.name || ' × ' || trim(to_char(oi.quantity, 'FM999G999G990D##')), ', ' order by pr.name) as product_summary
  from public.order_items oi join public.products pr on pr.id = oi.product_id
  where oi.order_id = o.id
) i on true
where public.row_visible(s.organization_id, s.seller_id);

create or replace view public.audit_feed as
select a.*, p.full_name as actor_name
from public.audit_logs a
left join public.profiles p on p.id = a.actor_id
where a.organization_id = public.current_org_id() and public.is_admin();

revoke all on public.company_overview, public.contact_list, public.opportunity_board, public.visit_list,
  public.activity_list, public.task_list, public.order_list, public.invoiced_sales,
  public.audit_feed from anon;

-- ---------------------------------------------------------------------
-- Linhas de venda (base dos relatórios de faturamento e volume)
-- Receita do item já considera o rateio do desconto do pedido.
-- ---------------------------------------------------------------------
create or replace function public.sales_lines(
  p_from date,
  p_to date,
  p_seller uuid default null,
  p_company uuid default null,
  p_product uuid default null,
  p_category public.product_category default null,
  p_city text default null,
  p_state text default null
)
returns table (
  sale_id uuid, invoiced_on date, seller_id uuid, company_id uuid, product_id uuid,
  category public.product_category, city text, state text, quantity numeric, revenue numeric
)
language sql stable security definer set search_path = ''
as $$
  with ctx as (select public.org_tz() as tz, public.seller_filter(p_seller) as seller,
                      public.is_admin() as adm, public.current_org_id() as org)
  select s.id,
         (s.invoiced_at at time zone ctx.tz)::date,
         s.seller_id, s.company_id, i.product_id, pr.category, c.city, c.state, i.quantity,
         round(i.subtotal * case when o.subtotal > 0 then o.total / o.subtotal else 0 end, 2)
  from ctx
  join public.sales s on s.organization_id = ctx.org
  join public.orders o on o.id = s.order_id
  join public.order_items i on i.order_id = o.id
  join public.products pr on pr.id = i.product_id
  left join public.companies c on c.id = s.company_id
  where s.status = 'ativa'
    and (s.invoiced_at at time zone ctx.tz)::date between p_from and p_to
    and (ctx.seller is null and ctx.adm or s.seller_id = ctx.seller)
    and (p_company is null or s.company_id = p_company)
    and (p_product is null or i.product_id = p_product)
    and (p_category is null or pr.category = p_category)
    and (p_city is null or c.city ilike p_city)
    and (p_state is null or c.state = upper(p_state));
$$;

-- Agrupamentos: product | category | client | seller | city | state | month
create or replace function public.sales_breakdown(
  p_group text,
  p_from date,
  p_to date,
  p_seller uuid default null,
  p_company uuid default null,
  p_product uuid default null,
  p_category public.product_category default null,
  p_city text default null,
  p_state text default null
)
returns table (key text, label text, revenue numeric, volume numeric, orders bigint)
language sql stable security definer set search_path = ''
as $$
  with g as (
    select case p_group
             when 'product' then l.product_id::text
             when 'category' then l.category::text
             when 'client' then l.company_id::text
             when 'seller' then l.seller_id::text
             when 'city' then coalesce(l.city, '—') || ' / ' || coalesce(l.state, '—')
             when 'state' then coalesce(l.state, '—')
             when 'month' then to_char(l.invoiced_on, 'YYYY-MM')
           end as key,
           sum(l.revenue) as revenue,
           sum(l.quantity) as volume,
           count(distinct l.sale_id) as orders
    from public.sales_lines(p_from, p_to, p_seller, p_company, p_product, p_category, p_city, p_state) l
    group by 1
  )
  select g.key,
         case p_group
           when 'product' then (select pr.name from public.products pr where pr.id::text = g.key)
           when 'client' then (select coalesce(c.trade_name, c.legal_name) from public.companies c where c.id::text = g.key)
           when 'seller' then (select p.full_name from public.profiles p where p.id::text = g.key)
           else g.key
         end as label,
         g.revenue, g.volume, g.orders
  from g
  order by case when p_group = 'month' then null else g.revenue end desc nulls last, g.key;
$$;

-- Evolução mensal (últimos N meses, inclusive o atual)
create or replace function public.sales_by_month(p_months integer default 12, p_seller uuid default null)
returns table (month date, revenue numeric, volume numeric, orders bigint)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_tz text := public.org_tz();
  v_seller uuid := public.seller_filter(p_seller);
  v_adm boolean := public.is_admin();
  v_end date := date_trunc('month', now() at time zone v_tz)::date;
  v_start date := (v_end - make_interval(months => greatest(p_months, 1) - 1))::date;
begin
  return query
  with months as (
    select generate_series(v_start, v_end, interval '1 month')::date as m
  ),
  agg as (
    select date_trunc('month', l.invoiced_on)::date as m,
           sum(l.revenue) as revenue, sum(l.quantity) as volume, count(distinct l.sale_id) as orders
    from public.sales_lines(v_start, (v_end + interval '1 month - 1 day')::date, p_seller) l
    group by 1
  )
  select months.m, coalesce(agg.revenue, 0), coalesce(agg.volume, 0),
         coalesce(agg.orders, 0)::bigint
  from months
  left join agg on agg.m = months.m
  order by months.m;
end $$;

-- ---------------------------------------------------------------------
-- KPIs do dashboard
-- ---------------------------------------------------------------------
create or replace function public.dashboard_kpis(p_from date, p_to date, p_seller uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_tz text := public.org_tz();
  v_org uuid := public.current_org_id();
  v_adm boolean := public.is_admin();
  v_seller uuid := public.seller_filter(p_seller);
  v_today date := (now() at time zone v_tz)::date;
  v_month_start date := date_trunc('month', v_today)::date;
  v_month_end date := (date_trunc('month', v_today) + interval '1 month - 1 day')::date;
  v_len integer := (p_to - p_from) + 1;
  v_prev_from date := p_from - v_len;
  v_prev_to date := p_from - 1;
  r jsonb;
begin
  if v_org is null then
    return '{}'::jsonb;
  end if;

  with sales_scope as (
    select s.* from public.sales s
    where s.organization_id = v_org and s.status = 'ativa'
      and (v_seller is null and v_adm or s.seller_id = v_seller)
  ),
  period_sales as (
    select * from sales_scope where (invoiced_at at time zone v_tz)::date between p_from and p_to
  ),
  open_opps as (
    select o.* from public.opportunities o join public.pipeline_stages ps on ps.key = o.stage_key
    where o.organization_id = v_org and o.deleted_at is null and not ps.is_won and not ps.is_lost
      and (v_seller is null and v_adm or o.owner_id = v_seller)
  )
  select jsonb_build_object(
    'revenue_period', coalesce((select sum(amount) from period_sales), 0),
    'revenue_previous_period', coalesce((select sum(amount) from sales_scope
        where (invoiced_at at time zone v_tz)::date between v_prev_from and v_prev_to), 0),
    'revenue_month', coalesce((select sum(amount) from sales_scope
        where (invoiced_at at time zone v_tz)::date between v_month_start and v_month_end), 0),
    'invoiced_orders', (select count(*) from period_sales),
    'avg_ticket', coalesce((select avg(amount) from period_sales), 0),
    'volume_period', coalesce((select sum(oi.quantity) from period_sales ps2
        join public.order_items oi on oi.order_id = ps2.order_id), 0),
    'orders_period', (select count(*) from public.orders o
        where o.organization_id = v_org and o.deleted_at is null
          and o.status not in ('orcamento', 'cancelado')
          and o.order_date between p_from and p_to
          and (v_seller is null and v_adm or o.owner_id = v_seller)),
    'active_clients', (select count(distinct company_id) from sales_scope
        where invoiced_at >= now() - interval '90 days'),
    'new_clients', (select count(*) from public.companies c
        where c.organization_id = v_org and c.deleted_at is null
          and (c.created_at at time zone v_tz)::date between p_from and p_to
          and (v_seller is null and v_adm or c.owner_id = v_seller)),
    'total_clients', (select count(*) from public.companies c
        where c.organization_id = v_org and c.deleted_at is null and c.status = 'cliente'
          and (v_seller is null and v_adm or c.owner_id = v_seller)),
    'open_opportunities', (select count(*) from open_opps),
    'open_value', coalesce((select sum(estimated_value) from open_opps), 0),
    'hot_opportunities', (select count(*) from open_opps where temperature = 'quente'),
    'visits_period', (select count(*) from public.visits v
        where v.organization_id = v_org and v.deleted_at is null
          and (v.visited_at at time zone v_tz)::date between p_from and p_to
          and (v_seller is null and v_adm or v.owner_id = v_seller)),
    'visits_month', (select count(*) from public.visits v
        where v.organization_id = v_org and v.deleted_at is null
          and (v.visited_at at time zone v_tz)::date between v_month_start and v_month_end
          and (v_seller is null and v_adm or v.owner_id = v_seller)),
    'overdue_tasks', (select count(*) from public.tasks t
        where t.organization_id = v_org and t.deleted_at is null and t.status = 'pendente'
          and t.due_date < v_today
          and (v_seller is null and v_adm or t.owner_id = v_seller)),
    'today_tasks', (select count(*) from public.tasks t
        where t.organization_id = v_org and t.deleted_at is null and t.status = 'pendente'
          and t.due_date = v_today
          and (v_seller is null and v_adm or t.owner_id = v_seller))
  ) into r;
  return r;
end $$;

-- ---------------------------------------------------------------------
-- Funil comercial: etapas abertas (posição atual) + ganhos/perdidos no período
-- ---------------------------------------------------------------------
create or replace function public.funnel_summary(p_from date, p_to date, p_seller uuid default null)
returns table (stage_key text, name text, stage_position integer, color text, is_won boolean, is_lost boolean,
               opportunities bigint, value numeric)
language sql stable security definer set search_path = ''
as $$
  with ctx as (select public.org_tz() as tz, public.seller_filter(p_seller) as seller,
                      public.is_admin() as adm, public.current_org_id() as org)
  select ps.key, ps.name, ps.position, ps.color, ps.is_won, ps.is_lost,
         count(o.id), coalesce(sum(o.estimated_value), 0)
  from ctx
  cross join public.pipeline_stages ps
  left join public.opportunities o
    on o.stage_key = ps.key
   and o.organization_id = ctx.org
   and o.deleted_at is null
   and (ctx.seller is null and ctx.adm or o.owner_id = ctx.seller)
   and (not (ps.is_won or ps.is_lost)
        or (o.closed_at at time zone ctx.tz)::date between p_from and p_to)
  where ps.active
  group by ps.key, ps.name, ps.position, ps.color, ps.is_won, ps.is_lost
  order by ps.position;
$$;

-- ---------------------------------------------------------------------
-- Saúde do funil
-- ---------------------------------------------------------------------
create or replace function public.funnel_health(p_from date, p_to date, p_seller uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_tz text := public.org_tz();
  v_org uuid := public.current_org_id();
  v_adm boolean := public.is_admin();
  v_seller uuid := public.seller_filter(p_seller);
  v_stalled_days integer;
  r jsonb;
begin
  select stalled_opportunity_days into v_stalled_days from public.organizations where id = v_org;

  with scope as (
    select o.*, ps.is_won, ps.is_lost, ps.name as stage_name
    from public.opportunities o join public.pipeline_stages ps on ps.key = o.stage_key
    where o.organization_id = v_org and o.deleted_at is null
      and (v_seller is null and v_adm or o.owner_id = v_seller)
  ),
  open_o as (select * from scope where not is_won and not is_lost),
  closed_o as (
    select * from scope where (is_won or is_lost)
      and (closed_at at time zone v_tz)::date between p_from and p_to
  ),
  durations as (
    select h.from_stage, avg(h.seconds_in_previous_stage) / 86400.0 as avg_days, count(*) as n
    from public.opportunity_stage_history h
    join scope s on s.id = h.opportunity_id
    where h.from_stage is not null and h.seconds_in_previous_stage is not null
      and h.changed_at >= now() - interval '12 months'
    group by h.from_stage
  )
  select jsonb_build_object(
    'total_open', (select count(*) from open_o),
    'potential_value', coalesce((select sum(estimated_value) from open_o), 0),
    'negotiation_value', coalesce((select sum(estimated_value) from open_o
        where stage_key in ('negociacao', 'pedido')), 0),
    'hot_value', coalesce((select sum(estimated_value) from open_o where temperature = 'quente'), 0),
    'won_count', (select count(*) from closed_o where is_won),
    'won_value', coalesce((select sum(estimated_value) from closed_o where is_won), 0),
    'lost_count', (select count(*) from closed_o where is_lost),
    'lost_value', coalesce((select sum(estimated_value) from closed_o where is_lost), 0),
    'conversion_rate', case when (select count(*) from closed_o) > 0
        then round((select count(*) from closed_o where is_won)::numeric * 100 / (select count(*) from closed_o), 1)
        else null end,
    'stalled_count', (select count(*) from open_o
        where stage_entered_at < now() - make_interval(days => v_stalled_days)
          and coalesce(last_activity_at, created_at) < now() - make_interval(days => v_stalled_days)),
    'stalled_value', coalesce((select sum(estimated_value) from open_o
        where stage_entered_at < now() - make_interval(days => v_stalled_days)
          and coalesce(last_activity_at, created_at) < now() - make_interval(days => v_stalled_days)), 0),
    'without_next_action', (select count(*) from open_o o
        where o.next_activity_date is null
          and not exists (select 1 from public.tasks t where t.opportunity_id = o.id
                          and t.status = 'pendente' and t.deleted_at is null)),
    'stalled_days', v_stalled_days,
    'avg_days_by_stage', coalesce((select jsonb_object_agg(from_stage, round(avg_days::numeric, 1)) from durations), '{}'::jsonb),
    'avg_cycle_days', (select round(avg(extract(epoch from closed_at - created_at) / 86400.0)::numeric, 1)
        from closed_o where is_won)
  ) into r;
  return r;
end $$;

-- ---------------------------------------------------------------------
-- Alertas
-- ---------------------------------------------------------------------
create or replace function public.get_alerts(p_seller uuid default null)
returns table (kind text, severity text, message text, href text, ref_id uuid, total bigint)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_tz text := public.org_tz();
  v_org uuid := public.current_org_id();
  v_adm boolean := public.is_admin();
  v_seller uuid := public.seller_filter(p_seller);
  v_today date := (now() at time zone v_tz)::date;
  o public.organizations;
  n bigint;
begin
  select * into o from public.organizations where id = v_org;
  if o.id is null then return; end if;

  -- 1) Clientes sem contato
  select count(*) into n from public.companies c
   where c.organization_id = v_org and c.deleted_at is null and c.status <> 'perdido'
     and coalesce(c.last_contact_at, c.created_at) < now() - make_interval(days => o.inactivity_days)
     and (v_seller is null and v_adm or c.owner_id = v_seller);
  if n > 0 then
    kind := 'clients_no_contact'; severity := 'media';
    message := n || case when n = 1 then ' cliente está' else ' clientes estão' end
               || ' há mais de ' || o.inactivity_days || ' dias sem contato.';
    href := '/clientes?sem_contato=1'; ref_id := null; total := n;
    return next;
  end if;

  -- 2) Oportunidades quentes sem próxima atividade
  select count(*) into n from public.opportunities op
    join public.pipeline_stages ps on ps.key = op.stage_key
   where op.organization_id = v_org and op.deleted_at is null and not ps.is_won and not ps.is_lost
     and op.temperature = 'quente' and op.next_activity_date is null
     and not exists (select 1 from public.tasks t where t.opportunity_id = op.id
                     and t.status = 'pendente' and t.deleted_at is null)
     and (v_seller is null and v_adm or op.owner_id = v_seller);
  if n > 0 then
    kind := 'hot_without_next'; severity := 'alta';
    message := n || case when n = 1 then ' oportunidade quente não possui' else ' oportunidades quentes não possuem' end
               || ' próxima atividade.';
    href := '/pipeline?temperatura=quente'; ref_id := null; total := n;
    return next;
  end if;

  -- 3) Tarefas atrasadas
  select count(*) into n from public.tasks t
   where t.organization_id = v_org and t.deleted_at is null and t.status = 'pendente'
     and t.due_date < v_today
     and (v_seller is null and v_adm or t.owner_id = v_seller);
  if n > 0 then
    kind := 'overdue_tasks'; severity := 'alta';
    message := n || case when n = 1 then ' tarefa está atrasada.' else ' tarefas estão atrasadas.' end;
    href := '/tarefas'; ref_id := null; total := n;
    return next;
  end if;

  -- 4) Clientes sem recompra
  return query
  select 'repurchase'::text, 'media'::text,
         'Cliente ' || coalesce(c.trade_name, c.legal_name) || ' comprou há '
           || (v_today - (ls.last_at at time zone v_tz)::date) || ' dias e não possui novo pedido.',
         '/clientes/' || c.id, c.id, 1::bigint
  from public.companies c
  join lateral (
    select max(s.invoiced_at) as last_at from public.sales s
    where s.company_id = c.id and s.status = 'ativa'
  ) ls on ls.last_at is not null
  where c.organization_id = v_org and c.deleted_at is null
    and (v_seller is null and v_adm or c.owner_id = v_seller)
    and ls.last_at < now() - make_interval(days => o.repurchase_alert_days)
    and not exists (
      select 1 from public.orders od where od.company_id = c.id and od.deleted_at is null
        and od.status in ('orcamento', 'pedido_realizado') )
  order by ls.last_at
  limit 5;

  -- 5) Oportunidades paradas
  return query
  select 'stalled_opportunity'::text, 'media'::text,
         'Oportunidade "' || op.title || '" (' || coalesce(c.trade_name, c.legal_name, '—') || ') está parada há '
           || (v_today - (greatest(op.stage_entered_at, coalesce(op.last_activity_at, op.created_at)) at time zone v_tz)::date)
           || ' dias.',
         '/pipeline?op=' || op.id, op.id, 1::bigint
  from public.opportunities op
  join public.pipeline_stages ps on ps.key = op.stage_key
  left join public.companies c on c.id = op.company_id
  where op.organization_id = v_org and op.deleted_at is null and not ps.is_won and not ps.is_lost
    and op.stage_entered_at < now() - make_interval(days => o.stalled_opportunity_days)
    and coalesce(op.last_activity_at, op.created_at) < now() - make_interval(days => o.stalled_opportunity_days)
    and (v_seller is null and v_adm or op.owner_id = v_seller)
  order by greatest(op.stage_entered_at, coalesce(op.last_activity_at, op.created_at))
  limit 5;
end $$;

-- ---------------------------------------------------------------------
-- Desempenho por vendedor (gestor vê todos; vendedor só a si)
-- ---------------------------------------------------------------------
create or replace function public.seller_performance(p_from date, p_to date)
returns table (
  seller_id uuid, seller_name text, active boolean, revenue numeric, previous_revenue numeric,
  growth_percent numeric, orders bigint, avg_ticket numeric, volume numeric, visits bigint, new_clients bigint, active_clients bigint,
  open_opportunities bigint, open_value numeric, won bigint, lost bigint, conversion_rate numeric
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_tz text := public.org_tz();
  v_org uuid := public.current_org_id();
  v_adm boolean := public.is_admin();
  v_len integer := (p_to - p_from) + 1;
begin
  return query
  with sellers as (
    select p.id, p.full_name, p.active from public.profiles p
    where p.organization_id = v_org
      and (v_adm and (p.role = 'vendedor' or exists (select 1 from public.sales s where s.seller_id = p.id))
           or p.id = auth.uid())
  ),
  s_cur as (
    select s.seller_id, sum(s.amount) as revenue, count(*) as orders,
           count(distinct s.company_id) as clients
    from public.sales s
    where s.organization_id = v_org and s.status = 'ativa'
      and (s.invoiced_at at time zone v_tz)::date between p_from and p_to
    group by s.seller_id
  ),
  s_prev as (
    select s.seller_id, sum(s.amount) as revenue
    from public.sales s
    where s.organization_id = v_org and s.status = 'ativa'
      and (s.invoiced_at at time zone v_tz)::date between p_from - v_len and p_from - 1
    group by s.seller_id
  ),
  vol as (
    select s.seller_id, sum(oi.quantity) as volume
    from public.sales s join public.order_items oi on oi.order_id = s.order_id
    where s.organization_id = v_org and s.status = 'ativa'
      and (s.invoiced_at at time zone v_tz)::date between p_from and p_to
    group by s.seller_id
  ),
  vis as (
    select v.owner_id, count(*) as n from public.visits v
    where v.organization_id = v_org and v.deleted_at is null
      and (v.visited_at at time zone v_tz)::date between p_from and p_to
    group by v.owner_id
  ),
  newc as (
    select c.owner_id, count(*) as n from public.companies c
    where c.organization_id = v_org and c.deleted_at is null
      and (c.created_at at time zone v_tz)::date between p_from and p_to
    group by c.owner_id
  ),
  actc as (
    select s.seller_id, count(distinct s.company_id) as n from public.sales s
    where s.organization_id = v_org and s.status = 'ativa' and s.invoiced_at >= now() - interval '90 days'
    group by s.seller_id
  ),
  opp as (
    select o.owner_id,
           count(*) filter (where not ps.is_won and not ps.is_lost) as open_n,
           sum(o.estimated_value) filter (where not ps.is_won and not ps.is_lost) as open_v,
           count(*) filter (where ps.is_won and (o.closed_at at time zone v_tz)::date between p_from and p_to) as won,
           count(*) filter (where ps.is_lost and (o.closed_at at time zone v_tz)::date between p_from and p_to) as lost
    from public.opportunities o join public.pipeline_stages ps on ps.key = o.stage_key
    where o.organization_id = v_org and o.deleted_at is null
    group by o.owner_id
  )
  select sl.id, sl.full_name, sl.active,
         coalesce(s_cur.revenue, 0), coalesce(s_prev.revenue, 0),
         case when coalesce(s_prev.revenue, 0) > 0
              then round((coalesce(s_cur.revenue, 0) - s_prev.revenue) * 100 / s_prev.revenue, 1) end,
         coalesce(s_cur.orders, 0)::bigint,
         case when coalesce(s_cur.orders, 0) > 0 then round(s_cur.revenue / s_cur.orders, 2) else 0 end,
         coalesce(vol.volume, 0),
         coalesce(vis.n, 0)::bigint, coalesce(newc.n, 0)::bigint, coalesce(actc.n, 0)::bigint,
         coalesce(opp.open_n, 0)::bigint, coalesce(opp.open_v, 0),
         coalesce(opp.won, 0)::bigint, coalesce(opp.lost, 0)::bigint,
         case when coalesce(opp.won, 0) + coalesce(opp.lost, 0) > 0
              then round(opp.won::numeric * 100 / (opp.won + opp.lost), 1) end
  from sellers sl
  left join s_cur on s_cur.seller_id = sl.id
  left join s_prev on s_prev.seller_id = sl.id
  left join vol on vol.seller_id = sl.id
  left join vis on vis.owner_id = sl.id
  left join newc on newc.owner_id = sl.id
  left join actc on actc.seller_id = sl.id
  left join opp on opp.owner_id = sl.id
  order by sl.active desc, sl.full_name;
end $$;

-- ---------------------------------------------------------------------
-- Busca global
-- ---------------------------------------------------------------------
create or replace function public.global_search(p_query text, p_limit integer default 8)
returns table (kind text, id uuid, title text, subtitle text, href text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_org uuid := public.current_org_id();
  v_adm boolean := public.is_admin();
  v_uid uuid := auth.uid();
  q text := '%' || regexp_replace(trim(coalesce(p_query, '')), '([%_\\])', '\\\1', 'g') || '%';
  digits text := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');
  num bigint;
begin
  if length(trim(coalesce(p_query, ''))) < 2 or v_org is null then
    return;
  end if;
  if digits ~ '^[0-9]{1,12}$' and digits = trim(p_query) then
    num := digits::bigint;
  end if;

  return query
  (select 'cliente'::text, c.id, coalesce(c.trade_name, c.legal_name),
          concat_ws(' · ', nullif(c.legal_name, coalesce(c.trade_name, c.legal_name)), c.city || coalesce('/' || c.state, ''),
                    case when c.cnpj is not null then 'CNPJ ' || c.cnpj end),
          '/clientes/' || c.id
     from public.companies c
    where c.organization_id = v_org and c.deleted_at is null and (v_adm or c.owner_id = v_uid)
      and (c.legal_name ilike q or c.trade_name ilike q
           or (length(digits) >= 3 and (c.cnpj like '%' || digits || '%'
                or regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') like '%' || digits || '%')))
    order by coalesce(c.trade_name, c.legal_name) limit p_limit)
  union all
  (select 'comprador'::text, ct.id, ct.name,
          concat_ws(' · ', ct.job_title, coalesce(c.trade_name, c.legal_name)),
          '/clientes/' || c.id || '#contatos'
     from public.contacts ct join public.companies c on c.id = ct.company_id
    where c.organization_id = v_org and ct.deleted_at is null and (v_adm or c.owner_id = v_uid)
      and (ct.name ilike q or ct.email ilike q
           or (length(digits) >= 3 and (regexp_replace(coalesce(ct.phone, ''), '\D', '', 'g') like '%' || digits || '%'
                or regexp_replace(coalesce(ct.whatsapp, ''), '\D', '', 'g') like '%' || digits || '%')))
    order by ct.name limit p_limit)
  union all
  (select 'pedido'::text, o.id, 'Pedido #' || o.order_number,
          concat_ws(' · ', coalesce(c.trade_name, c.legal_name), o.invoice_number),
          '/pedidos/' || o.id
     from public.orders o left join public.companies c on c.id = o.company_id
    where o.organization_id = v_org and o.deleted_at is null and (v_adm or o.owner_id = v_uid)
      and (o.order_number = num or o.invoice_number ilike q)
    limit p_limit)
  union all
  (select 'produto'::text, p.id, p.name, concat_ws(' · ', 'SKU ' || p.sku, p.category::text), '/produtos?q=' || p.sku
     from public.products p
    where p.organization_id = v_org and (p.name ilike q or p.sku ilike q)
    order by p.name limit p_limit)
  union all
  (select 'vendedor'::text, p.id, p.full_name, p.email, '/desempenho?vendedor=' || p.id
     from public.profiles p
    where v_adm and p.organization_id = v_org and (p.full_name ilike q or p.email ilike q)
    order by p.full_name limit p_limit);
end $$;

-- Funções de relatório: apenas usuários autenticados.
do $$
declare f text;
begin
  foreach f in array array['sales_lines', 'sales_breakdown', 'sales_by_month', 'dashboard_kpis',
                           'funnel_summary', 'funnel_health', 'get_alerts', 'seller_performance',
                           'global_search'] loop
    execute format('revoke execute on function public.%I from public, anon', f);
    execute format('grant execute on function public.%I to authenticated, service_role', f);
  end loop;
end $$;
