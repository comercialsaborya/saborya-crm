import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { getSellerOptions, one } from '@/lib/queries';
import { resolvePeriod } from '@/lib/periods';
import { OPTIONS, VISIT_RESULT_LABELS, VISIT_TYPE_LABELS } from '@/lib/constants';
import { formatBRLCompact, formatDateTime, mapsCoordsLink } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { FilterBar } from '@/components/crm/filter-bar';
import { ExportButton } from '@/components/crm/export-button';
import { Pagination, pageRange } from '@/components/crm/pagination';
import type { VisitRow } from '@/types/db';

export const metadata: Metadata = { title: 'Visitas' };

export default async function VisitasPage({ searchParams }: PageProps<'/visitas'>) {
  const session = await requireSession();
  const sp = await searchParams;
  const period = resolvePeriod(sp, 'mes');
  const { page, from, to } = pageRange(one(sp.pagina));
  const supabase = await createClient();
  let query = supabase
    .from('visit_list')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .gte('visited_at', `${period.from}T00:00:00-03:00`)
    .lte('visited_at', `${period.to}T23:59:59-03:00`);
  if (one(sp.resultado)) query = query.eq('result', one(sp.resultado)!);
  if (one(sp.tipo)) query = query.eq('visit_type', one(sp.tipo)!);
  if (session.isAdmin && one(sp.vendedor)) query = query.eq('owner_id', one(sp.vendedor)!);
  if (one(sp.uf)) query = query.eq('state', one(sp.uf)!);
  const { data, count, error } = await query.order('visited_at', { ascending: false }).range(from, to);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as VisitRow[];
  const sellers = session.isAdmin ? await getSellerOptions() : [];

  return (
    <>
      <PageHeader
        title="Visitas"
        description={`${count ?? 0} visita(s) · ${period.label}`}
        actions={
          <>
            <ExportButton entity="visitas" />
            <Button asChild size="lg">
              <Link href="/visitas/nova">
                <MapPin /> Registrar visita
              </Link>
            </Button>
          </>
        }
      />
      <FilterBar
        fields={[
          { type: 'period', defaultPreset: 'mes' },
          ...(session.isAdmin ? [{ type: 'picker' as const, name: 'vendedor', label: 'Vendedor', options: sellers }] : []),
          { type: 'select', name: 'resultado', label: 'Resultado', options: OPTIONS.visitResult },
          { type: 'select', name: 'tipo', label: 'Tipo', options: OPTIONS.visitType },
          { type: 'select', name: 'uf', label: 'UF', options: OPTIONS.uf },
        ]}
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<MapPin />}
            title="Nenhuma visita no período"
            description="Registre a visita ainda no cliente — leva menos de um minuto."
            action={
              <Button asChild>
                <Link href="/visitas/nova">Registrar visita</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <ul className="space-y-2">
            {rows.map((v) => (
              <li key={v.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/clientes/${v.company_id}`} className="font-semibold hover:text-brand">
                        {v.company_name}
                      </Link>
                      <p className="text-sm text-muted">
                        {formatDateTime(v.visited_at)} · {VISIT_TYPE_LABELS[v.visit_type]}
                        {v.contact_name ? ` · com ${v.contact_name}` : ''}
                        {session.isAdmin && v.owner_name ? ` · ${v.owner_name}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {v.potential_value ? <span className="num text-sm font-semibold">{formatBRLCompact(v.potential_value)}</span> : null}
                      <Badge>{VISIT_RESULT_LABELS[v.result]}</Badge>
                    </div>
                  </div>
                  {(v.objective || v.notes) && <p className="mt-2 text-sm">{[v.objective, v.notes].filter(Boolean).join(' — ')}</p>}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    {v.next_step && <span>Próximo passo: {v.next_step}</span>}
                    {v.product_names.length > 0 && <span>Apresentou: {v.product_names.join(', ')}</span>}
                    {v.latitude != null && (
                      <a href={mapsCoordsLink(v.latitude, v.longitude)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-700">
                        <MapPin className="size-3" /> Ver localização
                      </a>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          <Pagination page={page} total={count ?? 0} basePath="/visitas" params={sp} />
        </>
      )}
    </>
  );
}
