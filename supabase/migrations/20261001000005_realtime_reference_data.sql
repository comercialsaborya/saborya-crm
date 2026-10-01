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
