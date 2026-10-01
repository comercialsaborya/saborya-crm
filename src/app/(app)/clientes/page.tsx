import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { getSellerOptions, one, searchTerm } from '@/lib/queries';
import { OPTIONS, CLIENT_TYPE_LABELS } from '@/lib/constants';
import { formatBRLCompact, formatDate, formatShortDate, todayISO } from '@/lib/format';
import { onlyDigits, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, PageHeader, TemperatureBadge } from '@/components/ui/misc';
import { FilterBar } from '@/components/crm/filter-bar';
import { ExportButton } from '@/components/crm/export-button';
import { Pagination, pageRange } from '@/components/crm/pagination';
import type { CompanyOverview } from '@/types/db';

export const metadata: Metadata = { title: 'Clientes' };

export default async function ClientesPage({ searchParams }: PageProps<'/clientes'>) {
  const session = await requireSession();
  const sp = await searchParams;
  const { page, from, to } = pageRange(one(sp.pagina));
  const supabase = await createClient();

  let query = supabase
    .from('company_overview')
    .select('*', { count: 'exact' })
    .is('deleted_at', null);

  const q = searchTerm(one(sp.q));
  if (q) {
    const digits = onlyDigits(q);
    const ors = [`legal_name.ilike.*${q}*`, `trade_name.ilike.*${q}*`, `city.ilike.*${q}*`];
    if (digits.length >= 3) ors.push(`cnpj.ilike.*${digits}*`, `phone.ilike.*${digits}*`);
    query = query.or(ors.join(','));
  }
  if (one(sp.status)) query = query.eq('status', one(sp.status)!);
  if (one(sp.tipo)) query = query.eq('client_type', one(sp.tipo)!);
  if (one(sp.uf)) query = query.eq('state', one(sp.uf)!);
  if (one(sp.cidade)) query = query.ilike('city', `%${searchTerm(one(sp.cidade)) ?? ''}%`);
  if (session.isAdmin && one(sp.vendedor)) query = query.eq('owner_id', one(sp.vendedor)!);
  if (one(sp.sem_contato)) query = query.gte('days_without_contact', 30).neq('status', 'perdido');

  const order = one(sp.ordem);
  if (order === 'sem_contato') query = query.order('days_without_contact', { ascending: false });
  else if (order === 'faturamento') query = query.order('revenue_total', { ascending: false });
  else query = query.order('display_name');

  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as CompanyOverview[];
  const sellers = session.isAdmin ? await getSellerOptions() : [];
  const today = todayISO();

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Redes, supermercados, distribuidores e food service."
        actions={
          <>
            <ExportButton entity="clientes" />
            <Button asChild>
              <Link href="/clientes/novo">
                <Plus /> Novo cliente
              </Link>
            </Button>
          </>
        }
      />
      <FilterBar
        fields={[
          { type: 'search', name: 'q', placeholder: 'Nome, CNPJ, telefone ou cidade' },
          { type: 'select', name: 'status', label: 'Status', options: OPTIONS.temperature },
          { type: 'select', name: 'tipo', label: 'Tipo', options: OPTIONS.clientType },
          ...(session.isAdmin ? [{ type: 'picker' as const, name: 'vendedor', label: 'Vendedor', options: sellers }] : []),
          { type: 'select', name: 'uf', label: 'UF', options: OPTIONS.uf },
          { type: 'text', name: 'cidade', label: 'Cidade' },
          { type: 'select', name: 'sem_contato', label: 'Contato', options: [{ value: '1', label: 'Sem contato há 30+ dias' }] },
          {
            type: 'select',
            name: 'ordem',
            label: 'Ordenar',
            options: [
              { value: 'sem_contato', label: 'Mais tempo sem contato' },
              { value: 'faturamento', label: 'Maior faturamento' },
            ],
          },
        ]}
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Building2 />}
            title={q || Object.keys(sp).length ? 'Nenhum cliente com esses filtros' : 'Nenhum cliente cadastrado'}
            description="Cadastre o primeiro cliente para começar a registrar visitas e oportunidades."
            action={
              <Button asChild>
                <Link href="/clientes/novo">
                  <Plus /> Novo cliente
                </Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="space-y-2 md:hidden">
            {rows.map((c) => (
              <li key={c.id}>
                <Link href={`/clientes/${c.id}`} className="block rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-line active:bg-rice">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{c.display_name}</p>
                      <p className="truncate text-sm text-muted">
                        {CLIENT_TYPE_LABELS[c.client_type]}
                        {c.city ? ` · ${c.city}/${c.state ?? ''}` : ''}
                      </p>
                    </div>
                    <TemperatureBadge value={c.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted">
                    <span className={cn(c.days_without_contact >= 30 && c.status !== 'perdido' && 'font-semibold text-red-600')}>
                      {c.last_contact_at ? `Último contato há ${c.days_without_contact} dia(s)` : 'Nunca contatado'}
                    </span>
                    {c.next_action_date && (
                      <span className={cn(c.next_action_date < today && 'font-semibold text-red-600')}>
                        Próximo: {formatShortDate(c.next_action_date)}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: tabela */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-rice/60 text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Cidade</th>
                  {session.isAdmin && <th className="px-4 py-3 font-medium">Vendedor</th>}
                  <th className="px-4 py-3 font-medium">Último contato</th>
                  <th className="px-4 py-3 font-medium">Próximo contato</th>
                  <th className="px-4 py-3 text-right font-medium">Faturado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-rice/50">
                    <td className="max-w-72 px-4 py-3">
                      <Link href={`/clientes/${c.id}`} className="font-medium hover:text-brand">
                        {c.display_name}
                      </Link>
                      <p className="truncate text-xs text-muted">{CLIENT_TYPE_LABELS[c.client_type]}</p>
                    </td>
                    <td className="px-4 py-3">
                      <TemperatureBadge value={c.status} />
                    </td>
                    <td className="px-4 py-3 text-muted">{c.city ? `${c.city}/${c.state ?? ''}` : '—'}</td>
                    {session.isAdmin && <td className="px-4 py-3">{c.owner_name}</td>}
                    <td className={cn('px-4 py-3', c.days_without_contact >= 30 && c.status !== 'perdido' && 'font-medium text-red-600')}>
                      {c.last_contact_at ? `${formatDate(c.last_contact_at)} (${c.days_without_contact}d)` : 'Nunca'}
                    </td>
                    <td className={cn('px-4 py-3', c.next_action_date && c.next_action_date < today && 'font-medium text-red-600')}>
                      {formatDate(c.next_action_date)}
                    </td>
                    <td className="num px-4 py-3 text-right">{formatBRLCompact(c.revenue_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Pagination page={page} total={count ?? 0} basePath="/clientes" params={sp} />
        </>
      )}
    </>
  );
}
