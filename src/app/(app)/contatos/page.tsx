import type { Metadata } from 'next';
import Link from 'next/link';
import { Contact as ContactIcon, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { one, searchTerm } from '@/lib/queries';
import { formatPhone } from '@/lib/format';
import { onlyDigits } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { FilterBar } from '@/components/crm/filter-bar';
import { ExportButton } from '@/components/crm/export-button';
import { ContactActions } from '@/components/crm/contact-actions';
import { Pagination, pageRange } from '@/components/crm/pagination';
import { OPTIONS } from '@/lib/constants';
import type { ContactListRow } from '@/types/db';

export const metadata: Metadata = { title: 'Compradores' };

export default async function ContatosPage({ searchParams }: PageProps<'/contatos'>) {
  await requireSession();
  const sp = await searchParams;
  const { page, from, to } = pageRange(one(sp.pagina));
  const supabase = await createClient();
  let query = supabase.from('contact_list').select('*', { count: 'exact' }).is('deleted_at', null);
  const q = searchTerm(one(sp.q));
  if (q) {
    const d = onlyDigits(q);
    const ors = [`name.ilike.*${q}*`, `job_title.ilike.*${q}*`, `company_name.ilike.*${q}*`, `email.ilike.*${q}*`];
    if (d.length >= 3) ors.push(`phone.ilike.*${d}*`, `whatsapp.ilike.*${d}*`);
    query = query.or(ors.join(','));
  }
  if (one(sp.uf)) query = query.eq('state', one(sp.uf)!);
  const { data, count, error } = await query.order('company_name').order('name').range(from, to);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ContactListRow[];

  return (
    <>
      <PageHeader
        title="Compradores"
        description="Quem decide a compra em cada cliente."
        actions={
          <>
            <ExportButton entity="contatos" />
            <Button asChild>
              <Link href="/contatos/novo">
                <Plus /> Novo comprador
              </Link>
            </Button>
          </>
        }
      />
      <FilterBar
        fields={[
          { type: 'search', name: 'q', placeholder: 'Nome, cargo, cliente, telefone' },
          { type: 'select', name: 'uf', label: 'UF', options: OPTIONS.uf },
        ]}
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ContactIcon />}
            title="Nenhum comprador encontrado"
            description="Cadastre quem decide a compra em cada cliente."
            action={
              <Button asChild>
                <Link href="/contatos/novo">
                  <Plus /> Novo comprador
                </Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((c) => (
              <Card key={c.id} className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.name}</p>
                    <p className="truncate text-sm text-muted">{c.job_title || '—'}</p>
                    <Link href={`/clientes/${c.company_id}`} className="block truncate text-sm font-medium text-brand">
                      {c.company_name}
                    </Link>
                  </div>
                  <Link href={`/contatos/${c.id}/editar`} className="shrink-0 text-xs text-muted hover:text-ink">
                    Editar
                  </Link>
                </div>
                <p className="text-xs text-muted">
                  {[c.whatsapp && `WhatsApp ${formatPhone(c.whatsapp)}`, c.best_contact_time && `Melhor horário: ${c.best_contact_time}`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <ContactActions size="sm" whatsapp={c.whatsapp} phone={c.phone} />
              </Card>
            ))}
          </div>
          <Pagination page={page} total={count ?? 0} basePath="/contatos" params={sp} />
        </>
      )}
    </>
  );
}
