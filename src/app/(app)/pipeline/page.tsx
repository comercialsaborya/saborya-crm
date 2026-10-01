import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, Target } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { getSellerOptions, getStages, one, searchTerm } from '@/lib/queries';
import { OPTIONS } from '@/lib/constants';
import { addDaysISO, formatBRLCompact, todayISO } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { FilterBar } from '@/components/crm/filter-bar';
import { PipelineBoard } from '@/components/crm/pipeline-board';
import type { OpportunityBoardRow } from '@/types/db';

export const metadata: Metadata = { title: 'Pipeline' };

export default async function PipelinePage({ searchParams }: PageProps<'/pipeline'>) {
  const session = await requireSession();
  const sp = await searchParams;
  if (one(sp.op)) redirect(`/oportunidades/${one(sp.op)}`);
  const supabase = await createClient();
  const closedSince = addDaysISO(todayISO(), -30);

  let query = supabase
    .from('opportunity_board')
    .select('*')
    .is('deleted_at', null)
    .or(`and(is_won.eq.false,is_lost.eq.false),closed_at.gte.${closedSince}`);
  if (session.isAdmin && one(sp.vendedor)) query = query.eq('owner_id', one(sp.vendedor)!);
  if (one(sp.temperatura)) query = query.eq('temperature', one(sp.temperatura)!);
  const q = searchTerm(one(sp.q))?.toLowerCase();
  if (one(sp.sem_proxima)) query = query.is('next_activity_date', null).is('next_task_date', null);

  const [{ data, error }, stages, sellers] = await Promise.all([
    query.order('estimated_value', { ascending: false }).limit(1000),
    getStages(),
    session.isAdmin ? getSellerOptions() : Promise.resolve([]),
  ]);
  if (error) throw new Error(error.message);
  // Busca textual em memória (o filtro de etapas já usa o .or() da consulta).
  const rows = ((data ?? []) as OpportunityBoardRow[]).filter(
    (o) => !q || [o.title, o.company_name, o.contact_name].some((v) => v?.toLowerCase().includes(q)),
  );
  const open = rows.filter((o) => !o.is_won && !o.is_lost);
  const openValue = open.reduce((s, o) => s + Number(o.estimated_value), 0);

  return (
    <>
      <PageHeader
        title="Pipeline"
        description={`${open.length} oportunidade(s) abertas · ${formatBRLCompact(openValue)} em potencial · ganhas/perdidas dos últimos 30 dias`}
        actions={
          <Button asChild>
            <Link href="/oportunidades/nova">
              <Plus /> Nova oportunidade
            </Link>
          </Button>
        }
      />
      <FilterBar
        fields={[
          { type: 'search', name: 'q', placeholder: 'Cliente, título ou comprador' },
          ...(session.isAdmin ? [{ type: 'picker' as const, name: 'vendedor', label: 'Vendedor', options: sellers }] : []),
          { type: 'select', name: 'temperatura', label: 'Temperatura', options: OPTIONS.temperature },
          { type: 'select', name: 'sem_proxima', label: 'Próxima atividade', options: [{ value: '1', label: 'Sem próxima atividade' }] },
        ]}
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Target />}
            title="Nenhuma oportunidade"
            description="Oportunidades nascem de visitas com interesse ou podem ser criadas manualmente."
            action={
              <Button asChild>
                <Link href="/oportunidades/nova">
                  <Plus /> Nova oportunidade
                </Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <PipelineBoard stages={stages} opportunities={rows} showOwner={session.isAdmin} />
      )}
    </>
  );
}
