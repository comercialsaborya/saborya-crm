-- Saborya CRM — instalação completa do banco (gerado por npm run db:bundle).
-- Rode UMA vez em um projeto Supabase novo: SQL Editor → New query → colar → Run.

-- >>> 20261001000001_schema.sql
-- =====================================================================
-- Saborya CRM — 0001 · Schema base
-- Tipos, organizações, perfis e todas as tabelas de negócio.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tipos enumerados (rótulos em PT-BR ficam no frontend: src/lib/constants.ts)
-- ---------------------------------------------------------------------
create type public.user_role as enum ('admin', 'vendedor');

create type public.client_type as enum (
  'rede_supermercado', 'supermercado_independente', 'distribuidor', 'atacadista',
  'conveniencia', 'restaurante', 'food_service', 'outro'
);

create type public.lead_temperature as enum ('frio', 'interessado', 'quente', 'cliente', 'perdido');

create type public.product_category as enum ('bento', 'onigiri', 'tamago', 'hot_roll', 'food_service', 'outros');

create type public.activity_type as enum (
  'visita', 'ligacao', 'whatsapp', 'email', 'reuniao', 'follow_up', 'pedido', 'pos_venda'
);

create type public.visit_type as enum (
  'primeira_visita', 'follow_up', 'apresentacao', 'negociacao', 'pos_venda', 'reativacao'
);

create type public.visit_result as enum (
  'sem_interesse', 'interessado', 'negociacao', 'pedido_realizado', 'retornar_depois', 'perdido'
);

create type public.interest_level as enum ('baixo', 'medio', 'alto');

create type public.task_priority as enum ('alta', 'media', 'baixa');
create type public.task_status as enum ('pendente', 'concluida', 'cancelada');

create type public.order_status as enum (
  'orcamento', 'pedido_realizado', 'faturado', 'em_entrega', 'entregue', 'cancelado'
);

create type public.sale_status as enum ('ativa', 'cancelada');

-- ---------------------------------------------------------------------
-- Organizações (preparado para múltiplas empresas/unidades)
-- ---------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'America/Sao_Paulo',
  inactivity_days integer not null default 30 check (inactivity_days > 0),
  stalled_opportunity_days integer not null default 14 check (stalled_opportunity_days > 0),
  repurchase_alert_days integer not null default 45 check (repurchase_alert_days > 0),
  brand_color text not null default '#C8364A',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organizations is 'Empresa/unidade. Hoje existe uma; a arquitetura suporta várias.';

-- ---------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id),
  full_name text not null default '',
  email text,
  phone text,
  role public.user_role not null default 'vendedor',
  active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create index profiles_org_idx on public.profiles (organization_id);

-- ---------------------------------------------------------------------
-- Funções auxiliares de autorização (usadas em defaults e RLS)
-- ---------------------------------------------------------------------
create or replace function public.current_org_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

create or replace function public.local_today()
returns date
language sql stable security definer set search_path = ''
as $$
  select (now() at time zone coalesce(
    (select o.timezone from public.organizations o where o.id = public.current_org_id()),
    'America/Sao_Paulo'))::date;
$$;

-- ---------------------------------------------------------------------
-- Clientes (empresas / redes)
-- ---------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id),
  legal_name text not null check (length(trim(legal_name)) > 0),
  trade_name text,
  cnpj text check (cnpj is null or cnpj ~ '^[0-9]{14}$'),
  segment text,
  client_type public.client_type not null default 'outro',
  address text,
  city text,
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  zip_code text,
  phone text,
  email text,
  website text,
  instagram text,
  owner_id uuid not null default auth.uid() references public.profiles (id),
  status public.lead_temperature not null default 'frio',
  purchase_potential numeric(14,2) check (purchase_potential >= 0),
  last_contact_at timestamptz,
  last_visit_at timestamptz,
  next_contact_date date,
  notes text,
  latitude double precision,
  longitude double precision,
  external_id text,
  is_demo boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  updated_by uuid references public.profiles (id)
);

comment on column public.companies.external_id is 'Código do cliente no ERP (integração futura).';

create unique index companies_cnpj_unique on public.companies (organization_id, cnpj)
  where cnpj is not null and deleted_at is null;
create index companies_owner_idx on public.companies (owner_id) where deleted_at is null;
create index companies_status_idx on public.companies (organization_id, status) where deleted_at is null;
create index companies_city_idx on public.companies (organization_id, state, city);

