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
