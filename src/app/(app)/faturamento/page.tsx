import type { Metadata } from 'next';
import Link from 'next/link';
import { Receipt } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { getCompanyOptions, getProducts, getSellerOptions, one, searchTerm } from '@/lib/queries';
import { resolvePeriod } from '@/lib/periods';
import { OPTIONS, ORDER_STATUS } from '@/lib/constants';
import { formatBRL, formatDate, formatInt } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { EmptyState, PageHeader, Stat, StatusBadge } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { FilterBar } from '@/components/crm/filter-bar';
import { ExportButton } from '@/components/crm/export-button';
import { Pagination, pageRange } from '@/components/crm/pagination';
import type { BreakdownRow, InvoicedSaleRow } from '@/types/db';

export const metadata: Metadata = { title: 'Faturamento' };

export default async function FaturamentoPage({ searchParams }: PageProps<'/faturamento'>) {
  const session = await requireSession();
  const sp = await searchParams;
  const period = resolvePeriod(sp, 'mes');
  const { page, from, to } = pageRange(one(sp.pagina));
  const supabase = await createClient();
  const f = {
    seller: session.isAdmin ? (one(sp.vendedor) ?? null) : null,
    company: one(sp.cliente) ?? null,
    product: one(sp.produto) ?? null,
    category: one(sp.categoria) ?? null,
    city: searchTerm(one(sp.cidade)),
    state: one(sp.uf) ?? null,
  };

  let query = supabase
    .from('invoiced_sales')
    .select('*', { count: 'exact' })
    .gte('invoiced_at', `${period.from}T00:00:00-03:00`)
    .lte('invoiced_at', `${period.to}T23:59:59-03:00`);
  const situacao = one(sp.situacao) ?? 'ativa';
  if (situacao !== 'todas') query = query.eq('status', situacao);
  if (f.seller) query = query.eq('seller_id', f.seller);
  if (f.company) query = query.eq('company_id', f.company);
  if (f.product) query = query.contains('product_ids', [f.product]);
  if (f.category) query = query.contains('categories', [f.category]);
  if (f.city) query = query.ilike('city', `%${f.city}%`);
  if (f.state) query = query.eq('state', f.state);

  const [{ data, count, error }, totals, companies, products, sellers] = await Promise.all([
    query.order('invoiced_at', { ascending: false }).range(from, to),
    supabase.rpc('sales_breakdown', {
      p_group: 'state',
      p_from: period.from,
      p_to: period.to,
      p_seller: f.seller,
      p_company: f.company,
      p_product: f.product,
      p_category: f.category,
      p_city: f.city,
      p_state: f.state,
    }),
    getCompanyOptions(),
    getProducts(false),
    session.isAdmin ? getSellerOptions() : Promise.resolve([]),
  ]);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as InvoicedSaleRow[];
  const agg = ((totals.data ?? []) as BreakdownRow[]).reduce(
    (a, r) => ({ revenue: a.revenue + Number(r.revenue), volume: a.volume + Number(r.volume), orders: a.orders + Number(r.orders) }),
    { revenue: 0, volume: 0, orders: 0 },
  );
  const hasProductFilter = Boolean(f.product || f.category);

  return (
    <>
      <PageHeader
        title={session.isAdmin ? 'Faturamento' : 'Minhas vendas'}
        description={`Pedidos faturados · ${period.label}`}
        actions={<ExportButton entity="vendas" />}
      />
      <FilterBar
        fields={[
          { type: 'period', defaultPreset: 'mes' },
          ...(session.isAdmin ? [{ type: 'picker' as const, name: 'vendedor', label: 'Vendedor', options: sellers }] : []),
          { type: 'picker', name: 'cliente', label: 'Cliente', options: companies },
          { type: 'picker', name: 'produto', label: 'Produto', options: products.map((p) => ({ value: p.id, label: p.name, description: p.sku })) },
          { type: 'select', name: 'categoria', label: 'Categoria', options: OPTIONS.productCategory },
          { type: 'text', name: 'cidade', label: 'Cidade' },
          { type: 'select', name: 'uf', label: 'UF', options: OPTIONS.uf },
          { type: 'select', name: 'situacao', label: 'Situação', options: [{ value: 'cancelada', label: 'Estornados' }, { value: 'todas', label: 'Todos' }] },
        ]}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={hasProductFilter ? 'Faturado (produtos filtrados)' : 'Faturado'} value={formatBRL(agg.revenue)} />
        <Stat label="Volume" value={`${formatInt(agg.volume)} un.`} />
        <Stat label="Pedidos faturados" value={formatInt(agg.orders)} />
        <Stat label="Ticket médio" value={formatBRL(agg.orders ? agg.revenue / agg.orders : 0)} />
      </div>
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Receipt />} title="Nenhum faturamento com esses filtros" />
        </Card>
      ) : (
        <>
          <ul className="space-y-2 lg:hidden">
            {rows.map((s) => (
              <li key={s.id}>
                <Link href={`/pedidos/${s.order_id}`} className="block rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-line">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{s.company_name}</p>
                      <p className="text-xs text-muted">
                        #{s.order_number}
                        {s.invoice_number ? ` · NF ${s.invoice_number}` : ''} · {formatDate(s.invoiced_at)}
                        {session.isAdmin ? ` · ${s.seller_name}` : ''}
                      </p>
                    </div>
                    <p className="num font-semibold">{formatBRL(s.amount)}</p>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{s.product_summary}</p>
                  {s.status === 'cancelada' && <Badge className="mt-2 bg-red-50 text-red-700 ring-red-200">Estornado</Badge>}
                </Link>
              </li>
            ))}
          </ul>
          <Card className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-rice/60 text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">NF / Pedido</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  {session.isAdmin && <th className="px-4 py-3 font-medium">Vendedor</th>}
                  <th className="px-4 py-3 font-medium">Faturado em</th>
                  <th className="px-4 py-3 font-medium">Produtos</th>
                  <th className="px-4 py-3 text-right font-medium">Qtde</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((s) => (
                  <tr key={s.id} className="align-top hover:bg-rice/50">
                    <td className="px-4 py-3">
                      <Link href={`/pedidos/${s.order_id}`} className="font-medium hover:text-brand">
                        {s.invoice_number ?? '—'}
                      </Link>
                      <p className="text-xs text-muted">#{s.order_number}</p>
                    </td>
                    <td className="px-4 py-3">
                      {s.company_name}
                      <p className="text-xs text-muted">{s.city ? `${s.city}/${s.state}` : ''}</p>
                    </td>
                    {session.isAdmin && <td className="px-4 py-3">{s.seller_name}</td>}
                    <td className="px-4 py-3 text-muted">{formatDate(s.invoiced_at)}</td>
                    <td className="max-w-80 px-4 py-3 text-xs text-muted">{s.product_summary}</td>
                    <td className="num px-4 py-3 text-right">{formatInt(s.total_quantity)}</td>
                    <td className="num px-4 py-3 text-right font-semibold">{formatBRL(s.amount)}</td>
                    <td className="px-4 py-3">
                      {s.status === 'cancelada' ? (
                        <Badge className="bg-red-50 text-red-700 ring-red-200">Estornado</Badge>
                      ) : (
                        <StatusBadge meta={ORDER_STATUS[s.order_status]} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Pagination page={page} total={count ?? 0} basePath="/faturamento" params={sp} />
        </>
      )}
    </>
  );
}
