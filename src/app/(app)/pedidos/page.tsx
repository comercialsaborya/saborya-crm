import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, ShoppingCart } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { getCompanyOptions, getSellerOptions, one } from '@/lib/queries';
import { resolvePeriod } from '@/lib/periods';
import { OPTIONS, ORDER_STATUS } from '@/lib/constants';
import { formatBRL, formatDate, formatInt } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, PageHeader, StatusBadge } from '@/components/ui/misc';
import { FilterBar } from '@/components/crm/filter-bar';
import { ExportButton } from '@/components/crm/export-button';
import { Pagination, pageRange } from '@/components/crm/pagination';
import type { OrderRow } from '@/types/db';

export const metadata: Metadata = { title: 'Pedidos' };

export default async function PedidosPage({ searchParams }: PageProps<'/pedidos'>) {
  const session = await requireSession();
  const sp = await searchParams;
  const period = resolvePeriod(sp, '3m');
  const { page, from, to } = pageRange(one(sp.pagina));
  const supabase = await createClient();
  let query = supabase
    .from('order_list')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .gte('order_date', period.from)
    .lte('order_date', period.to);
  if (one(sp.status)) query = query.eq('status', one(sp.status)!);
  if (one(sp.cliente)) query = query.eq('company_id', one(sp.cliente)!);
  if (session.isAdmin && one(sp.vendedor)) query = query.eq('owner_id', one(sp.vendedor)!);
  const num = Number(one(sp.numero));
  if (num) query = query.eq('order_number', num);
  const { data, count, error } = await query.order('order_date', { ascending: false }).order('order_number', { ascending: false }).range(from, to);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as OrderRow[];
  const [companies, sellers] = await Promise.all([getCompanyOptions(), session.isAdmin ? getSellerOptions() : Promise.resolve([])]);

  return (
    <>
      <PageHeader
        title="Pedidos"
        description={`${count ?? 0} pedido(s) · ${period.label}`}
        actions={
          <>
            <ExportButton entity="pedidos" />
            <Button asChild>
              <Link href="/pedidos/novo">
                <Plus /> Novo pedido
              </Link>
            </Button>
          </>
        }
      />
      <FilterBar
        fields={[
          { type: 'period', defaultPreset: '3m' },
          { type: 'select', name: 'status', label: 'Status', options: OPTIONS.orderStatus },
          { type: 'picker', name: 'cliente', label: 'Cliente', options: companies },
          ...(session.isAdmin ? [{ type: 'picker' as const, name: 'vendedor', label: 'Vendedor', options: sellers }] : []),
          { type: 'text', name: 'numero', label: 'Nº do pedido' },
        ]}
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ShoppingCart />}
            title="Nenhum pedido no período"
            action={
              <Button asChild>
                <Link href="/pedidos/novo">
                  <Plus /> Novo pedido
                </Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <ul className="space-y-2 md:hidden">
            {rows.map((o) => (
              <li key={o.id}>
                <Link href={`/pedidos/${o.id}`} className="block rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-line">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">#{o.order_number} · {o.company_name}</p>
                      <p className="text-xs text-muted">
                        {formatDate(o.order_date)} · {formatInt(o.total_quantity)} un.{session.isAdmin && o.owner_name ? ` · ${o.owner_name}` : ''}
                      </p>
                    </div>
                    <p className="num font-semibold">{formatBRL(o.total)}</p>
                  </div>
                  <StatusBadge meta={ORDER_STATUS[o.status]} className="mt-2" />
                </Link>
              </li>
            ))}
          </ul>
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-rice/60 text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Pedido</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  {session.isAdmin && <th className="px-4 py-3 font-medium">Vendedor</th>}
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Volume</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((o) => (
                  <tr key={o.id} className="hover:bg-rice/50">
                    <td className="px-4 py-3">
                      <Link href={`/pedidos/${o.id}`} className="font-medium hover:text-brand">
                        #{o.order_number}
                      </Link>
                      {o.invoice_number && <p className="text-xs text-muted">NF {o.invoice_number}</p>}
                    </td>
                    <td className="max-w-64 truncate px-4 py-3">{o.company_name}</td>
                    <td className="px-4 py-3 text-muted">{formatDate(o.order_date)}</td>
                    {session.isAdmin && <td className="px-4 py-3">{o.owner_name}</td>}
                    <td className="px-4 py-3">
                      <StatusBadge meta={ORDER_STATUS[o.status]} />
                    </td>
                    <td className="num px-4 py-3 text-right">{formatInt(o.total_quantity)} un.</td>
                    <td className="num px-4 py-3 text-right font-semibold">{formatBRL(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Pagination page={page} total={count ?? 0} basePath="/pedidos" params={sp} />
        </>
      )}
    </>
  );
}
