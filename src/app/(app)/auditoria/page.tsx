import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { getCompanyOptions, getSellerOptions, one } from '@/lib/queries';
import { resolvePeriod } from '@/lib/periods';
import { formatDateTime } from '@/lib/format';
import { describeAudit } from '@/lib/feed';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/misc';
import { FilterBar } from '@/components/crm/filter-bar';
import { Pagination, pageRange } from '@/components/crm/pagination';
import type { AuditRow } from '@/types/db';

export const metadata: Metadata = { title: 'Auditoria' };

const TABLES: Record<string, string> = {
  companies: 'Cliente',
  contacts: 'Comprador',
  opportunities: 'Oportunidade',
  visits: 'Visita',
  orders: 'Pedido',
  sales: 'Faturamento',
  tasks: 'Tarefa',
  products: 'Produto',
  profiles: 'Usuário',
  organizations: 'Configuração',
};
const ACTIONS: Record<string, string> = {
  insert: 'Criação',
  update: 'Edição',
  stage_change: 'Mudança de etapa',
  status_change: 'Mudança de status',
  owner_change: 'Mudança de vendedor',
  value_change: 'Alteração de valor',
  archive: 'Arquivamento',
  delete: 'Exclusão',
};
const HIDDEN = new Set(['id', 'organization_id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'is_demo']);

function show(v: unknown) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export default async function AuditoriaPage({ searchParams }: PageProps<'/auditoria'>) {
  await requireAdmin();
  const sp = await searchParams;
  const range = resolvePeriod(sp, '12m');
  const { page, from, to } = pageRange(one(sp.pagina));
  const supabase = await createClient();
  let q = supabase
    .from('audit_feed')
    .select('*', { count: 'exact' })
    .gte('created_at', `${range.from}T00:00:00-03:00`)
    .lte('created_at', `${range.to}T23:59:59-03:00`);
  if (one(sp.tabela)) q = q.eq('table_name', one(sp.tabela)!);
  if (one(sp.acao)) q = q.eq('action', one(sp.acao)!);
  if (one(sp.usuario)) q = q.eq('actor_id', one(sp.usuario)!);
  if (one(sp.cliente)) q = q.eq('company_id', one(sp.cliente)!);
  const [{ data, count, error }, users, companies] = await Promise.all([
    q.order('created_at', { ascending: false }).range(from, to),
    getSellerOptions(),
    getCompanyOptions(),
  ]);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as AuditRow[];

  return (
    <>
      <PageHeader title="Auditoria" description="Quem criou ou alterou cada registro. Os registros não podem ser editados nem apagados." />
      <FilterBar
        fields={[
          { type: 'period', defaultPreset: '12m' },
          { type: 'select', name: 'tabela', label: 'Registro', options: Object.entries(TABLES).map(([value, label]) => ({ value, label })) },
          { type: 'select', name: 'acao', label: 'Ação', options: Object.entries(ACTIONS).map(([value, label]) => ({ value, label })) },
          { type: 'picker', name: 'usuario', label: 'Usuário', options: users },
          { type: 'picker', name: 'cliente', label: 'Cliente', options: companies },
        ]}
      />
      <Card className="overflow-hidden">
        <ul className="divide-y divide-line">
          {rows.map((r) => {
            const d = describeAudit(r);
            const fields = (r.changed_fields ?? []).filter((f) => !HIDDEN.has(f));
            return (
              <li key={r.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge>{TABLES[r.table_name] ?? r.table_name}</Badge>
                  <Badge className="bg-nori-900 text-white ring-nori-900">{ACTIONS[r.action] ?? r.action}</Badge>
                  <span className="font-medium">{r.actor_name ?? 'Sistema (automático)'}</span>
                  <span className="text-muted">· {formatDateTime(r.created_at)}</span>
                </div>
                <p className="mt-1 text-sm">{d?.text ?? r.company_label ?? ''}</p>
                {r.action !== 'insert' && fields.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted">{fields.length} campo(s) alterado(s)</summary>
                    <table className="mt-2 w-full text-xs">
                      <tbody>
                        {fields.map((f) => (
                          <tr key={f} className="border-t border-line">
                            <td className="py-1 pr-3 font-medium">{f}</td>
                            <td className="py-1 pr-3 text-red-700 line-through">{show(r.old_data?.[f])}</td>
                            <td className="py-1 text-green-700">{show(r.new_data?.[f])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                )}
              </li>
            );
          })}
          {rows.length === 0 && <li className="p-8 text-center text-sm text-muted">Nenhum registro no período.</li>}
        </ul>
      </Card>
      <Pagination page={page} total={count ?? 0} basePath="/auditoria" params={sp} />
    </>
  );
}
