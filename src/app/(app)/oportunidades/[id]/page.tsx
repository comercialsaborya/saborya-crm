import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, ShoppingCart } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { getCompanyOptions, getContactOptions, getSellerOptions, getStages } from '@/lib/queries';
import { formatBRL, formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PageHeader, TemperatureBadge } from '@/components/ui/misc';
import { OpportunityForm } from '@/components/crm/opportunity-form';
import { Timeline, activityTitle } from '@/components/crm/timeline';
import { ArchiveOpportunityButton } from './archive-button';
import type { ActivityRow, OpportunityBoardRow } from '@/types/db';

export const metadata: Metadata = { title: 'Oportunidade' };

export default async function OportunidadePage({ params }: PageProps<'/oportunidades/[id]'>) {
  const { id } = await params;
  const session = await requireSession();
  const supabase = await createClient();
  const { data: opp } = await supabase.from('opportunity_board').select('*').eq('id', id).is('deleted_at', null).maybeSingle<OpportunityBoardRow>();
  if (!opp) notFound();
  const [history, acts, companies, contacts, stages, sellers] = await Promise.all([
    supabase.from('opportunity_stage_history').select('*').eq('opportunity_id', id).order('changed_at', { ascending: false }),
    supabase.from('activity_list').select('*').eq('opportunity_id', id).is('deleted_at', null).order('occurred_at', { ascending: false }).limit(50),
    getCompanyOptions(),
    getContactOptions(),
    getStages(),
    session.isAdmin ? getSellerOptions() : Promise.resolve(undefined),
  ]);
  const stageName = (k: string | null) => stages.find((s) => s.key === k)?.name ?? k ?? '—';

  return (
    <>
      <PageHeader
        title={opp.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/clientes/${opp.company_id}`} className="font-medium text-brand">
              {opp.company_name}
            </Link>
            · {opp.stage_name} · <span className="num font-semibold text-ink">{formatBRL(opp.estimated_value)}</span>
            <TemperatureBadge value={opp.temperature} />
          </span>
        }
        back={{ href: '/pipeline', label: 'Pipeline' }}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href={`/visitas/nova?cliente=${opp.company_id}&oportunidade=${opp.id}`}>
                <MapPin /> Visita
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/pedidos/novo?cliente=${opp.company_id}&oportunidade=${opp.id}${opp.contact_id ? `&comprador=${opp.contact_id}` : ''}`}>
                <ShoppingCart /> Pedido
              </Link>
            </Button>
            <ArchiveOpportunityButton id={opp.id} />
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OpportunityForm opportunity={opp} companies={companies} contacts={contacts} stages={stages} sellers={sellers} />
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Histórico de etapas" description="Registrado automaticamente a cada movimentação." />
            <CardBody>
              <ol className="space-y-3">
                {(history.data ?? []).map((h) => (
                  <li key={h.id} className="text-sm">
                    <p className="font-medium">
                      {h.from_stage ? `${stageName(h.from_stage)} → ${stageName(h.to_stage)}` : `Criada em ${stageName(h.to_stage)}`}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDateTime(h.changed_at)}
                      {h.seconds_in_previous_stage != null && ` · ${Math.round(Number(h.seconds_in_previous_stage) / 86400)} dia(s) na etapa anterior`}
                    </p>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Atividades" />
            <CardBody>
              <Timeline
                items={((acts.data ?? []) as ActivityRow[]).map((a) => ({
                  id: a.id,
                  at: a.occurred_at,
                  kind: a.type,
                  title: activityTitle(a.type, a.description),
                  detail: a.result,
                  by: a.owner_name,
                }))}
                empty="Nenhuma atividade vinculada."
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
