-- =====================================================================
-- Saborya CRM — 0003 · Segurança (Row Level Security)
--
-- Regra geral:
--   * Todos os dados são isolados por organização.
--   * ADMIN vê e edita tudo da organização.
--   * VENDEDOR vê e edita apenas os registros em que é o responsável
--     (owner_id / seller_id) e os contatos dos seus clientes.
--   * Nada é apagado fisicamente pelo app (soft delete via deleted_at /
--     status). Por isso não há políticas de DELETE, exceto itens de pedido
--     ainda editáveis e produtos apresentados em visita.
-- =====================================================================

create or replace function public.can_access_company(p_company uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.companies c
    where c.id = p_company
      and c.organization_id = public.current_org_id()
      and (public.is_admin() or c.owner_id = auth.uid())
  );
$$;

create or replace function public.can_access_order(p_order uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order
      and o.organization_id = public.current_org_id()
      and (public.is_admin() or o.owner_id = auth.uid())
  );
$$;

create or replace function public.can_access_visit(p_visit uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.visits v
    where v.id = p_visit
      and v.organization_id = public.current_org_id()
      and (public.is_admin() or v.owner_id = auth.uid())
  );
$$;

create or replace function public.can_access_opportunity(p_opp uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.opportunities o
    where o.id = p_opp
      and o.organization_id = public.current_org_id()
      and (public.is_admin() or o.owner_id = auth.uid())
  );
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_status_history enable row level security;
alter table public.contacts enable row level security;
alter table public.products enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_stage_history enable row level security;
alter table public.visits enable row level security;
alter table public.visit_products enable row level security;
alter table public.activities enable row level security;
alter table public.tasks enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.sales enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- Organizações -----------------------------------------------------------
create policy org_select on public.organizations for select to authenticated
  using (id = (select public.current_org_id()));
create policy org_update on public.organizations for update to authenticated
  using (id = (select public.current_org_id()) and (select public.is_admin()))
  with check (id = (select public.current_org_id()) and (select public.is_admin()));

-- Perfis -----------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (organization_id = (select public.current_org_id()) and (select public.is_admin()))
  );
create policy profiles_update on public.profiles for update to authenticated
  using (
    id = (select auth.uid())
    or (organization_id = (select public.current_org_id()) and (select public.is_admin()))
  )
  with check (organization_id = (select public.current_org_id()));

-- Clientes ---------------------------------------------------------------
create policy companies_select on public.companies for select to authenticated
  using (
    organization_id = (select public.current_org_id())
    and ((select public.is_admin()) or owner_id = (select auth.uid()))
  );
create policy companies_insert on public.companies for insert to authenticated
  with check (
    organization_id = (select public.current_org_id())
    and (select public.is_active_user())
    and ((select public.is_admin()) or owner_id = (select auth.uid()))
  );
create policy companies_update on public.companies for update to authenticated
  using (
    organization_id = (select public.current_org_id())
    and ((select public.is_admin()) or owner_id = (select auth.uid()))
  )
  with check (
    organization_id = (select public.current_org_id())
    and ((select public.is_admin()) or owner_id = (select auth.uid()))
  );

create policy company_status_history_select on public.company_status_history for select to authenticated
  using (public.can_access_company(company_id));

-- Contatos ---------------------------------------------------------------
create policy contacts_select on public.contacts for select to authenticated
  using (public.can_access_company(company_id));
create policy contacts_insert on public.contacts for insert to authenticated
  with check (
    organization_id = (select public.current_org_id())
    and (select public.is_active_user())
    and public.can_access_company(company_id)
  );
create policy contacts_update on public.contacts for update to authenticated
  using (public.can_access_company(company_id))
  with check (public.can_access_company(company_id));

-- Produtos e etapas (catálogo) -------------------------------------------
create policy products_select on public.products for select to authenticated
  using (organization_id = (select public.current_org_id()));
create policy products_insert on public.products for insert to authenticated
  with check (organization_id = (select public.current_org_id()) and (select public.is_admin()));
create policy products_update on public.products for update to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.is_admin()))
  with check (organization_id = (select public.current_org_id()) and (select public.is_admin()));

create policy stages_select on public.pipeline_stages for select to authenticated using (true);
create policy stages_write on public.pipeline_stages for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Registros com responsável (owner_id) -----------------------------------
do $$
declare t text;
begin
  foreach t in array array['opportunities', 'visits', 'activities', 'tasks', 'orders'] loop
    execute format($f$
      create policy %1$s_select on public.%1$I for select to authenticated
        using (
          organization_id = (select public.current_org_id())
          and ((select public.is_admin()) or owner_id = (select auth.uid()))
        );
      create policy %1$s_insert on public.%1$I for insert to authenticated
        with check (
          organization_id = (select public.current_org_id())
          and (select public.is_active_user())
          and ((select public.is_admin()) or owner_id = (select auth.uid()))
        );
      create policy %1$s_update on public.%1$I for update to authenticated
        using (
          organization_id = (select public.current_org_id())
          and ((select public.is_admin()) or owner_id = (select auth.uid()))
        )
        with check (
          organization_id = (select public.current_org_id())
          and ((select public.is_admin()) or owner_id = (select auth.uid()))
        );
    $f$, t);
  end loop;
end $$;

-- O cliente vinculado também precisa ser acessível ao vendedor.
create policy opportunities_company_check on public.opportunities as restrictive for insert to authenticated
  with check (public.can_access_company(company_id));
create policy visits_company_check on public.visits as restrictive for insert to authenticated
  with check (public.can_access_company(company_id));
create policy activities_company_check on public.activities as restrictive for insert to authenticated
  with check (public.can_access_company(company_id));
create policy orders_company_check on public.orders as restrictive for insert to authenticated
  with check (public.can_access_company(company_id));
create policy tasks_company_check on public.tasks as restrictive for insert to authenticated
  with check (company_id is null or public.can_access_company(company_id));

create policy opp_history_select on public.opportunity_stage_history for select to authenticated
  using (public.can_access_opportunity(opportunity_id));

create policy visit_products_select on public.visit_products for select to authenticated
  using (public.can_access_visit(visit_id));
create policy visit_products_insert on public.visit_products for insert to authenticated
  with check (public.can_access_visit(visit_id));
create policy visit_products_delete on public.visit_products for delete to authenticated
  using (public.can_access_visit(visit_id));

-- Itens de pedido ---------------------------------------------------------
create policy order_items_select on public.order_items for select to authenticated
  using (public.can_access_order(order_id));
create policy order_items_insert on public.order_items for insert to authenticated
  with check (public.can_access_order(order_id));
create policy order_items_update on public.order_items for update to authenticated
  using (public.can_access_order(order_id)) with check (public.can_access_order(order_id));
create policy order_items_delete on public.order_items for delete to authenticated
  using (public.can_access_order(order_id));

-- Vendas (faturamento) ---------------------------------------------------
create policy sales_select on public.sales for select to authenticated
  using (
    organization_id = (select public.current_org_id())
    and ((select public.is_admin()) or seller_id = (select auth.uid()))
  );


-- Notificações ------------------------------------------------------------
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Auditoria (somente gestor) ---------------------------------------------
create policy audit_select on public.audit_logs for select to authenticated
  using (organization_id = (select public.current_org_id()) and (select public.is_admin()));

-- Anônimos não acessam nada --------------------------------------------
revoke all on all tables in schema public from anon;