create table public.company_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  company_id uuid not null references public.companies (id),
  from_status public.lead_temperature,
  to_status public.lead_temperature not null,
  changed_by uuid references public.profiles (id),
  changed_at timestamptz not null default now(),
  reason text
);
create index company_status_history_company_idx on public.company_status_history (company_id, changed_at desc);

-- ---------------------------------------------------------------------
-- Compradores / contatos
-- ---------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id),
  company_id uuid not null references public.companies (id),
  name text not null check (length(trim(name)) > 0),
  job_title text,
  department text,
  phone text,
  whatsapp text,
  email text,
  linkedin text,
  best_contact_time text,
  notes text,
  is_primary boolean not null default false,
  is_demo boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  updated_by uuid references public.profiles (id)
);
create index contacts_company_idx on public.contacts (company_id) where deleted_at is null;

-- ---------------------------------------------------------------------
-- Produtos
-- ---------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id),
  name text not null check (length(trim(name)) > 0),
  sku text not null check (length(trim(sku)) > 0),
  category public.product_category not null default 'outros',
  sales_unit text not null default 'unidade',
  price numeric(12,2) not null default 0 check (price >= 0),
  cost numeric(12,2) not null default 0 check (cost >= 0),
  margin_percent numeric(7,2) generated always as (
    case when price > 0 then round(((price - cost) / price) * 100, 2) end
  ) stored,
  active boolean not null default true,
  notes text,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  updated_by uuid references public.profiles (id),
  unique (organization_id, sku)
);

-- ---------------------------------------------------------------------
-- Etapas do pipeline (configuráveis sem alterar código)
-- ---------------------------------------------------------------------
create table public.pipeline_stages (
  key text primary key check (key ~ '^[a-z_]+$'),
  name text not null,
  position integer not null,
  color text not null default '#64748B',
  probability integer not null default 0 check (probability between 0 and 100),
  is_won boolean not null default false,
  is_lost boolean not null default false,
  active boolean not null default true
);

-- ---------------------------------------------------------------------
-- Oportunidades
-- ---------------------------------------------------------------------
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id),
  company_id uuid not null references public.companies (id),
  contact_id uuid references public.contacts (id),
  owner_id uuid not null default auth.uid() references public.profiles (id),
  title text not null check (length(trim(title)) > 0),
  stage_key text not null default 'prospeccao' references public.pipeline_stages (key),
  temperature public.lead_temperature not null default 'frio',
  estimated_value numeric(14,2) not null default 0 check (estimated_value >= 0),
  expected_close_date date,
  stage_entered_at timestamptz not null default now(),
  last_activity_at timestamptz,
  next_activity_date date,
  next_activity_note text,
  lost_reason text,
  closed_at timestamptz,
  notes text,
  is_demo boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  updated_by uuid references public.profiles (id)
);
create index opportunities_owner_idx on public.opportunities (owner_id, stage_key) where deleted_at is null;
create index opportunities_company_idx on public.opportunities (company_id);

create table public.opportunity_stage_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  opportunity_id uuid not null references public.opportunities (id),
  from_stage text references public.pipeline_stages (key),
  to_stage text not null references public.pipeline_stages (key),
  changed_by uuid references public.profiles (id),
  changed_at timestamptz not null default now(),
  seconds_in_previous_stage bigint
);
create index opp_stage_history_opp_idx on public.opportunity_stage_history (opportunity_id, changed_at desc);

-- ---------------------------------------------------------------------
-- Visitas
-- ---------------------------------------------------------------------
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id),
  company_id uuid not null references public.companies (id),
  contact_id uuid references public.contacts (id),
  opportunity_id uuid references public.opportunities (id),
  owner_id uuid not null default auth.uid() references public.profiles (id),
  visited_at timestamptz not null default now(),
  visit_type public.visit_type not null default 'follow_up',
  objective text,
  result public.visit_result not null,
  notes text,
  next_step text,
  next_contact_date date,
  potential_value numeric(14,2) check (potential_value >= 0),
  interest_level public.interest_level,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  location_accuracy_m double precision,
  location_captured_at timestamptz,
  is_demo boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  updated_by uuid references public.profiles (id)
);
create index visits_owner_idx on public.visits (owner_id, visited_at desc) where deleted_at is null;
create index visits_company_idx on public.visits (company_id, visited_at desc);

create table public.visit_products (
  visit_id uuid not null references public.visits (id) on delete cascade,
  product_id uuid not null references public.products (id),
  primary key (visit_id, product_id)
);

