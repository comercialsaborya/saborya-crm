import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';
import { resolvePeriod } from '@/lib/periods';
import { searchTerm } from '@/lib/queries';
import { toCsv, num, type CsvColumn } from '@/lib/csv';
import {
  ACTIVITY_TYPE_LABELS,
  CLIENT_TYPE_LABELS,
  INTEREST_LABELS,
  ORDER_STATUS,
  TEMPERATURE,
  VISIT_RESULT_LABELS,
  VISIT_TYPE_LABELS,
} from '@/lib/constants';
import { formatCNPJ, formatDate, formatDateTime } from '@/lib/format';
import { onlyDigits } from '@/lib/utils';
import type {
  ActivityRow,
  CompanyOverview,
  ContactListRow,
  InvoicedSaleRow,
  OrderRow,
  VisitRow,
} from '@/types/db';

const MAX_ROWS = 50000;
const PAGE = 1000;

type Params = URLSearchParams;
type Supa = Awaited<ReturnType<typeof createClient>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Q = any;

async function fetchAll<T>(build: () => Q): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

function period(p: Params, fallback: Parameters<typeof resolvePeriod>[1]) {
  return resolvePeriod({ periodo: p.get('periodo') ?? undefined, de: p.get('de') ?? undefined, ate: p.get('ate') ?? undefined }, fallback);
}

