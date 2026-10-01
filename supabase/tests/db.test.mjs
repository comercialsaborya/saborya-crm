// Testes de banco: aplica as migrations em um PostgreSQL real (embedded),
// simulando o schema "auth" e os papéis do Supabase, e valida regras de
// negócio e isolamento por RLS.
//
//   npm run test:db
//
import EmbeddedPostgres from 'embedded-postgres';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = join(tmpdir(), `crm-pg-${process.pid}-${Date.now()}`);
const port = 54000 + Math.floor(Math.random() * 900);
const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'postgres', port, persistent: false,
  initdbFlags: ['--encoding=UTF8', '--no-locale'], onLog: () => {} });

const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema extensions;
grant usage on schema public, auth, extensions to anon, authenticated, service_role;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create publication supabase_realtime;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`);
    throw e;
  }
}

async function main() {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('crm');
  const client = pg.getPgClient('crm');
  await client.connect();
  const q = (sql, params) => client.query(sql, params);

  // Executa como usuário autenticado (RLS ativo)
  async function as(uid, fn) {
    await q('begin');
    try {
      await q(`set local role authenticated`);
      await q(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]);
      const r = await fn();
      await q('commit');
      return r;
    } catch (e) {
      await q('rollback');
      throw e;
    }
  }
  async function asExpectError(uid, fn, pattern) {
    let err;
    try { await as(uid, fn); } catch (e) { err = e; }
    assert.ok(err, 'era esperado um erro');
    if (pattern) assert.match(err.message, pattern);
  }

  console.log('\n▶ Aplicando migrations');
  await q(SUPABASE_STUB);
  const migDir = join(root, 'supabase', 'migrations');
  for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
    await q(readFileSync(join(migDir, f), 'utf8'));
    console.log(`  ✓ ${f}`);
  }

  console.log('\n▶ Usuários e perfis');
  const mkUser = async (email, meta = {}, app = {}) =>
    (await q(`insert into auth.users (email, raw_user_meta_data, raw_app_meta_data) values ($1,$2,$3) returning id`,
      [email, meta, app])).rows[0].id;

  const admin = await mkUser('gestor@saborya.test', { full_name: 'Gestora Ana' });
  const joao = await mkUser('joao@saborya.test', { full_name: 'João Vendedor' }, { role: 'vendedor' });
  const bia = await mkUser('bia@saborya.test', { full_name: 'Bia Vendedora' }, { role: 'vendedor' });

  await test('primeiro usuário vira admin; demais vendedores', async () => {
    const r = await q(`select email, role from public.profiles order by created_at`);
    assert.equal(r.rows.find((x) => x.email === 'gestor@saborya.test').role, 'admin');
    assert.equal(r.rows.find((x) => x.email === 'joao@saborya.test').role, 'vendedor');
  });

  await test('vendedor não consegue se promover a admin nem se reativar', async () => {
    await asExpectError(joao, () => q(`update public.profiles set role='admin' where id=$1`, [joao]), /Apenas o gestor/);
    await asExpectError(joao, () => q(`update public.profiles set active=false where id=$1`, [joao]), /Apenas o gestor/);
  });

  await test('vendedor pode editar o próprio nome', async () => {
    await as(joao, () => q(`update public.profiles set full_name='João Silva' where id=$1`, [joao]));
  });

  await test('organização não fica sem admin', async () => {
    await asExpectError(admin, () => q(`update public.profiles set role='vendedor' where id=$1`, [admin]), /pelo menos um gestor/);
  });

  await test('vendedor enxerga só o próprio perfil; gestor vê todos', async () => {
    const r1 = await as(joao, () => q(`select id from public.profiles`));
    assert.equal(r1.rows.length, 1);
    const r2 = await as(admin, () => q(`select id from public.profiles`));
    assert.equal(r2.rows.length, 3);
  });

  console.log('\n▶ Clientes, contatos e RLS');
  const c1 = await as(joao, async () => (await q(
    `insert into public.companies (legal_name, trade_name, cnpj, client_type, city, state)
     values ('Rede Teste Ltda','Rede Teste','11222333000181','rede_supermercado','São Paulo','SP') returning id, owner_id, organization_id`)).rows[0]);
  const c2 = await as(bia, async () => (await q(
    `insert into public.companies (legal_name, client_type) values ('Mercado da Bia','supermercado_independente') returning id`)).rows[0]);

  await test('owner/org preenchidos automaticamente', async () => {
    assert.equal(c1.owner_id, joao);
    assert.equal(c1.organization_id, '00000000-0000-0000-0000-000000000001');
  });

  await test('vendedor não vê clientes de outro vendedor', async () => {
    const r = await as(joao, () => q(`select id from public.companies`));
    assert.deepEqual(r.rows.map((x) => x.id), [c1.id]);
    const v = await as(joao, () => q(`select id from public.company_overview`));
    assert.equal(v.rows.length, 1);
  });

  await test('vendedor não cria cliente em nome de outro', async () => {
    await asExpectError(joao, () => q(`insert into public.companies (legal_name, owner_id) values ('X',$1)`, [bia]));
  });

  await test('vendedor não transfere cliente', async () => {
    await asExpectError(joao, () => q(`update public.companies set owner_id=$2 where id=$1`, [c1.id, bia]), /Apenas o gestor/);
  });

  await test('CNPJ inválido é rejeitado', async () => {
    await asExpectError(joao, () => q(`insert into public.companies (legal_name, cnpj) values ('Y','123')`));
  });

  await test('vendedor não cadastra contato em cliente de outro', async () => {
    await asExpectError(joao, () => q(`insert into public.contacts (company_id, name) values ($1,'Intruso')`, [c2.id]));
  });

  const ct1 = await as(joao, async () => (await q(
    `insert into public.contacts (company_id, name, job_title) values ($1,'Maria','Gerente de Compras') returning id`, [c1.id])).rows[0].id);

  await test('mudança de status gera histórico (sem apagar)', async () => {
    await as(joao, () => q(`update public.companies set status='interessado' where id=$1`, [c1.id]));
    const h = await q(`select from_status, to_status, changed_by from public.company_status_history where company_id=$1 order by changed_at`, [c1.id]);
    assert.equal(h.rows.length, 2);
    assert.equal(h.rows[1].to_status, 'interessado');
    assert.equal(h.rows[1].changed_by, joao);
  });

  console.log('\n▶ Pipeline, visitas, atividades, tarefas');
  const opp = await as(joao, async () => (await q(
    `insert into public.opportunities (company_id, contact_id, title, estimated_value, temperature)
     values ($1,$2,'Linha onigiri',18500,'quente') returning id`, [c1.id, ct1])).rows[0].id);

  await test('oportunidade quente promove o cliente para "quente"', async () => {
    const r = await q(`select status from public.companies where id=$1`, [c1.id]);
    assert.equal(r.rows[0].status, 'quente');
  });

  await test('mudança de etapa registra histórico com tempo na etapa', async () => {
    await as(joao, () => q(`update public.opportunities set stage_key='negociacao' where id=$1`, [opp]));
    const h = await q(`select from_stage, to_stage, seconds_in_previous_stage from public.opportunity_stage_history where opportunity_id=$1 order by changed_at`, [opp]);
    assert.equal(h.rows.length, 2);
    assert.equal(h.rows[1].from_stage, 'prospeccao');
    assert.equal(h.rows[1].to_stage, 'negociacao');
    assert.notEqual(h.rows[1].seconds_in_previous_stage, null);
    const a = await q(`select action from public.audit_logs where record_id=$1 order by id`, [opp]);
    assert.ok(a.rows.some((x) => x.action === 'stage_change'));
  });

  const visit = await as(joao, async () => (await q(
    `insert into public.visits (company_id, contact_id, opportunity_id, visit_type, result, objective, next_contact_date, latitude, longitude, location_captured_at)
     values ($1,$2,$3,'apresentacao','negociacao','Degustação', current_date + 3, -23.5, -46.6, now()) returning id`, [c1.id, ct1, opp])).rows[0].id);

  await test('visita gera atividade na linha do tempo e atualiza o cliente', async () => {
    const a = await q(`select type, description from public.activities where visit_id=$1`, [visit]);
    assert.equal(a.rows.length, 1);
    assert.equal(a.rows[0].type, 'visita');
    const c = await q(`select last_visit_at, last_contact_at, next_contact_date from public.companies where id=$1`, [c1.id]);
    assert.ok(c.rows[0].last_visit_at && c.rows[0].last_contact_at && c.rows[0].next_contact_date);
  });

  await test('vendedor não registra visita em cliente de outro', async () => {
    await asExpectError(joao, () => q(`insert into public.visits (company_id, result) values ($1,'interessado')`, [c2.id]));
  });

  await test('tarefa concluída registra data de conclusão', async () => {
    const t = await as(joao, async () => (await q(
      `insert into public.tasks (company_id, title, due_date, priority) values ($1,'Ligar', current_date - 1, 'alta') returning id`, [c1.id])).rows[0].id);
    const k = await as(joao, () => q(`select public.dashboard_kpis(current_date - 30, current_date) as k`));
    assert.equal(k.rows[0].k.overdue_tasks, 1);
    await as(joao, () => q(`update public.tasks set status='concluida' where id=$1`, [t]));
    const r = await q(`select completed_at from public.tasks where id=$1`, [t]);
    assert.ok(r.rows[0].completed_at);
  });

  console.log('\n▶ Pedidos e faturamento');
  const prods = (await q(`select id, price from public.products order by sku limit 2`)).rows;
  const order = await as(joao, async () => {
    const o = (await q(`insert into public.orders (company_id, contact_id, opportunity_id, status) values ($1,$2,$3,'pedido_realizado') returning id, order_number`, [c1.id, ct1, opp])).rows[0];
    await q(`insert into public.order_items (order_id, product_id, quantity, unit_price) values ($1,$2,100,10), ($1,$3,50,20)`, [o.id, prods[0].id, prods[1].id]);
    await q(`update public.orders set discount=100 where id=$1`, [o.id]);
    return o;
  });

  await test('número do pedido sequencial a partir de 1001', async () => {
    assert.ok(Number(order.order_number) >= 1001);
  });

  await test('subtotal = Σ quantidade × preço; total = subtotal − desconto', async () => {
    const r = await q(`select subtotal, discount, total from public.orders where id=$1`, [order.id]);
    assert.equal(Number(r.rows[0].subtotal), 2000);
    assert.equal(Number(r.rows[0].total), 1900);
  });

  await test('vendedor não pode faturar pedido', async () => {
    await asExpectError(joao, () => q(`update public.orders set status='faturado' where id=$1`, [order.id]), /Apenas o gestor/);
  });

  await test('vendedor não cria pedido já faturado', async () => {
    await asExpectError(joao, () => q(`insert into public.orders (company_id, status) values ($1,'faturado')`, [c1.id]), /só pode criar/);
  });

  await as(admin, () => q(`update public.orders set status='faturado', invoice_number='NF-123' where id=$1`, [order.id]));

  await test('faturamento gera venda e notificação ao vendedor', async () => {
    const s = await q(`select amount, seller_id, status, invoice_number from public.sales where order_id=$1`, [order.id]);
    assert.equal(Number(s.rows[0].amount), 1900);
    assert.equal(s.rows[0].seller_id, joao);
    assert.equal(s.rows[0].invoice_number, 'NF-123');
    const n = await as(joao, () => q(`select title from public.notifications`));
    assert.match(n.rows[0].title, /faturado/);
  });

  await test('faturamento fecha a oportunidade como venda e o cliente vira "cliente"', async () => {
    const o = await q(`select stage_key, temperature from public.opportunities where id=$1`, [opp]);
    assert.equal(o.rows[0].stage_key, 'venda');
    const c = await q(`select status from public.companies where id=$1`, [c1.id]);
    assert.equal(c.rows[0].status, 'cliente');
  });

  await test('itens de pedido faturado não podem ser alterados', async () => {
    await asExpectError(admin, () => q(`delete from public.order_items where order_id=$1`, [order.id]), /não podem ser alterados/);
  });

  await test('vendedor vê o próprio faturamento e não o de outros', async () => {
    const r = await as(joao, () => q(`select amount from public.invoiced_sales`));
    assert.equal(r.rows.length, 1);
    const r2 = await as(bia, () => q(`select amount from public.invoiced_sales`));
    assert.equal(r2.rows.length, 0);
  });

  await test('save_order grava cabeçalho + itens de forma atômica e bloqueia edição após faturar', async () => {
    const items = JSON.stringify([{ product_id: prods[0].id, quantity: 10, unit_price: 5 }]);
    const id = await as(joao, async () => (await q(`select public.save_order(null, $1, $2) as id`,
      [JSON.stringify({ company_id: c1.id, status: 'pedido_realizado', discount: 5 }), items])).rows[0].id);
    let r = await q(`select subtotal, total, owner_id from public.orders where id=$1`, [id]);
    assert.equal(Number(r.rows[0].total), 45);
    assert.equal(r.rows[0].owner_id, joao);
    const items2 = JSON.stringify([{ product_id: prods[1].id, quantity: 3, unit_price: 20 }]);
    await as(joao, () => q(`select public.save_order($1, $2, $3)`, [id, JSON.stringify({ company_id: c1.id, status: 'orcamento' }), items2]));
    r = await q(`select subtotal, total, status from public.orders where id=$1`, [id]);
    assert.equal(Number(r.rows[0].total), 60);
    assert.equal(r.rows[0].status, 'orcamento');
    await asExpectError(joao, () => q(`select public.save_order(null, $1, '[]')`, [JSON.stringify({ company_id: c1.id })]), /pelo menos um produto/);
    await asExpectError(bia, () => q(`select public.save_order(null, $1, $2)`, [JSON.stringify({ company_id: c1.id }), items]));
    await as(admin, () => q(`update public.orders set status='faturado' where id=$1`, [id]));
    await asExpectError(admin, () => q(`select public.save_order($1, $2, $3)`, [id, JSON.stringify({ company_id: c1.id }), items]), /não pode ser editado/);
    await as(admin, () => q(`update public.orders set status='cancelado' where id=$1`, [id]));
  });

  console.log('\n▶ Relatórios e dashboards');
  await test('KPIs: vendedor não consegue ver números de outro vendedor', async () => {
    const k = await as(bia, () => q(`select public.dashboard_kpis(current_date - 30, current_date, $1) as k`, [joao]));
    assert.equal(Number(k.rows[0].k.revenue_period), 0);
    const k2 = await as(joao, () => q(`select public.dashboard_kpis(current_date - 30, current_date) as k`));
    assert.equal(Number(k2.rows[0].k.revenue_period), 1900);
    assert.equal(Number(k2.rows[0].k.volume_period), 150);
  });

  await test('vendas por produto com rateio do desconto', async () => {
    const r = await as(admin, () => q(`select * from public.sales_breakdown('product', current_date - 30, current_date)`));
    const total = r.rows.reduce((s, x) => s + Number(x.revenue), 0);
    assert.equal(total, 1900);
    assert.equal(r.rows.reduce((s, x) => s + Number(x.volume), 0), 150);
  });

  await test('vendas por mês (12 meses) e por vendedor', async () => {
    const m = await as(admin, () => q(`select * from public.sales_by_month(12)`));
    assert.equal(m.rows.length, 12);
    const p = await as(admin, () => q(`select * from public.seller_performance(current_date - 30, current_date)`));
    const j = p.rows.find((x) => x.seller_id === joao);
    assert.equal(Number(j.revenue), 1900);
    assert.equal(Number(j.visits), 1);
    const pj = await as(joao, () => q(`select * from public.seller_performance(current_date - 30, current_date)`));
    assert.equal(pj.rows.length, 1);
  });

  await test('funil, saúde do funil, alertas e busca global', async () => {
    const f = await as(admin, () => q(`select * from public.funnel_summary(current_date - 30, current_date)`));
    assert.equal(f.rows.length, 9);
    assert.equal(Number(f.rows.find((x) => x.stage_key === 'venda').opportunities), 1);
    const h = await as(admin, () => q(`select public.funnel_health(current_date - 30, current_date) as h`));
    assert.equal(Number(h.rows[0].h.won_count), 1);
    await as(admin, () => q(`select * from public.get_alerts(null)`));
    const s = await as(joao, () => q(`select * from public.global_search('teste')`));
    assert.ok(s.rows.some((x) => x.kind === 'cliente'));
    const s2 = await as(bia, () => q(`select * from public.global_search('teste')`));
    assert.equal(s2.rows.filter((x) => x.kind === 'cliente').length, 0);
    const s3 = await as(joao, () => q(`select * from public.global_search($1)`, [String(order.order_number)]));
    assert.ok(s3.rows.some((x) => x.kind === 'pedido'));
  });

  await test('cancelar pedido faturado estorna o faturamento', async () => {
    await as(admin, () => q(`update public.orders set status='cancelado' where id=$1`, [order.id]));
    const s = await q(`select status from public.sales where order_id=$1`, [order.id]);
    assert.equal(s.rows[0].status, 'cancelada');
    const k = await as(joao, () => q(`select public.dashboard_kpis(current_date - 30, current_date) as k`));
    assert.equal(Number(k.rows[0].k.revenue_period), 0);
  });

  await test('auditoria: só gestor consulta', async () => {
    const r = await as(joao, () => q(`select count(*)::int n from public.audit_logs`));
    assert.equal(r.rows[0].n, 0);
    const r2 = await as(admin, () => q(`select count(*)::int n from public.audit_feed`));
    assert.ok(r2.rows[0].n > 5);
  });

  await test('anônimo não lê nada', async () => {
    await q('begin');
    await q('set local role anon');
    let err;
    try { await q('select * from public.companies'); } catch (e) { err = e; }
    await q('rollback');
    assert.ok(err);
  });

  console.log('\n▶ Dados de demonstração');
  const demoSellers = [];
  for (const n of ['carlos', 'daniela', 'eduardo']) {
    demoSellers.push(await mkUser(`${n}@demo.saborya.local`, { full_name: `${n} (demo)` }, { role: 'vendedor', is_demo: true }));
  }
  await test('seed demo cria volumes mínimos exigidos', async () => {
    const r = (await q(`select public.seed_demo_data($1) as r`, [demoSellers])).rows[0].r;
    assert.ok(r.companies >= 5 && r.contacts >= 10 && r.opportunities >= 20);
    assert.ok(r.visits >= 20 && r.activities >= 30 && r.orders >= 15);
    const s = await q(`select count(*)::int n from public.sales where is_demo`);
    assert.ok(s.rows[0].n >= 10);
    const k = await as(admin, () => q(`select public.dashboard_kpis(current_date - 365, current_date) as k`));
    assert.ok(Number(k.rows[0].k.revenue_period) > 0);
    const al = await as(admin, () => q(`select * from public.get_alerts(null)`));
    assert.ok(al.rows.length > 0);
  });

  await test('seed demo não é executável por usuários do app', async () => {
    await asExpectError(admin, () => q(`select public.seed_demo_data($1)`, [demoSellers]), /permission denied/);
  });

  await test('remove demo apaga tudo que é demo e preserva dados reais', async () => {
    const users = (await q(`select public.remove_demo_data() as u`)).rows[0].u;
    assert.equal(users.length, 3);
    for (const t of ['companies', 'contacts', 'opportunities', 'visits', 'activities', 'orders', 'sales', 'tasks']) {
      const r = await q(`select count(*)::int n from public.${t} where is_demo`);
      assert.equal(r.rows[0].n, 0, t);
    }
    const real = await q(`select count(*)::int n from public.companies`);
    assert.equal(real.rows[0].n, 2);
    await q(`delete from auth.users where id = any($1)`, [users]);
  });

  await client.end();
  console.log(`\n✔ ${passed} testes de banco passaram\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await pg.stop(); } catch {}
    rmSync(dir, { recursive: true, force: true });
  });