-- ---------------------------------------------------------------------
-- Atividades (linha do tempo)
-- ---------------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id),
  type public.activity_type not null,
  company_id uuid not null references public.companies (id),
  contact_id uuid references public.contacts (id),
  opportunity_id uuid references public.opportunities (id),
  visit_id uuid references public.visits (id),
  order_id uuid,
  owner_id uuid not null default auth.uid() references public.profiles (id),
  occurred_at timestamptz not null default now(),
  description text not null check (length(trim(description)) > 0),
  result text,
  next_action text,
  next_action_date date,
  is_demo boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  updated_by uuid references public.profiles (id)
);
create index activities_company_idx on public.activities (company_id, occurred_at desc) where deleted_at is null;
create index activities_owner_idx on public.activities (owner_id, occurred_at desc) where deleted_at is null;

-- ---------------------------------------------------------------------
-- Tarefas / follow-ups
-- ---------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id),
  company_id uuid references public.companies (id),
  contact_id uuid references public.contacts (id),
  opportunity_id uuid references public.opportunities (id),
  visit_id uuid references public.visits (id),
  owner_id uuid not null default auth.uid() references public.profiles (id),
  title text not null check (length(trim(title)) > 0),
  description text,
  due_date date not null,
  due_time time,
  priority public.task_priority not null default 'media',
  status public.task_status not null default 'pendente',
  completed_at timestamptz,
  is_demo boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  updated_by uuid references public.profiles (id)
);
create index tasks_owner_due_idx on public.tasks (owner_id, status, due_date) where deleted_at is null;
create index tasks_company_idx on public.tasks (company_id);

-- ---------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id),
  order_number bigint generated by default as identity (start with 1001) unique,
  company_id uuid not null references public.companies (id),
  contact_id uuid references public.contacts (id),
  opportunity_id uuid references public.opportunities (id),
  owner_id uuid not null default auth.uid() references public.profiles (id),
  order_date date not null default current_date,
  status public.order_status not null default 'pedido_realizado',
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0 check (discount >= 0),
  total numeric(14,2) not null default 0,
  invoice_number text,
  invoiced_at timestamptz,
  delivered_at timestamptz,
  canceled_at timestamptz,
  notes text,
  external_id text,
  is_demo boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id),
  updated_by uuid references public.profiles (id)
);
create index orders_owner_idx on public.orders (owner_id, order_date desc) where deleted_at is null;
create index orders_company_idx on public.orders (company_id, order_date desc);
create index orders_status_idx on public.orders (organization_id, status);

alter table public.activities
  add constraint activities_order_id_fkey foreign key (order_id) references public.orders (id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id),
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  subtotal numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

-- ---------------------------------------------------------------------
-- Vendas (faturamento) — geradas automaticamente quando o pedido é faturado
-- ---------------------------------------------------------------------
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  order_id uuid not null unique references public.orders (id),
  company_id uuid not null references public.companies (id),
  seller_id uuid not null references public.profiles (id),
  invoice_number text,
  invoiced_at timestamptz not null,
  amount numeric(14,2) not null,
  status public.sale_status not null default 'ativa',
  canceled_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sales_seller_idx on public.sales (seller_id, invoiced_at desc);
create index sales_org_date_idx on public.sales (organization_id, invoiced_at desc);
create index sales_company_idx on public.sales (company_id);

-- ---------------------------------------------------------------------
-- Notificações (base para push futuro)
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations (id),
  table_name text not null,
  record_id uuid,
  action text not null,
  actor_id uuid references public.profiles (id) on delete set null,
  company_id uuid,
  company_label text,
  changed_fields text[],
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_org_created_idx on public.audit_logs (organization_id, created_at desc);
create index audit_logs_record_idx on public.audit_logs (table_name, record_id);
create index audit_logs_company_idx on public.audit_logs (company_id, created_at desc);


-- >>> 20261001000002_business_rules.sql
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


-- >>> 20261001000003_rls.sql
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


-- >>> 20261001000004_views_reports.sql
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


-- >>> 20261001000005_realtime_reference_data.sql
-- =====================================================================
-- Saborya CRM — 0005 · Tempo real + dados de referência
-- (organização, etapas do pipeline e catálogo inicial de produtos)
-- =====================================================================

-- Tempo real: tabelas que atualizam dashboards/listas sem recarregar.
-- O Supabase Realtime respeita as políticas RLS de SELECT.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.companies, public.contacts, public.opportunities, public.visits, public.activities,
      public.tasks, public.orders, public.sales, public.audit_logs,
      public.notifications;
  end if;
end $$;

-- Organização padrão ------------------------------------------------------
insert into public.organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Saborya')
on conflict (id) do nothing;

