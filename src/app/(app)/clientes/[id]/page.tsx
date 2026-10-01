import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, Pencil, Plus, ShoppingCart, Target, Globe, AtSign, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { getCompanyOptions, getContactOptions, one } from '@/lib/queries';
import {
  CLIENT_TYPE_LABELS,
  ORDER_STATUS,
  VISIT_RESULT_LABELS,
  VISIT_TYPE_LABELS,
  TEMPERATURE,
  type Temperature,
} from '@/lib/constants';
import {
  formatBRL,
  formatBRLCompact,
  formatCNPJ,
  formatDate,
  formatDateTime,
  formatInt,
  formatPhone,
  mapsCoordsLink,
  relativeTime,
  todayISO,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState, StatusBadge, TemperatureBadge } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { ContactActions } from '@/components/crm/contact-actions';
import { ContactDialog } from '@/components/crm/contact-dialog';
import { StatusSelector } from '@/components/crm/status-selector';
import { TaskItem } from '@/components/crm/task-item';
import { NewTaskButton } from '@/components/crm/task-form';
import { Timeline, activityTitle, type TimelineItem } from '@/components/crm/timeline';
import type {
  ActivityRow,
  BreakdownRow,
  CompanyOverview,
  Contact,
  OpportunityBoardRow,
  OrderRow,
  TaskRow,
  VisitRow,
} from '@/types/db';

export const metadata: Metadata = { title: 'Cliente' };

const TABS = [
  { key: 'resumo', label: 'Resumo' },
  { key: 'contatos', label: 'Compradores' },
  { key: 'oportunidades', label: 'Oportunidades' },
  { key: 'timeline', label: 'Linha do tempo' },
  { key: 'visitas', label: 'Visitas' },
  { key: 'pedidos', label: 'Pedidos e vendas' },
  { key: 'produtos', label: 'Produtos comprados' },
  { key: 'historico', label: 'Histórico' },
] as const;

