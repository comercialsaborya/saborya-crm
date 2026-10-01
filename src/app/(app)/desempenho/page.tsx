import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { one } from '@/lib/queries';
import { resolvePeriod } from '@/lib/periods';
import { formatBRL, formatBRLCompact, formatInt, formatPercent } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/misc';
import { FilterBar } from '@/components/crm/filter-bar';
import { GrowthHint } from '@/components/dashboard/kpi';
import type { SellerPerformanceRow } from '@/types/db';

export const metadata: Metadata = { title: 'Desempenho' };

const METRICS: { key: keyof SellerPerformanceRow; label: string; fmt: (v: SellerPerformanceRow[keyof SellerPerformanceRow]) => string }[] = [
  { key: 'revenue', label: 'Faturamento', fmt: (v) => formatBRL(v as number) },
  { key: 'orders', label: 'Pedidos', fmt: (v) => formatInt(v as number) },
  { key: 'avg_ticket', label: 'Ticket médio', fmt: (v) => formatBRL(v as number) },
  { key: 'volume', label: 'Volume', fmt: (v) => `${formatInt(v as number)} un.` },
  { key: 'visits', label: 'Visitas', fmt: (v) => formatInt(v as number) },
  { key: 'new_clients', label: 'Clientes novos', fmt: (v) => formatInt(v as number) },
  { key: 'active_clients', label: 'Clientes ativos (90d)', fmt: (v) => formatInt(v as number) },
  { key: 'open_opportunities', label: 'Oportunidades abertas', fmt: (v) => formatInt(v as number) },
  { key: 'open_value', label: 'Valor no pipeline', fmt: (v) => formatBRLCompact(v as number) },
  { key: 'conversion_rate', label: 'Conversão', fmt: (v) => formatPercent(v as number | null) },
];

export default async function DesempenhoPage({ searchParams }: PageProps<'/desempenho'>) {
  await requireAdmin();
  const sp = await searchParams;
  const range = resolvePeriod(sp, 'mes');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('seller_performance', { p_from: range.from, p_to: range.to });
  if (error) throw new Error(error.message);
  const focus = one(sp.vendedor);
  const rows = ((data ?? []) as SellerPerformanceRow[]).filter((r) => !focus || r.seller_id === focus);

  return (
    <>
      <PageHeader
        title="Desempenho da equipe"
        description={`Indicadores individuais · ${range.label}. Comparativo para gestão, sem ranking.`}
      />
      <FilterBar fields={[{ type: 'period', defaultPreset: 'mes' }]} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <Card key={r.seller_id} className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">
                  {r.seller_name} {!r.active && <Badge>Inativo</Badge>}
                </p>
                <p className="num mt-1 text-2xl font-semibold">{formatBRL(r.revenue)}</p>
                <p className="text-xs">
                  <GrowthHint value={r.growth_percent === null ? null : Number(r.growth_percent)} label="vs. período anterior" />
                </p>
              </div>
              <Link href={`/?vendedor=${r.seller_id}&periodo=${range.preset}`} className="text-sm font-medium text-brand">
                Painel
              </Link>
            </div>
            <dl className="num mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {METRICS.slice(1).map((m) => (
                <div key={m.key} className="flex justify-between gap-2 border-b border-line pb-1">
                  <dt className="text-muted">{m.label}</dt>
                  <dd className="font-medium">{m.fmt(r[m.key])}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ))}
      </div>
      {rows.length > 1 && (
        <Card className="mt-6 hidden overflow-x-auto lg:block">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-rice/60 text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Vendedor</th>
                {METRICS.map((m) => (
                  <th key={m.key} className="px-3 py-3 text-right font-medium">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="num divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.seller_id}>
                  <td className="px-4 py-3 font-medium">{r.seller_name}</td>
                  {METRICS.map((m) => (
                    <td key={m.key} className="px-3 py-3 text-right">
                      {m.fmt(r[m.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