-- Etapas do pipeline -----------------------------------------------------
insert into public.pipeline_stages (key, name, position, color, probability, is_won, is_lost) values
  ('prospeccao',       'Prospecção',        1, '#94A3B8',   5, false, false),
  ('contato',          'Contato',           2, '#60A5FA',  10, false, false),
  ('visita_agendada',  'Visita agendada',   3, '#818CF8',  20, false, false),
  ('visita_realizada', 'Visita realizada',  4, '#A78BFA',  30, false, false),
  ('interessado',      'Interessado',       5, '#FBBF24',  45, false, false),
  ('negociacao',       'Negociação',        6, '#FB923C',  60, false, false),
  ('pedido',           'Pedido',            7, '#F472B6',  85, false, false),
  ('venda',            'Venda realizada',   8, '#22C55E', 100, true,  false),
  ('perdido',          'Perdido',           9, '#EF4444',   0, false, true)
on conflict (key) do nothing;

-- Catálogo inicial ---------------------------------------------------------
-- Preços e custos são REFERÊNCIAS para começar: ajuste em Produtos.
insert into public.products (organization_id, name, sku, category, sales_unit, price, cost, notes) values
  ('00000000-0000-0000-0000-000000000001', 'Bento de Frango Teriyaki',  'BEN-TERI', 'bento',        'unidade', 24.90, 13.50, 'Preço de referência — ajustar'),
  ('00000000-0000-0000-0000-000000000001', 'Bento de Mignon Congelado', 'BEN-MIGN', 'bento',        'unidade', 32.90, 19.00, 'Preço de referência — ajustar'),
  ('00000000-0000-0000-0000-000000000001', 'Bentô de Karê',             'BEN-KARE', 'bento',        'unidade', 23.90, 12.80, 'Preço de referência — ajustar'),
  ('00000000-0000-0000-0000-000000000001', 'Bento de Yakissoba',        'BEN-YAKI', 'bento',        'unidade', 22.90, 12.00, 'Preço de referência — ajustar'),
  ('00000000-0000-0000-0000-000000000001', 'Tamago Congelado',          'TAM-CONG', 'tamago',       'unidade', 12.90,  6.00, 'Preço de referência — ajustar'),
  ('00000000-0000-0000-0000-000000000001', 'Onigiri Salmão Congelado',  'ONI-SALM', 'onigiri',      'unidade', 11.90,  5.90, 'Preço de referência — ajustar'),
  ('00000000-0000-0000-0000-000000000001', 'Onigiri Atum Congelado',    'ONI-ATUM', 'onigiri',      'unidade', 10.90,  5.20, 'Preço de referência — ajustar'),
  ('00000000-0000-0000-0000-000000000001', 'Onigiri Shimeji Congelado', 'ONI-SHIM', 'onigiri',      'unidade',  9.90,  4.50, 'Preço de referência — ajustar'),
  ('00000000-0000-0000-0000-000000000001', 'Onigiri Frango Congelado',  'ONI-FRAN', 'onigiri',      'unidade',  9.90,  4.60, 'Preço de referência — ajustar'),
  ('00000000-0000-0000-0000-000000000001', 'Onigiri Bulgogi Congelado', 'ONI-BULG', 'onigiri',      'unidade', 11.50,  5.80, 'Preço de referência — ajustar'),
  ('00000000-0000-0000-0000-000000000001', 'Hot Roll Congelado',        'HOT-CONG', 'hot_roll',     'bandeja', 19.90,  9.50, 'Preço de referência — ajustar'),
  ('00000000-0000-0000-0000-000000000001', 'Hot Roll Food Service',     'HOT-FSRV', 'food_service', 'pacote',  79.90, 42.00, 'Preço de referência — ajustar')
on conflict (organization_id, sku) do nothing;


-- >>> 20261001000006_demo_data.sql
-- =====================================================================
-- Saborya CRM — 0006 · Dados de demonstração (removíveis)
--
-- Tudo criado aqui tem is_demo = true. Execução apenas pelo servidor
-- (service_role) via scripts/demo.mjs:
--   npm run demo:seed     -> cria 3 vendedores demo + dados
--   npm run demo:remove   -> apaga tudo que é demo
-- =====================================================================

create or replace function public.seed_demo_data(p_seller_ids uuid[])
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid;
  v_companies uuid[] := '{}';
  v_contacts uuid[] := '{}';
  v_opps uuid[] := '{}';
  v_products public.products[];
  v_stage_keys text[] := array['prospeccao','contato','visita_agendada','visita_realizada','interessado',
                               'negociacao','pedido','venda','perdido'];
  v_id uuid;
  v_seller uuid;
  v_company uuid;
  v_contact uuid;
  v_order uuid;
  v_status public.order_status;
  v_when timestamptz;
  i integer;
  j integer;
  k integer;
  rec record;
