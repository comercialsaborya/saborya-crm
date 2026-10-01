import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireSession, type Session } from '@/lib/auth';
import { getSellerOptions, one } from '@/lib/queries';
import { resolvePeriod, type DateRange } from '@/lib/periods';
import { addDaysISO, formatBRL, formatBRLCompact, formatDate, formatInt, greeting, todayISO } from '@/lib/format';
import { firstName } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PageHeader, SectionTitle, Stat, TemperatureBadge } from '@/components/ui/misc';
import { FilterBar } from '@/components/crm/filter-bar';
import { TaskItem } from '@/components/crm/task-item';
import { Funnel, MonthlyChart, RankBars } from '@/components/charts/charts';
import { AlertsPanel } from '@/components/dashboard/alerts';
import { ActivityFeed } from '@/components/dashboard/feed';
import { GrowthHint, growth } from '@/components/dashboard/kpi';
import type {
  AlertRow,
  AuditRow,
  BreakdownRow,
  CompanyOverview,
  DashboardKpis,
  FunnelRow,
  InvoicedSaleRow,
  MonthRow,
  TaskRow,
} from '@/types/db';

export const metadata: Metadata = { title: 'Início' };

type Supa = Awaited<ReturnType<typeof createClient>>;

async function loadCommon(supabase: Supa, range: DateRange, seller: string | null) {
  const [kpis, months, funnel, products, alerts] = await Promise.all([
    supabase.rpc('dashboard_kpis', { p_from: range.from, p_to: range.to, p_seller: seller }),
    supabase.rpc('sales_by_month', { p_months: 12, p_seller: seller }),
    supabase.rpc('funnel_summary', { p_from: range.from, p_to: range.to, p_seller: seller }),
    supabase.rpc('sales_breakdown', { p_group: 'product', p_from: range.from, p_to: range.to, p_seller: seller }),
    supabase.rpc('get_alerts', { p_seller: seller }),
  ]);
  return {
    kpis: (kpis.data ?? {}) as DashboardKpis,
    months: ((months.data ?? []) as MonthRow[]).map((m) => ({
      month: m.month,
      revenue: Number(m.revenue),
      volume: Number(m.volume),
      orders: Number(m.orders),
    })),
    funnel: ((funnel.data ?? []) as FunnelRow[]).map((f) => ({
      key: f.stage_key,
      name: f.name,
      color: f.color,
      count: Number(f.opportunities),
      value: Number(f.value),
      closed: f.is_won || f.is_lost,
    })),
    products: (products.data ?? []) as BreakdownRow[],
    alerts: (alerts.data ?? []) as AlertRow[],
  };
}

export default async function DashboardPage({ searchParams }: PageProps<'/'>) {
  const session = await requireSession();
  const sp = await searchParams;
  return session.isAdmin ? <AdminDashboard sp={sp} /> : <SellerDashboard session={session} sp={sp} />;
}

