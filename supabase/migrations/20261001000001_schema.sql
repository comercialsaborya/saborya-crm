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