begin
  if array_length(p_seller_ids, 1) is null then
    raise exception 'Informe ao menos um vendedor demo.';
  end if;
  select organization_id into v_org from public.profiles where id = p_seller_ids[1];
  if v_org is null then
    raise exception 'Vendedor demo sem perfil.';
  end if;
  if exists (select 1 from public.companies where is_demo and organization_id = v_org) then
    raise exception 'Já existem dados demo. Rode demo:remove antes.';
  end if;

  perform setseed(0.42);
  select array_agg(p order by p.sku) into v_products
    from public.products p where p.organization_id = v_org and p.active;

  -- 8 clientes (5 redes de supermercado + outros tipos) -----------------------
  for rec in
    select * from (values
      (1, 'Rede Bom Preço Paulista Ltda', '[DEMO] Rede Bom Preço',        '00000000000101', 'rede_supermercado'::public.client_type,       'São Paulo',      'SP', 'cliente'::public.lead_temperature, 180000),
      (2, 'Supermercados Vila Nova S.A.',  '[DEMO] Supermercados Vila Nova', '00000000000102', 'rede_supermercado'::public.client_type,     'Campinas',       'SP', 'quente'::public.lead_temperature,  120000),
      (3, 'Mercadão do Povo Com. Alim.',   '[DEMO] Rede Mercadão do Povo',  '00000000000103', 'rede_supermercado'::public.client_type,       'Santo André',    'SP', 'interessado'::public.lead_temperature, 90000),
      (4, 'Super Família Litoral Ltda',    '[DEMO] Super Família Litoral',  '00000000000104', 'rede_supermercado'::public.client_type,       'Santos',         'SP', 'cliente'::public.lead_temperature, 75000),
      (5, 'Rede Econômica ABC Ltda',       '[DEMO] Rede Econômica ABC',     '00000000000105', 'rede_supermercado'::public.client_type,       'São Bernardo do Campo', 'SP', 'frio'::public.lead_temperature, 60000),
      (6, 'Distribuidora Frio Sul Ltda',   '[DEMO] Distribuidora Frio Sul', '00000000000106', 'distribuidor'::public.client_type,            'Curitiba',       'PR', 'quente'::public.lead_temperature, 150000),
      (7, 'Empório Oriental Liberdade ME', '[DEMO] Empório Oriental',       '00000000000107', 'supermercado_independente'::public.client_type,'São Paulo',     'SP', 'cliente'::public.lead_temperature, 30000),
      (8, 'Sakura Alimentação Coletiva',   '[DEMO] Sakura Food Service',    '00000000000108', 'food_service'::public.client_type,            'Rio de Janeiro', 'RJ', 'frio'::public.lead_temperature, 45000)
    ) as t(n, legal, trade, cnpj, ctype, city, uf, status, potential)
  loop
    v_seller := p_seller_ids[((rec.n - 1) % array_length(p_seller_ids, 1)) + 1];
    insert into public.companies
      (organization_id, legal_name, trade_name, cnpj, segment, client_type, city, state, address,
       phone, email, owner_id, status, purchase_potential, is_demo, created_by, created_at, notes)
    values
      (v_org, rec.legal, rec.trade, rec.cnpj, 'Varejo alimentar', rec.ctype, rec.city, rec.uf,
       'Av. Demonstração, ' || (100 * rec.n), '(11) 4000-00' || lpad(rec.n::text, 2, '0'),
       'compras' || rec.n || '@demo.saborya.local', v_seller, 'frio', rec.potential, true, v_seller,
       now() - make_interval(days => 200 - rec.n * 20),
       'Registro de demonstração — pode ser removido com npm run demo:remove')
    returning id into v_id;
    v_companies := v_companies || v_id;
  end loop;

  -- 12 compradores ------------------------------------------------------------
  for rec in
    select * from (values
      (1, 'Maria Oliveira',  'Gerente de Compras',        'Compras'),
      (1, 'João Mendes',     'Comprador de Congelados',   'Compras'),
      (1, 'Carlos Souza',    'Diretor Comercial',         'Comercial'),
      (2, 'Fernanda Lima',   'Compradora de Congelados',  'Compras'),
      (2, 'Ricardo Alves',   'Gerente de Categoria',      'Compras'),
      (3, 'Patrícia Rocha',  'Compradora',                'Compras'),
      (4, 'André Martins',   'Gerente de Loja',           'Operações'),
      (5, 'Luciana Prado',   'Compradora de Perecíveis',  'Compras'),
      (6, 'Eduardo Tanaka',  'Diretor de Suprimentos',    'Suprimentos'),
      (6, 'Camila Ferreira', 'Analista de Compras',       'Suprimentos'),
      (7, 'Kenji Yamamoto',  'Proprietário',              'Diretoria'),
      (8, 'Renata Duarte',   'Nutricionista Responsável', 'Operações')
    ) as t(cidx, name, title, dept)
  loop
    insert into public.contacts
      (organization_id, company_id, name, job_title, department, phone, whatsapp, email,
       best_contact_time, is_primary, is_demo, created_by)
    select v_org, v_companies[rec.cidx], rec.name, rec.title, rec.dept,
           '(11) 9' || lpad((80000000 + floor(random() * 9999999))::text, 8, '0'),
           '55119' || lpad((80000000 + floor(random() * 9999999))::text, 8, '0'),
           lower(replace(split_part(rec.name, ' ', 1), 'í', 'i')) || '@demo.saborya.local',
           (array['Manhã (9h–11h)', 'Tarde (14h–17h)', 'Segunda a quarta, manhã'])[1 + floor(random() * 3)::int],
           not exists (select 1 from public.contacts x where x.company_id = v_companies[rec.cidx]),
           true, c.owner_id
      from public.companies c where c.id = v_companies[rec.cidx]
    returning id into v_id;
    v_contacts := v_contacts || v_id;
  end loop;

  -- 20 oportunidades ------------------------------------------------------------
  for i in 1..20 loop
    v_company := v_companies[((i - 1) % 8) + 1];
    select owner_id into v_seller from public.companies where id = v_company;
    select id into v_contact from public.contacts where company_id = v_company order by is_primary desc, name limit 1;
    insert into public.opportunities
      (organization_id, company_id, contact_id, owner_id, title, stage_key, temperature,
       estimated_value, expected_close_date, next_activity_date, next_activity_note, is_demo, created_by)
    values
      (v_org, v_company, v_contact, v_seller,
       (array['Linha de onigiris', 'Bentos para seção de congelados', 'Hot roll para food service',
              'Mix completo congelados', 'Ponto extra em gôndola', 'Tamago para rotisseria'])[1 + (i % 6)],
       v_stage_keys[1 + (i % 9)],
       (array['frio', 'interessado', 'quente', 'quente', 'interessado'])[1 + (i % 5)]::public.lead_temperature,
       (3 + floor(random() * 40)) * 1000,
       (now() + make_interval(days => 5 + i * 3))::date,
       case when i % 4 = 0 then null else (now() + make_interval(days => (i % 10) - 3))::date end,
       case when i % 4 = 0 then null else 'Retornar com proposta' end,
       true, v_seller)
    returning id into v_id;
    v_opps := v_opps || v_id;
  end loop;
  -- Tempo em etapa variado (para "Saúde do funil")
  update public.opportunities set
    created_at = now() - make_interval(days => 20 + (row_n * 3)),
    stage_entered_at = now() - make_interval(days => (row_n * 2) % 25),
    last_activity_at = now() - make_interval(days => (row_n * 3) % 35)
  from (select id as oid, row_number() over (order by created_at, id)::int as row_n
          from public.opportunities where id = any (v_opps)) x
  where id = x.oid;
  update public.opportunity_stage_history h
     set changed_at = now() - make_interval(days => floor(random() * 60)::int),
         seconds_in_previous_stage = case when from_stage is null then null
                                          else (2 + floor(random() * 12)) * 86400 end
   where opportunity_id = any (v_opps);
  insert into public.opportunity_stage_history
    (organization_id, opportunity_id, from_stage, to_stage, changed_by, changed_at, seconds_in_previous_stage)
  select v_org, o.id, s.key, o.stage_key, o.owner_id, now() - make_interval(days => 10 + n), (3 + n % 9) * 86400
    from public.opportunities o
    cross join lateral (select ps.key, row_number() over (order by ps.position)::int as n
                          from public.pipeline_stages ps
                         where ps.position < (select position from public.pipeline_stages where key = o.stage_key)
                           and not ps.is_lost) s
   where o.id = any (v_opps);

  -- 20 visitas ------------------------------------------------------------------
  for i in 1..20 loop
    v_company := v_companies[((i - 1) % 8) + 1];
    select owner_id into v_seller from public.companies where id = v_company;
    select id into v_contact from public.contacts where company_id = v_company order by random() limit 1;
    v_when := date_trunc('day', now()) - make_interval(days => (i * 4) % 60) + make_interval(hours => 9 + (i % 8));
    insert into public.visits
      (organization_id, company_id, contact_id, owner_id, visited_at, visit_type, objective, result,
       notes, next_step, next_contact_date, potential_value, interest_level,
       latitude, longitude, location_captured_at, location_accuracy_m, is_demo, created_by)
    values
      (v_org, v_company, v_contact, v_seller, v_when,
       (array['primeira_visita', 'follow_up', 'apresentacao', 'negociacao', 'pos_venda', 'reativacao'])[1 + (i % 6)]::public.visit_type,
       (array['Apresentar linha de onigiris', 'Degustação de bentos', 'Negociar tabela de preços',
              'Acompanhar giro na gôndola', 'Reativar cliente'])[1 + (i % 5)],
       (array['interessado', 'negociacao', 'retornar_depois', 'pedido_realizado', 'sem_interesse', 'interessado'])[1 + (i % 6)]::public.visit_result,
       'Visita de demonstração.',
       (array['Enviar proposta', 'Agendar degustação', 'Ligar para comprador', 'Enviar tabela atualizada'])[1 + (i % 4)],
       (now() + make_interval(days => (i % 12) - 2))::date,
       (5 + floor(random() * 30)) * 1000,
       (array['baixo', 'medio', 'alto'])[1 + (i % 3)]::public.interest_level,
       -23.55 + random() / 10, -46.63 + random() / 10, v_when, 25,
       true, v_seller)
    returning id into v_id;
    insert into public.visit_products (visit_id, product_id)
    select v_id, (v_products[1 + ((i + n) % array_length(v_products, 1))]).id
      from generate_series(0, 2) n
    on conflict do nothing;
  end loop;

  -- 30 atividades avulsas (ligações, WhatsApp, e-mails...) -----------------------
  for i in 1..30 loop
    v_company := v_companies[((i * 3) % 8) + 1];
    select owner_id into v_seller from public.companies where id = v_company;
    select id into v_contact from public.contacts where company_id = v_company order by random() limit 1;
    insert into public.activities
      (organization_id, type, company_id, contact_id, opportunity_id, owner_id, occurred_at,
       description, result, next_action, next_action_date, is_demo, created_by)
    values
      (v_org,
       (array['ligacao', 'whatsapp', 'email', 'reuniao', 'follow_up', 'pos_venda'])[1 + (i % 6)]::public.activity_type,
       v_company, v_contact,
       (select o.id from public.opportunities o where o.company_id = v_company order by o.created_at limit 1),
       v_seller,
       now() - make_interval(days => (i * 2) % 50, hours => i % 9),
       (array['Ligação para apresentar novidades', 'WhatsApp com tabela de preços', 'E-mail com catálogo',
              'Reunião com comprador', 'Follow-up da proposta', 'Pós-venda: giro dos produtos'])[1 + (i % 6)],
       (array['Positivo', 'Aguardando retorno', 'Pediu nova proposta', 'Sem resposta'])[1 + (i % 4)],
       'Retornar contato', (now() + make_interval(days => i % 10))::date,
       true, v_seller);
  end loop;

  -- 15 pedidos (10 faturados ao longo de 10 meses) --------------------------------
  for i in 1..15 loop
    v_company := v_companies[(array[1, 4, 7, 2, 6, 1, 4, 7, 1, 6, 2, 4, 7, 3, 1])[i]];
    select owner_id into v_seller from public.companies where id = v_company;
    select id into v_contact from public.contacts where company_id = v_company order by is_primary desc limit 1;
    v_when := now() - make_interval(days => (15 - i) * 20 + 2);
    v_status := case
      when i <= 10 then 'faturado'
      when i = 11 then 'em_entrega'
      when i = 12 then 'entregue'
      when i = 13 then 'pedido_realizado'
      when i = 14 then 'orcamento'
      else 'cancelado' end;
    insert into public.orders
      (organization_id, company_id, contact_id, owner_id, order_date, status, is_demo, created_by, notes)
    values
      (v_org, v_company, v_contact, v_seller, v_when::date, 'pedido_realizado', true, v_seller,
       'Pedido de demonstração')
    returning id into v_order;

    k := 2 + (i % 3);
    for j in 1..k loop
      insert into public.order_items (order_id, product_id, quantity, unit_price)
      select v_order, p.id, (5 + floor(random() * 30)) * 10, p.price
        from public.products p
       where p.id = (v_products[1 + ((i * 2 + j) % array_length(v_products, 1))]).id
      on conflict do nothing;
    end loop;

    update public.orders
       set discount = case when i % 4 = 0 then round(subtotal * 0.05, 2) else 0 end,
           status = v_status,
           invoice_number = case when v_status in ('faturado', 'em_entrega', 'entregue')
                                 then 'NF-DEMO-' || (5000 + i) end,
           invoiced_at = case when v_status in ('faturado', 'em_entrega', 'entregue')
                              then v_when + interval '1 day' end
     where id = v_order;
  end loop;

  -- Tarefas -------------------------------------------------------------------------
  for i in 1..18 loop
    v_company := v_companies[((i - 1) % 8) + 1];
    select owner_id into v_seller from public.companies where id = v_company;
    insert into public.tasks
      (organization_id, company_id, contact_id, opportunity_id, owner_id, title, description,
       due_date, priority, status, is_demo, created_by)
    values
      (v_org, v_company,
       (select id from public.contacts where company_id = v_company order by is_primary desc limit 1),
       (select id from public.opportunities where company_id = v_company order by created_at limit 1),
       v_seller,
       (array['Ligar para comprador', 'Enviar proposta revisada', 'Agendar degustação',
              'Confirmar entrega', 'Visitar loja', 'Cobrar retorno da proposta'])[1 + (i % 6)],
       'Tarefa de demonstração',
       (now() + make_interval(days => (i % 12) - 4))::date,
       (array['alta', 'media', 'baixa'])[1 + (i % 3)]::public.task_priority,
       case when i % 7 = 0 then 'concluida' else 'pendente' end::public.task_status,
       true, v_seller);
  end loop;

  return jsonb_build_object(
    'companies', array_length(v_companies, 1),
    'contacts', array_length(v_contacts, 1),
    'opportunities', array_length(v_opps, 1),
    'visits', (select count(*) from public.visits where is_demo and organization_id = v_org),
    'activities', (select count(*) from public.activities where is_demo and organization_id = v_org),
    'orders', (select count(*) from public.orders where is_demo and organization_id = v_org),
    'tasks', (select count(*) from public.tasks where is_demo and organization_id = v_org)
  );
