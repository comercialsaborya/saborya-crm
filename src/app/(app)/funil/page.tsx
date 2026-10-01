import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { getSellerOptions, getStages, one } from '@/lib/queries';
import { resolvePeriod } from '@/lib/periods';
import { formatBRLCompact, formatInt, formatPercent } from '@/lib/format';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PageHeader, Stat, TemperatureBadge } from '@/components/ui/misc';
import { FilterBar } from '@/components/crm/filter-bar';
import { Funnel } from '@/components/charts/charts';
import type { FunnelHealth, FunnelRow, OpportunityBoardRow } from '@/types/db';

export const metadata: Metadata = { title: 'Saúde do funil' };

export default async function FunilPage({ searchParams }: PageProps<'/funil'>) {
  const session = await requireSession();
  const sp = await searchParams;
  const range = resolvePeriod(sp, '3m');
  const seller = session.isAdmin ? (one(sp.vendedor) ?? null) : null;
  const supabase = await createClient();
  const [health, funnel, stages, sellers] = await Promise.all([
    supabase.rpc('funnel_health', { p_from: range.from, p_to: range.to, p_seller: seller }),
    supabase.rpc('funnel_summary', { p_from: range.from, p_to: range.to, p_seller: seller }),
    getStages(),
    session.isAdmin ? getSellerOptions() : Promise.resolve([]),
  ]);
  const h = (health.data ?? {}) as FunnelHealth;
  const stalledDays = h.stalled_days ?? 14;

  let stalledQ = supabase
    .from('opportunity_board')
    .select('*')
    .is('deleted_at', null)
    .eq('is_won', false)
    .eq('is_lost', false)
    .gte('days_in_stage', stalledDays)
    .gte('days_without_contact', stalledDays);
  if (seller) stalledQ = stalledQ.eq('owner_id', seller);
  const { data: stalled } = await stalledQ.order('estimated_value', { ascending: false }).limit(15);

  const stageName = (k: string) => stages.find((s) => s.key === k)?.name ?? k;
  const durations = stages
    .filter((s) => !s.is_won && !s.is_lost)
    .map((s) => ({ key: s.key, name: s.name, days: h.avg_days_by_stage?.[s.key] ?? null }));
  const maxDays = Math.max(...durations.map((d) => d.days ?? 0), 1);

  return (
    <>
      <PageHeader title="Saúde do funil" description={`Pipeline atual · fechamentos em ${range.label.toLowerCase()}`} />
      <FilterBar
        fields={[
          { type: 'period', defaultPreset: '3m' },
          ...(session.isAdmin ? [{ type: 'picker' as const, name: 'vendedor', label: 'Vendedor', options: sellers }] : []),
        ]}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Oportunidades abertas" value={formatInt(h.total_open)} href="/pipeline" />
        <Stat label="Valor potencial" value={formatBRLCompact(h.potential_value)} hint={`${formatBRLCompact(h.hot_value)} em oportunidades quentes`} />
        <Stat label="Em negociação / pedido" value={formatBRLCompact(h.negotiation_value)} />
        <Stat label="Vendido (ganhas)" value={formatBRLCompact(h.won_value)} hint={`${h.won_count ?? 0} ganha(s) · ${h.lost_count ?? 0} perdida(s)`} />
        <Stat label="Taxa de conversão" value={formatPercent(h.conversion_rate)} hint="Ganhas ÷ fechadas no período" />
        <Stat label="Ciclo médio de venda" value={h.avg_cycle_days != null ? `${h.avg_cycle_days} dias` : '—'} hint="Da criação ao ganho" />
        <Stat label="Oportunidades paradas" value={formatInt(h.stalled_count)} tone={h.stalled_count > 0 ? 'alert' : 'default'} hint={`${stalledDays}+ dias sem movimento · ${formatBRLCompact(h.stalled_value)}`} />
        <Stat label="Sem próxima atividade" value={formatInt(h.without_next_action)} tone={h.without_next_action > 0 ? 'alert' : 'default'} href="/pipeline?sem_proxima=1" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Funil por etapa" />
          <CardBody>
            <Funnel
              stages={((funnel.data ?? []) as FunnelRow[]).map((f) => ({
                key: f.stage_key,
                name: f.name,
                color: f.color,
                count: Number(f.opportunities),
                value: Number(f.value),
                closed: f.is_won || f.is_lost,
              }))}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Tempo médio por etapa" description="Dias até sair da etapa (últimos 12 meses)" />
          <CardBody>
            <ul className="space-y-2">
              {durations.map((d) => (
                <li key={d.key} className="grid grid-cols-[9rem_1fr_4rem] items-center gap-3 text-sm">
                  <span className="truncate text-muted">{d.name}</span>
                  <div className="h-2 rounded-full bg-line/60">
                    <div
                      className={`h-2 rounded-full ${d.days != null && d.days > stalledDays ? 'bg-red-500' : 'bg-nori-700'}`}
                      style={{ width: `${d.days ? Math.max((d.days / maxDays) * 100, 3) : 0}%` }}
                    />
                  </div>
                  <span className="num text-right font-medium">{d.days != null ? `${d.days}d` : '—'}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">Em vermelho: etapas acima de {stalledDays} dias em média.</p>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Oportunidades paradas" description={`Sem movimento de etapa e sem contato há ${stalledDays}+ dias`} />
        <CardBody>
          {(stalled ?? []).length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">Nenhuma oportunidade parada. 👏</p>
          ) : (
            <ul className="divide-y divide-line">
              {((stalled ?? []) as OpportunityBoardRow[]).map((o) => (
                <li key={o.id}>
                  <Link href={`/oportunidades/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:opacity-80">
                    <span className="min-w-0">
                      <span className="block font-medium">{o.company_name} — {o.title}</span>
                      <span className="text-xs text-muted">
                        {stageName(o.stage_key)} há {o.days_in_stage} dias · {o.days_without_contact} dias sem contato
                        {session.isAdmin ? ` · ${o.owner_name}` : ''}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <TemperatureBadge value={o.temperature} />
                      <span className="num font-semibold">{formatBRLCompact(o.estimated_value)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}