const EXPORTS: Record<string, (s: Supa, p: Params, admin: boolean) => Promise<string>> = {
  async clientes(s, p, admin) {
    const rows = await fetchAll<CompanyOverview>(() => {
      let q = s.from('company_overview').select('*').is('deleted_at', null).order('display_name');
      const t = searchTerm(p.get('q') ?? undefined);
      if (t) {
        const d = onlyDigits(t);
        const ors = [`legal_name.ilike.*${t}*`, `trade_name.ilike.*${t}*`, `city.ilike.*${t}*`];
        if (d.length >= 3) ors.push(`cnpj.ilike.*${d}*`, `phone.ilike.*${d}*`);
        q = q.or(ors.join(','));
      }
      if (p.get('status')) q = q.eq('status', p.get('status'));
      if (p.get('tipo')) q = q.eq('client_type', p.get('tipo'));
      if (p.get('uf')) q = q.eq('state', p.get('uf'));
      if (admin && p.get('vendedor')) q = q.eq('owner_id', p.get('vendedor'));
      if (p.get('sem_contato')) q = q.gte('days_without_contact', 30).neq('status', 'perdido');
      return q;
    });
    const cols: CsvColumn<CompanyOverview>[] = [
      { header: 'Nome fantasia', value: (r) => r.trade_name },
      { header: 'Razão social', value: (r) => r.legal_name },
      { header: 'CNPJ', value: (r) => (r.cnpj ? formatCNPJ(r.cnpj) : '') },
      { header: 'Tipo', value: (r) => CLIENT_TYPE_LABELS[r.client_type] },
      { header: 'Segmento', value: (r) => r.segment },
      { header: 'Status', value: (r) => TEMPERATURE[r.status].label },
      { header: 'Cidade', value: (r) => r.city },
      { header: 'UF', value: (r) => r.state },
      { header: 'Endereço', value: (r) => r.address },
      { header: 'Telefone', value: (r) => r.phone },
      { header: 'E-mail', value: (r) => r.email },
      { header: 'Site', value: (r) => r.website },
      { header: 'Instagram', value: (r) => r.instagram },
      { header: 'Vendedor', value: (r) => r.owner_name },
      { header: 'Potencial (R$/mês)', value: (r) => num(r.purchase_potential) },
      { header: 'Faturamento acumulado (R$)', value: (r) => num(r.revenue_total) },
      { header: 'Volume acumulado (un.)', value: (r) => num(r.volume_total) },
      { header: 'Último contato', value: (r) => formatDate(r.last_contact_at) },
      { header: 'Última visita', value: (r) => formatDate(r.last_visit_at) },
      { header: 'Próximo contato', value: (r) => formatDate(r.next_action_date) },
      { header: 'Dias sem contato', value: (r) => r.days_without_contact },
      { header: 'Cadastrado em', value: (r) => formatDate(r.created_at) },
      { header: 'Observações', value: (r) => r.notes },
    ];
    return toCsv(rows, cols);
  },

  async contatos(s, p) {
    const rows = await fetchAll<ContactListRow>(() => {
      let q = s.from('contact_list').select('*').is('deleted_at', null).order('company_name').order('name');
      if (p.get('uf')) q = q.eq('state', p.get('uf'));
      return q;
    });
    return toCsv(rows, [
      { header: 'Nome', value: (r) => r.name },
      { header: 'Cargo', value: (r) => r.job_title },
      { header: 'Departamento', value: (r) => r.department },
      { header: 'Cliente', value: (r) => r.company_name },
      { header: 'Telefone', value: (r) => r.phone },
      { header: 'WhatsApp', value: (r) => r.whatsapp },
      { header: 'E-mail', value: (r) => r.email },
      { header: 'LinkedIn', value: (r) => r.linkedin },
      { header: 'Melhor horário', value: (r) => r.best_contact_time },
      { header: 'Principal', value: (r) => r.is_primary },
      { header: 'Observações', value: (r) => r.notes },
    ]);
  },

  async pedidos(s, p, admin) {
    const r0 = period(p, '3m');
    const rows = await fetchAll<OrderRow>(() => {
      let q = s.from('order_list').select('*').is('deleted_at', null).gte('order_date', r0.from).lte('order_date', r0.to).order('order_number');
      if (p.get('status')) q = q.eq('status', p.get('status'));
      if (p.get('cliente')) q = q.eq('company_id', p.get('cliente'));
      if (admin && p.get('vendedor')) q = q.eq('owner_id', p.get('vendedor'));
      return q;
    });
    return toCsv(rows, [
      { header: 'Pedido', value: (r) => r.order_number },
      { header: 'Data', value: (r) => formatDate(r.order_date) },
      { header: 'Status', value: (r) => ORDER_STATUS[r.status].label },
      { header: 'Cliente', value: (r) => r.company_name },
      { header: 'Cidade', value: (r) => r.city },
      { header: 'UF', value: (r) => r.state },
      { header: 'Comprador', value: (r) => r.contact_name },
      { header: 'Vendedor', value: (r) => r.owner_name },
      { header: 'Produtos', value: (r) => r.product_names },
      { header: 'Quantidade total', value: (r) => num(r.total_quantity) },
      { header: 'Subtotal (R$)', value: (r) => num(r.subtotal) },
      { header: 'Desconto (R$)', value: (r) => num(r.discount) },
      { header: 'Total (R$)', value: (r) => num(r.total) },
      { header: 'NF', value: (r) => r.invoice_number },
      { header: 'Faturado em', value: (r) => formatDate(r.invoiced_at) },
      { header: 'Observações', value: (r) => r.notes },
    ]);
  },

  async vendas(s, p, admin) {
    const r0 = period(p, 'mes');
    const rows = await fetchAll<InvoicedSaleRow>(() => {
      let q = s
        .from('invoiced_sales')
        .select('*')
        .gte('invoiced_at', `${r0.from}T00:00:00-03:00`)
        .lte('invoiced_at', `${r0.to}T23:59:59-03:00`)
        .order('invoiced_at');
      const sit = p.get('situacao') ?? 'ativa';
      if (sit !== 'todas') q = q.eq('status', sit);
      if (admin && p.get('vendedor')) q = q.eq('seller_id', p.get('vendedor'));
      if (p.get('cliente')) q = q.eq('company_id', p.get('cliente'));
      if (p.get('produto')) q = q.contains('product_ids', [p.get('produto')]);
      if (p.get('categoria')) q = q.contains('categories', [p.get('categoria')]);
      const city = searchTerm(p.get('cidade') ?? undefined);
      if (city) q = q.ilike('city', `%${city}%`);
      if (p.get('uf')) q = q.eq('state', p.get('uf'));
      return q;
    });
    return toCsv(rows, [
      { header: 'NF', value: (r) => r.invoice_number },
      { header: 'Pedido', value: (r) => r.order_number },
      { header: 'Faturado em', value: (r) => formatDate(r.invoiced_at) },
      { header: 'Cliente', value: (r) => r.company_name },
      { header: 'Cidade', value: (r) => r.city },
      { header: 'UF', value: (r) => r.state },
      { header: 'Vendedor', value: (r) => r.seller_name },
      { header: 'Produtos', value: (r) => r.product_summary },
      { header: 'Quantidade', value: (r) => num(r.total_quantity) },
      { header: 'Valor (R$)', value: (r) => num(r.amount) },
      { header: 'Situação', value: (r) => (r.status === 'ativa' ? ORDER_STATUS[r.order_status].label : 'Estornado') },
    ]);
  },

  async visitas(s, p, admin) {
    const r0 = period(p, 'mes');
    const rows = await fetchAll<VisitRow>(() => {
      let q = s
        .from('visit_list')
        .select('*')
        .is('deleted_at', null)
        .gte('visited_at', `${r0.from}T00:00:00-03:00`)
        .lte('visited_at', `${r0.to}T23:59:59-03:00`)
        .order('visited_at');
      if (p.get('resultado')) q = q.eq('result', p.get('resultado'));
      if (p.get('tipo')) q = q.eq('visit_type', p.get('tipo'));
      if (p.get('uf')) q = q.eq('state', p.get('uf'));
      if (admin && p.get('vendedor')) q = q.eq('owner_id', p.get('vendedor'));
      return q;
    });
    return toCsv(rows, [
      { header: 'Data/hora', value: (r) => formatDateTime(r.visited_at) },
      { header: 'Cliente', value: (r) => r.company_name },
      { header: 'Cidade', value: (r) => r.city },
      { header: 'UF', value: (r) => r.state },
      { header: 'Comprador', value: (r) => r.contact_name },
      { header: 'Vendedor', value: (r) => r.owner_name },
      { header: 'Tipo', value: (r) => VISIT_TYPE_LABELS[r.visit_type] },
      { header: 'Objetivo', value: (r) => r.objective },
      { header: 'Resultado', value: (r) => VISIT_RESULT_LABELS[r.result] },
      { header: 'Interesse', value: (r) => (r.interest_level ? INTEREST_LABELS[r.interest_level] : '') },
      { header: 'Valor potencial (R$)', value: (r) => num(r.potential_value) },
      { header: 'Produtos apresentados', value: (r) => r.product_names },
      { header: 'Próximo passo', value: (r) => r.next_step },
      { header: 'Próximo contato', value: (r) => formatDate(r.next_contact_date) },
      { header: 'Latitude', value: (r) => r.latitude },
      { header: 'Longitude', value: (r) => r.longitude },
      { header: 'Observações', value: (r) => r.notes },
    ]);
  },

  async atividades(s, p, admin) {
    const r0 = period(p, 'semana');
    const rows = await fetchAll<ActivityRow>(() => {
      let q = s
        .from('activity_list')
        .select('*')
        .is('deleted_at', null)
        .gte('occurred_at', `${r0.from}T00:00:00-03:00`)
        .lte('occurred_at', `${r0.to}T23:59:59-03:00`)
        .order('occurred_at');
      if (p.get('tipo')) q = q.eq('type', p.get('tipo'));
      if (admin && p.get('vendedor')) q = q.eq('owner_id', p.get('vendedor'));
      return q;
    });
    return toCsv(rows, [
      { header: 'Data/hora', value: (r) => formatDateTime(r.occurred_at) },
      { header: 'Tipo', value: (r) => ACTIVITY_TYPE_LABELS[r.type] },
      { header: 'Cliente', value: (r) => r.company_name },
      { header: 'Comprador', value: (r) => r.contact_name },
      { header: 'Vendedor', value: (r) => r.owner_name },
      { header: 'Descrição', value: (r) => r.description },
      { header: 'Resultado', value: (r) => r.result },
      { header: 'Próxima ação', value: (r) => r.next_action },
      { header: 'Data próxima ação', value: (r) => formatDate(r.next_action_date) },
    ]);
  },
};

export async function GET(request: NextRequest, ctx: RouteContext<'/api/export/[entity]'>) {
  const { entity } = await ctx.params;
  const session = await getSession();
  if (!session || !session.profile.active) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const run = EXPORTS[entity];
  if (!run) return NextResponse.json({ error: 'Exportação inexistente' }, { status: 404 });
  try {
    const supabase = await createClient();
    const csv = await run(supabase, request.nextUrl.searchParams, session.isAdmin);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="saborya-${entity}-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('[export]', entity, e);
    return NextResponse.json({ error: 'Não foi possível gerar a exportação.' }, { status: 500 });
  }
}