end $$;

create or replace function public.remove_demo_data()
returns uuid[]
language plpgsql security definer set search_path = ''
as $$
declare
  v_demo_users uuid[];
  v_orders uuid[];
begin
  select coalesce(array_agg(id), '{}') into v_demo_users from public.profiles where is_demo;
  select coalesce(array_agg(id), '{}') into v_orders from public.orders
   where is_demo or company_id in (select id from public.companies where is_demo);

  -- Volta pedidos demo para estado editável (estorna o faturamento) e apaga.
  update public.orders set status = 'pedido_realizado' where id = any (v_orders) and status <> 'pedido_realizado';
  delete from public.sales where is_demo or order_id = any (v_orders);
  delete from public.notifications where user_id = any (v_demo_users)
    or link in (select '/pedidos/' || id from unnest(v_orders) as t(id));
  delete from public.activities where is_demo or order_id = any (v_orders)
    or company_id in (select id from public.companies where is_demo);
  delete from public.tasks where is_demo or company_id in (select id from public.companies where is_demo);
  delete from public.visit_products where visit_id in (select id from public.visits where is_demo
    or company_id in (select id from public.companies where is_demo));
  delete from public.visits where is_demo or company_id in (select id from public.companies where is_demo);
  delete from public.order_items where order_id = any (v_orders);
  delete from public.orders where id = any (v_orders);
  delete from public.opportunity_stage_history where opportunity_id in
    (select id from public.opportunities where is_demo or company_id in (select id from public.companies where is_demo));
  delete from public.opportunities where is_demo or company_id in (select id from public.companies where is_demo);
  delete from public.contacts where is_demo or company_id in (select id from public.companies where is_demo);
  delete from public.company_status_history where company_id in (select id from public.companies where is_demo);
  delete from public.companies where is_demo;
  delete from public.audit_logs
   where coalesce((new_data ->> 'is_demo')::boolean, (old_data ->> 'is_demo')::boolean, false)
      or actor_id = any (v_demo_users)
      or (table_name in ('order_items', 'visit_products'));
  return v_demo_users;
end $$;

revoke execute on function public.seed_demo_data(uuid[]) from public, anon, authenticated;
revoke execute on function public.remove_demo_data() from public, anon, authenticated;
grant execute on function public.seed_demo_data(uuid[]) to service_role;
grant execute on function public.remove_demo_data() to service_role;


-- >>> 20261001000007_save_order.sql
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
