import type { Metadata } from 'next';
import Link from 'next/link';
import { Activity, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { getSellerOptions, one } from '@/lib/queries';
import { resolvePeriod } from '@/lib/periods';
import { OPTIONS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { FilterBar } from '@/components/crm/filter-bar';
import { ExportButton } from '@/components/crm/export-button';
import { Pagination, pageRange } from '@/components/crm/pagination';
import { Timeline, activityTitle } from '@/components/crm/timeline';
import type { ActivityRow } from '@/types/db';

export const metadata: Metadata = { title: 'Atividades' };

export default async function AtividadesPage({ searchParams }: PageProps<'/atividades'>) {
  const session = await requireSession();
  const sp = await searchParams;
  const period = resolvePeriod(sp, 'semana');
  const { page, from, to } = pageRange(one(sp.pagina));
  const supabase = await createClient();
  let query = supabase
    .from('activity_list')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .gte('occurred_at', `${period.from}T00:00:00-03:00`)
    .lte('occurred_at', `${period.to}T23:59:59-03:00`);
  if (one(sp.tipo)) query = query.eq('type', one(sp.tipo)!);
  if (session.isAdmin && one(sp.vendedor)) query = query.eq('owner_id', one(sp.vendedor)!);
  const { data, count, error } = await query.order('occurred_at', { ascending: false }).range(from, to);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ActivityRow[];
  const sellers = session.isAdmin ? await getSellerOptions() : [];

  return (
    <>
      <PageHeader
        title="Atividades"
        description={`${count ?? 0} interação(ões) · ${period.label}`}
        actions={
          <>
            <ExportButton entity="atividades" />
            <Button asChild>
              <Link href="/atividades/nova">
                <Plus /> Nova atividade
              </Link>
            </Button>
          </>
        }
      />
      <FilterBar
        fields={[
          { type: 'period', defaultPreset: 'semana' },
          ...(session.isAdmin ? [{ type: 'picker' as const, name: 'vendedor', label: 'Vendedor', options: sellers }] : []),
          { type: 'select', name: 'tipo', label: 'Tipo', options: OPTIONS.activityType },
        ]}
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Activity />} title="Nenhuma atividade no período" />
        </Card>
      ) : (
        <Card>
          <CardBody>
            <Timeline
              items={rows.map((a) => ({
                id: a.id,
                at: a.occurred_at,
                kind: a.type,
                title: `${a.company_name ?? 'Cliente'} — ${activityTitle(a.type, a.description)}`,
                detail: [a.contact_name && `Com ${a.contact_name}`, a.result].filter(Boolean).join(' — ') || null,
                by: session.isAdmin ? a.owner_name : null,
                href: `/clientes/${a.company_id}?aba=timeline`,
                next: a.next_action ? { label: a.next_action, date: a.next_action_date } : null,
              }))}
            />
          </CardBody>
        </Card>
      )}
      <Pagination page={page} total={count ?? 0} basePath="/atividades" params={sp} />
    </>
  );
}