// ===================================================================== GESTOR
async function AdminDashboard({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const range = resolvePeriod(sp, 'mes');
  const seller = one(sp.vendedor) ?? null;
  const supabase = await createClient();
  const [common, bySeller, feed, sellers] = await Promise.all([
    loadCommon(supabase, range, seller),
    supabase.rpc('seller_performance', { p_from: range.from, p_to: range.to }),
    supabase.from('audit_feed').select('*').order('created_at', { ascending: false }).limit(60),
    getSellerOptions(),
  ]);
  const { kpis: k, months, funnel, products, alerts } = common;
  const perf = ((bySeller.data ?? []) as { seller_id: string; seller_name: string; revenue: number; volume: number; orders: number; visits: number }[]).filter(
    (p) => !seller || p.seller_id === seller,
  );
  const sellerName = sellers.find((s) => s.value === seller)?.label;

  return (
    <>
      <PageHeader
        title="Visão comercial"
        description={`${sellerName ? `Vendedor: ${sellerName}` : 'Todos os vendedores'} · ${range.label}`}
      />
      <FilterBar fields={[{ type: 'period', defaultPreset: 'mes' }, { type: 'picker', name: 'vendedor', label: 'Vendedor', options: sellers }]} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Faturamento do mês" value={formatBRLCompact(k.revenue_month)} hint="Mês corrente" />
        <Stat
          label="Faturamento do período"
          value={formatBRLCompact(k.revenue_period)}
          hint={<GrowthHint value={growth(Number(k.revenue_period), Number(k.revenue_previous_period))} />}
          href="/faturamento"
        />
        <Stat label="Volume vendido" value={`${formatInt(k.volume_period)} un.`} href="/volume" />
        <Stat label="Pedidos faturados" value={formatInt(k.invoiced_orders)} hint={`Ticket médio ${formatBRLCompact(k.avg_ticket)}`} />
        <Stat label="Clientes ativos" value={formatInt(k.active_clients)} hint="Compraram nos últimos 90 dias" />
        <Stat label="Novos clientes" value={formatInt(k.new_clients)} hint="Cadastrados no período" />
        <Stat label="Oportunidades abertas" value={formatInt(k.open_opportunities)} hint={`${formatBRLCompact(k.open_value)} em potencial`} href="/pipeline" />
        <Stat label="Visitas" value={formatInt(k.visits_period)} hint={`${formatInt(k.hot_opportunities)} oportunidade(s) quente(s)`} href="/visitas" />
      </div>

      <section className="mt-6">
        <SectionTitle>Atenção</SectionTitle>
        <AlertsPanel alerts={alerts} />
      </section>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Vendas por mês" description="Últimos 12 meses (pedidos faturados)" />
          <CardBody>
            <MonthlyChart data={months} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Atividades recentes" description="Atualiza sozinho" />
          <CardBody className="pt-2">
            <ActivityFeed rows={(feed.data ?? []) as AuditRow[]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Funil comercial" description="Quantidade e valor por etapa" action={<Link href="/funil" className="text-sm font-medium text-brand">Saúde do funil</Link>} />
          <CardBody>
            <Funnel stages={funnel} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Vendas por produto" description={range.label} action={<Link href="/volume" className="text-sm font-medium text-brand">Volume</Link>} />
          <CardBody>
            <RankBars data={products.map((p) => ({ label: p.label ?? '—', value: Number(p.revenue), sub: `${formatInt(p.volume)} un.` }))} format="brl" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Vendas por vendedor" description={range.label} action={<Link href="/desempenho" className="text-sm font-medium text-brand">Desempenho</Link>} />
          <CardBody>
            <RankBars
              data={perf
                .map((p) => ({
                  label: p.seller_name,
                  value: Number(p.revenue),
                  sub: `${formatInt(p.volume)} un. · ${p.orders} pedido(s) · ${p.visits} visita(s)`,
                }))
                .sort((a, b) => b.value - a.value)}
              format="brl"
              emptyText="Nenhum vendedor cadastrado."
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

// ===================================================================== VENDEDOR
async function SellerDashboard({ session, sp }: { session: Session; sp: Record<string, string | string[] | undefined> }) {
  const range = resolvePeriod(sp, 'mes');
  const supabase = await createClient();
  const today = todayISO();
  const [common, tasks, sales, forgotten] = await Promise.all([
    loadCommon(supabase, range, null),
    supabase
      .from('task_list')
      .select('*')
      .eq('owner_id', session.userId)
      .eq('status', 'pendente')
      .is('deleted_at', null)
      .lte('due_date', addDaysISO(today, 7))
      .order('due_date')
      .limit(40),
    supabase.from('invoiced_sales').select('*').eq('status', 'ativa').order('invoiced_at', { ascending: false }).limit(5),
    supabase
      .from('company_overview')
      .select('id, display_name, status, days_without_contact, city, state, last_contact_at')
      .is('deleted_at', null)
      .neq('status', 'perdido')
      .gte('days_without_contact', 30)
      .order('days_without_contact', { ascending: false })
      .limit(6),
  ]);
  const { kpis: k, months, funnel, alerts } = common;
  const all = (tasks.data ?? []) as TaskRow[];
  const agenda = all.filter((t) => t.due_date <= today);
  const upcoming = all.filter((t) => t.due_date > today);

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
            {greeting()}, {firstName(session.profile.full_name) || 'vendedor'}
          </h1>
          <p className="mt-1 text-sm text-muted">{formatDate(today)} · {agenda.length ? `${agenda.length} tarefa(s) para hoje` : 'Agenda livre hoje'}</p>
        </div>
        <Button asChild size="xl" className="w-full sm:w-auto">
          <Link href="/visitas/nova">
            <MapPin /> Registrar visita
          </Link>
        </Button>
      </div>

      <FilterBar fields={[{ type: 'period', defaultPreset: 'mes' }]} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Vendas do mês" value={formatBRLCompact(k.revenue_month)} href="/faturamento" />
        <Stat label="Faturado no período" value={formatBRLCompact(k.revenue_period)} hint={`${formatInt(k.orders_period)} pedido(s) · ${range.label}`} href="/pedidos" />
        <Stat label="Visitas do mês" value={formatInt(k.visits_month)} href="/visitas" />
        <Stat label="Clientes ativos" value={formatInt(k.active_clients)} hint="Compraram em 90 dias" />
        <Stat label="Oportunidades quentes" value={formatInt(k.hot_opportunities)} hint={`${formatBRLCompact(k.open_value)} no pipeline`} href="/pipeline?temperatura=quente" />
        <Stat label="Tarefas atrasadas" value={formatInt(k.overdue_tasks)} tone={k.overdue_tasks > 0 ? 'alert' : 'default'} href="/tarefas" />
      </div>

      {alerts.length > 0 && (
        <section className="mt-6">
          <SectionTitle>Atenção</SectionTitle>
          <AlertsPanel alerts={alerts} />
        </section>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Agenda de hoje" description="Tarefas de hoje e atrasadas" action={<Link href="/tarefas" className="text-sm font-medium text-brand">Todas</Link>} />
          <CardBody className="space-y-2">
            {agenda.length === 0 ? <p className="py-4 text-center text-sm text-muted">Nada pendente para hoje.</p> : agenda.map((t) => <TaskItem key={t.id} task={t} />)}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Próximos follow-ups" description="Próximos 7 dias" />
          <CardBody className="space-y-2">
            {upcoming.length === 0 ? <p className="py-4 text-center text-sm text-muted">Nenhum follow-up agendado.</p> : upcoming.map((t) => <TaskItem key={t.id} task={t} />)}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Meu pipeline" action={<Link href="/pipeline" className="text-sm font-medium text-brand">Abrir</Link>} />
          <CardBody>
            <Funnel stages={funnel} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Clientes sem contato" description="Há 30 dias ou mais" action={<Link href="/clientes?sem_contato=1&ordem=sem_contato" className="text-sm font-medium text-brand">Ver todos</Link>} />
          <CardBody>
            {(forgotten.data ?? []).length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">Todos os clientes com contato recente.</p>
            ) : (
              <ul className="divide-y divide-line">
                {((forgotten.data ?? []) as Pick<CompanyOverview, 'id' | 'display_name' | 'status' | 'days_without_contact' | 'city' | 'state'>[]).map((c) => (
                  <li key={c.id}>
                    <Link href={`/clientes/${c.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{c.display_name}</span>
                        <span className="text-xs text-muted">{c.city ? `${c.city}/${c.state}` : ''}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <TemperatureBadge value={c.status} />
                        <span className="num text-sm font-semibold text-red-600">{c.days_without_contact}d</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Últimas vendas" action={<Link href="/faturamento" className="text-sm font-medium text-brand">Minhas vendas</Link>} />
          <CardBody>
            {(sales.data ?? []).length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">Nenhuma venda faturada ainda.</p>
            ) : (
              <ul className="divide-y divide-line">
                {((sales.data ?? []) as InvoicedSaleRow[]).map((s) => (
                  <li key={s.id}>
                    <Link href={`/pedidos/${s.order_id}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{s.company_name}</span>
                        <span className="text-xs text-muted">#{s.order_number} · {formatDate(s.invoiced_at)}</span>
                      </span>
                      <span className="num text-sm font-semibold">{formatBRL(s.amount)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Minhas vendas por mês" />
          <CardBody>
            <MonthlyChart data={months} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