export default async function ClientePage({ params, searchParams }: PageProps<'/clientes/[id]'>) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = (TABS.find((t) => t.key === one(sp.aba))?.key ?? 'resumo') as (typeof TABS)[number]['key'];
  const session = await requireSession();
  const supabase = await createClient();

  const { data: company } = await supabase.from('company_overview').select('*').eq('id', id).maybeSingle<CompanyOverview>();
  if (!company) notFound();

  const [contactsR, oppsR, activitiesR, visitsR, ordersR, tasksR, statusR, stageR, productsR, companies, contactOpts] =
    await Promise.all([
      supabase.from('contacts').select('*').eq('company_id', id).is('deleted_at', null).order('is_primary', { ascending: false }).order('name'),
      supabase.from('opportunity_board').select('*').eq('company_id', id).is('deleted_at', null).order('stage_position'),
      supabase.from('activity_list').select('*').eq('company_id', id).is('deleted_at', null).order('occurred_at', { ascending: false }).limit(100),
      supabase.from('visit_list').select('*').eq('company_id', id).is('deleted_at', null).order('visited_at', { ascending: false }).limit(50),
      supabase.from('order_list').select('*').eq('company_id', id).is('deleted_at', null).order('order_date', { ascending: false }).limit(50),
      supabase.from('task_list').select('*').eq('company_id', id).eq('status', 'pendente').is('deleted_at', null).order('due_date'),
      supabase.from('company_status_history').select('id, from_status, to_status, changed_at, changed_by').eq('company_id', id).order('changed_at', { ascending: false }),
      supabase
        .from('opportunity_stage_history')
        .select('id, from_stage, to_stage, changed_at, opportunity_id, opportunities!inner(company_id, title)')
        .eq('opportunities.company_id', id)
        .order('changed_at', { ascending: false })
        .limit(100),
      supabase.rpc('sales_breakdown', { p_group: 'product', p_from: '2000-01-01', p_to: todayISO(), p_company: id }),
      getCompanyOptions(),
      getContactOptions(),
    ]);

  const contacts = (contactsR.data ?? []) as Contact[];
  const opps = (oppsR.data ?? []) as OpportunityBoardRow[];
  const activities = (activitiesR.data ?? []) as ActivityRow[];
  const visits = (visitsR.data ?? []) as VisitRow[];
  const orders = (ordersR.data ?? []) as OrderRow[];
  const tasks = (tasksR.data ?? []) as TaskRow[];
  const products = (productsR.data ?? []) as BreakdownRow[];
  const primary = contacts[0];
  const openOpps = opps.filter((o) => !o.is_won && !o.is_lost);

  const timeline: TimelineItem[] = [
    ...activities.map((a) => ({
      id: a.id,
      at: a.occurred_at,
      kind: a.type,
      title: activityTitle(a.type, a.description),
      detail: [a.contact_name && `Com ${a.contact_name}`, a.result].filter(Boolean).join(' — ') || null,
      by: a.owner_name,
      href: a.order_id ? `/pedidos/${a.order_id}` : undefined,
      next: a.next_action ? { label: a.next_action, date: a.next_action_date } : null,
    })),
    ...(statusR.data ?? [])
      .filter((s) => s.from_status)
      .map((s) => ({
        id: s.id,
        at: s.changed_at,
        kind: 'status' as const,
        title: `Status: ${TEMPERATURE[s.from_status as Temperature].label} → ${TEMPERATURE[s.to_status as Temperature].label}`,
      })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  const tabHref = (k: string) => (k === 'resumo' ? `/clientes/${id}` : `/clientes/${id}?aba=${k}`);

  return (
    <>
      {/* Cabeçalho */}
      <div className="mb-4">
        <Link href="/clientes" className="text-sm text-muted hover:text-ink">
          ‹ Clientes
        </Link>
        <div className="mt-1 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{company.display_name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
              <StatusSelector companyId={id} value={company.status} />
              <span>{CLIENT_TYPE_LABELS[company.client_type]}</span>
              {company.city && (
                <span>
                  {company.city}/{company.state}
                </span>
              )}
              <span>
                Vendedor: <span className="font-medium text-ink">{company.owner_name ?? '—'}</span>
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="lg" className="flex-1 sm:flex-none">
              <Link href={`/visitas/nova?cliente=${id}`}>
                <MapPin /> Registrar visita
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href={`/clientes/${id}/editar`} aria-label="Editar cliente">
                <Pencil />
                <span className="hidden sm:inline">Editar</span>
              </Link>
            </Button>
          </div>
        </div>
        <ContactActions
          className="mt-3"
          whatsapp={primary?.whatsapp ?? company.phone}
          phone={primary?.phone ?? company.phone}
          address={company.address || company.city ? [company.address, company.city, company.state] : undefined}
        />
      </div>

      {/* Indicadores do cliente */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Faturado (total)" value={formatBRLCompact(company.revenue_total)} hint={`${company.invoiced_orders} pedido(s)`} />
        <Kpi label="Volume (total)" value={`${formatInt(company.volume_total)} un.`} hint={company.last_purchase_at ? `Última compra ${relativeTime(company.last_purchase_at)}` : 'Ainda não comprou'} />
        <Kpi label="Em negociação" value={formatBRLCompact(company.open_value)} hint={`${company.open_opportunities} oportunidade(s) aberta(s)`} />
        <Kpi
          label="Último contato"
          value={company.last_contact_at ? `${company.days_without_contact} dia(s)` : 'Nunca'}
          alert={company.days_without_contact >= 30 && company.status !== 'perdido'}
          hint={company.next_action_date ? `Próximo: ${formatDate(company.next_action_date)}` : 'Sem próximo contato'}
        />
      </div>

      {/* Abas */}
      <nav className="scrollbar-thin -mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0" aria-label="Seções do cliente">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            scroll={false}
            aria-current={tab === t.key ? 'page' : undefined}
            className={cn(
              '-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium',
              tab === t.key ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {t.label}
            {t.key === 'contatos' && contacts.length > 0 && <span className="ml-1 text-muted">{contacts.length}</span>}
            {t.key === 'oportunidades' && openOpps.length > 0 && <span className="ml-1 text-muted">{openOpps.length}</span>}
          </Link>
        ))}
      </nav>

      {tab === 'resumo' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader
                title="Próximas tarefas"
                action={<NewTaskButton variant="secondary" label="Tarefa" companies={companies} contacts={contactOpts} companyId={id} />}
              />
              <CardBody className="space-y-2">
                {tasks.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted">Nenhuma tarefa pendente. Defina o próximo passo com este cliente.</p>
                ) : (
                  tasks.map((t) => <TaskItem key={t.id} task={t} showCompany={false} />)
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader
                title="Últimas interações"
                action={
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/atividades/nova?cliente=${id}`}>
                      <Plus /> Atividade
                    </Link>
                  </Button>
                }
              />
              <CardBody>
                <Timeline items={timeline.slice(0, 8)} />
                {timeline.length > 8 && (
                  <Link href={tabHref('timeline')} className="mt-4 block text-sm font-medium text-brand">
                    Ver linha do tempo completa
                  </Link>
                )}
              </CardBody>
            </Card>
          </div>
          <div className="space-y-4">
            <ContactsCard contacts={contacts} companies={companies} companyId={id} compact />
            <OppsCard opps={openOpps} companyId={id} />
            <Card>
              <CardHeader title="Dados cadastrais" />
              <CardBody className="space-y-2 text-sm">
                <Info label="Razão social" value={company.legal_name} />
                <Info label="CNPJ" value={company.cnpj ? formatCNPJ(company.cnpj) : null} />
                <Info label="Segmento" value={company.segment} />
                <Info label="Telefone" value={company.phone ? formatPhone(company.phone) : null} />
                <Info label="Endereço" value={[company.address, company.city && `${company.city}/${company.state}`, company.zip_code].filter(Boolean).join(' · ') || null} />
                <Info label="Potencial" value={company.purchase_potential ? `${formatBRL(company.purchase_potential)}/mês` : null} />
                <Info label="Cliente desde" value={formatDate(company.created_at)} />
                <div className="flex flex-wrap gap-3 pt-1">
                  {company.email && (
                    <a href={`mailto:${company.email}`} className="flex items-center gap-1 text-brand">
                      <Mail className="size-4" /> E-mail
                    </a>
                  )}
                  {company.website && (
                    <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-brand">
                      <Globe className="size-4" /> Site
                    </a>
                  )}
                  {company.instagram && (
                    <a href={`https://instagram.com/${company.instagram.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-brand">
                      <AtSign className="size-4" /> Instagram
                    </a>
                  )}
                </div>
                {company.notes && <p className="whitespace-pre-line border-t border-line pt-3 text-muted">{company.notes}</p>}
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {tab === 'contatos' && <ContactsCard contacts={contacts} companies={companies} companyId={id} />}

      {tab === 'oportunidades' && (
        <Card>
          <CardHeader
            title="Oportunidades"
            action={
              <Button asChild size="sm">
                <Link href={`/oportunidades/nova?cliente=${id}`}>
                  <Plus /> Oportunidade
                </Link>
              </Button>
            }
          />
          <CardBody>
            {opps.length === 0 ? (
              <EmptyState icon={<Target />} title="Nenhuma oportunidade" description="Crie uma oportunidade quando o cliente demonstrar interesse." />
            ) : (
              <ul className="divide-y divide-line">
                {opps.map((o) => (
                  <li key={o.id}>
                    <Link href={`/oportunidades/${o.id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{o.title}</p>
                        <p className="text-xs text-muted">
                          {o.stage_name} · {o.contact_name ?? 'sem comprador'} · atualizado {relativeTime(o.updated_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="num font-semibold">{formatBRLCompact(o.estimated_value)}</p>
                        <TemperatureBadge value={o.temperature} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}

      {tab === 'timeline' && (
        <Card>
          <CardHeader
            title="Linha do tempo"
            description="Visitas, ligações, mensagens, pedidos e mudanças de status."
            action={
              <Button asChild variant="secondary" size="sm">
                <Link href={`/atividades/nova?cliente=${id}`}>
                  <Plus /> Atividade
                </Link>
              </Button>
            }
          />
          <CardBody>
            <Timeline items={timeline} />
          </CardBody>
        </Card>
      )}

      {tab === 'visitas' && (
        <Card>
          <CardHeader
            title="Visitas"
            action={
              <Button asChild size="sm">
                <Link href={`/visitas/nova?cliente=${id}`}>
                  <MapPin /> Registrar visita
                </Link>
              </Button>
            }
          />
          <CardBody>
            {visits.length === 0 ? (
              <EmptyState icon={<MapPin />} title="Nenhuma visita registrada" />
            ) : (
              <ul className="divide-y divide-line">
                {visits.map((v) => (
                  <li key={v.id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">
                        {formatDateTime(v.visited_at)} · {VISIT_TYPE_LABELS[v.visit_type]}
                      </p>
                      <Badge>{VISIT_RESULT_LABELS[v.result]}</Badge>
                    </div>
                    <p className="text-sm text-muted">
                      {[v.contact_name && `Com ${v.contact_name}`, v.objective, v.owner_name].filter(Boolean).join(' · ')}
                    </p>
                    {v.notes && <p className="mt-1 text-sm">{v.notes}</p>}
                    {v.product_names.length > 0 && <p className="mt-1 text-xs text-muted">Produtos apresentados: {v.product_names.join(', ')}</p>}
                    {v.latitude != null && (
                      <a href={mapsCoordsLink(v.latitude, v.longitude)!} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-blue-700">
                        <MapPin className="size-3" /> Localização registrada
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}

      {tab === 'pedidos' && (
        <Card>
          <CardHeader
            title="Pedidos e vendas"
            action={
              <Button asChild size="sm">
                <Link href={`/pedidos/novo?cliente=${id}`}>
                  <ShoppingCart /> Novo pedido
                </Link>
              </Button>
            }
          />
          <CardBody>
            {orders.length === 0 ? (
              <EmptyState icon={<ShoppingCart />} title="Nenhum pedido" />
            ) : (
              <ul className="divide-y divide-line">
                {orders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/pedidos/${o.id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                      <div className="min-w-0">
                        <p className="font-medium">
                          Pedido #{o.order_number} <span className="text-muted">· {formatDate(o.order_date)}</span>
                        </p>
                        <p className="truncate text-xs text-muted">{o.product_names.join(', ')}</p>
                      </div>
                      <div className="text-right">
                        <p className="num font-semibold">{formatBRL(o.total)}</p>
                        <StatusBadge meta={ORDER_STATUS[o.status]} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}

      {tab === 'produtos' && (
        <Card>
          <CardHeader title="Produtos comprados" description="Somente pedidos faturados." />
          <CardBody>
            {products.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">Este cliente ainda não tem pedidos faturados.</p>
            ) : (
              <ul className="divide-y divide-line">
                {products.map((p) => (
                  <li key={p.key} className="flex items-center justify-between gap-3 py-3">
                    <span className="font-medium">{p.label}</span>
                    <span className="num text-right text-sm">
                      <span className="font-semibold">{formatInt(p.volume)} un.</span>
                      <span className="block text-xs text-muted">{formatBRL(p.revenue)} · {p.orders} pedido(s)</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}

      {tab === 'historico' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Histórico de status" description="Registros permanentes — não podem ser apagados." />
            <CardBody>
              <ul className="space-y-3">
                {(statusR.data ?? []).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2">
                      {s.from_status ? <TemperatureBadge value={s.from_status as Temperature} /> : <span className="text-muted">Cadastro</span>}
                      →
                      <TemperatureBadge value={s.to_status as Temperature} />
                    </span>
                    <span className="text-xs text-muted">{formatDateTime(s.changed_at)}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Movimentações no pipeline" />
            <CardBody>
              {(stageR.data ?? []).length === 0 ? (
                <p className="text-sm text-muted">Sem movimentações.</p>
              ) : (
                <ul className="space-y-3">
                  {(stageR.data ?? []).map((h) => (
                    <li key={h.id} className="text-sm">
                      <p className="font-medium">{(h.opportunities as unknown as { title: string })?.title}</p>
                      <p className="text-xs text-muted">
                        {h.from_stage ?? 'Criada'} → {h.to_stage} · {formatDateTime(h.changed_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          {session.isAdmin && (
            <p className="text-sm text-muted lg:col-span-2">
              Auditoria completa (quem alterou cada campo) em{' '}
              <Link href={`/auditoria?cliente=${id}`} className="font-medium text-brand">
                Auditoria
              </Link>
              .
            </p>
          )}
        </div>
      )}
    </>
  );
}

function Kpi({ label, value, hint, alert }: { label: string; value: string; hint?: string; alert?: boolean }) {
  return (
    <div className={cn('rounded-[var(--radius-card)] bg-surface p-3 ring-1 ring-line sm:p-4', alert && 'bg-red-50/60 ring-red-200')}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={cn('num mt-0.5 text-lg font-semibold sm:text-xl', alert && 'text-red-700')}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function ContactsCard({
  contacts,
  companies,
  companyId,
  compact,
}: {
  contacts: Contact[];
  companies: { value: string; label: string }[];
  companyId: string;
  compact?: boolean;
}) {
  return (
    <Card id="contatos">
      <CardHeader title="Compradores" action={<ContactDialog companies={companies} companyId={companyId} />} />
      <CardBody className="pt-3">
        {contacts.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">Cadastre quem decide a compra neste cliente.</p>
        ) : (
          <ul className="divide-y divide-line">
            {contacts.map((c) => (
              <li key={c.id} className="py-3 first:pt-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {c.name} {c.is_primary && <Badge className="ml-1 bg-nori-900 text-white ring-nori-900">Principal</Badge>}
                    </p>
                    <p className="text-sm text-muted">{[c.job_title, c.department].filter(Boolean).join(' · ') || '—'}</p>
                    {!compact && (
                      <div className="mt-1 space-y-0.5 text-xs text-muted">
                        {c.whatsapp && <p>WhatsApp: {formatPhone(c.whatsapp)}</p>}
                        {c.phone && <p>Telefone: {formatPhone(c.phone)}</p>}
                        {c.email && <p>{c.email}</p>}
                        {c.best_contact_time && <p>Melhor horário: {c.best_contact_time}</p>}
                        {c.linkedin && (
                          <a href={c.linkedin.startsWith('http') ? c.linkedin : `https://${c.linkedin}`} target="_blank" rel="noopener noreferrer" className="text-brand">
                            LinkedIn
                          </a>
                        )}
                        {c.notes && <p className="whitespace-pre-line">{c.notes}</p>}
                      </div>
                    )}
                    {compact && c.best_contact_time && <p className="text-xs text-muted">Melhor horário: {c.best_contact_time}</p>}
                  </div>
                  <ContactDialog companies={companies} companyId={companyId} contact={c} />
                </div>
                <ContactActions size="sm" className="mt-2" whatsapp={c.whatsapp} phone={c.phone} />
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function OppsCard({ opps, companyId }: { opps: OpportunityBoardRow[]; companyId: string }) {
  return (
    <Card>
      <CardHeader
        title="Oportunidades abertas"
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href={`/oportunidades/nova?cliente=${companyId}`}>
              <Plus /> Nova
            </Link>
          </Button>
        }
      />
      <CardBody className="pt-3">
        {opps.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">Nenhuma oportunidade aberta.</p>
        ) : (
          <ul className="space-y-2">
            {opps.map((o) => (
              <li key={o.id}>
                <Link href={`/oportunidades/${o.id}`} className="block rounded-lg bg-rice p-3 hover:ring-1 hover:ring-line-strong">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{o.title}</p>
                    <span className="num text-sm font-semibold">{formatBRLCompact(o.estimated_value)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                    <TemperatureBadge value={o.temperature} />
                    <span>{o.stage_name}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

