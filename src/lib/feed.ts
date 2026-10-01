import { ORDER_STATUS, TEMPERATURE, type OrderStatus, type Temperature } from './constants';
import { formatBRL } from './format';
import type { AuditRow } from '@/types/db';

/** Converte um registro de auditoria em uma frase do feed de atividades. */
export function describeAudit(a: AuditRow): { text: string; href: string | null } | null {
  const who = a.actor_name ?? 'Sistema';
  const n = (a.new_data ?? {}) as Record<string, unknown>;
  const o = (a.old_data ?? {}) as Record<string, unknown>;
  const company = a.company_label ?? 'cliente';
  const companyHref = a.company_id ? `/clientes/${a.company_id}` : null;

  switch (a.table_name) {
    case 'visits':
      if (a.action === 'insert') return { text: `${who} visitou ${company}`, href: companyHref };
      return null;
    case 'contacts':
      if (a.action === 'insert') return { text: `${who} cadastrou o comprador ${n.name} (${company})`, href: companyHref };
      return null;
    case 'companies':
      if (a.action === 'insert') return { text: `${who} cadastrou o cliente ${company}`, href: companyHref };
      if (a.action === 'status_change' && n.status)
        return {
          text: `${who} alterou ${company} para ${TEMPERATURE[n.status as Temperature]?.label ?? n.status}`,
          href: companyHref,
        };
      if (a.action === 'owner_change') return { text: `${who} transferiu ${company} de vendedor`, href: companyHref };
      return null;
    case 'opportunities':
      if (a.action === 'insert')
        return { text: `${who} registrou oportunidade de ${formatBRL(n.estimated_value as number)} em ${company}`, href: `/oportunidades/${a.record_id}` };
      if (a.action === 'stage_change')
        return { text: `${who} moveu "${n.title}" para ${String(n.stage_key).replace(/_/g, ' ')}`, href: `/oportunidades/${a.record_id}` };
      if (a.action === 'value_change')
        return {
          text: `${who} alterou o valor de "${n.title}" de ${formatBRL(o.estimated_value as number)} para ${formatBRL(n.estimated_value as number)}`,
          href: `/oportunidades/${a.record_id}`,
        };
      return null;
    case 'orders':
      if (a.action === 'insert') return { text: `${who} registrou o pedido #${n.order_number} (${company})`, href: `/pedidos/${a.record_id}` };
      if (a.action === 'status_change') {
        const st = n.status as OrderStatus;
        if (st === 'faturado') return { text: `Pedido #${n.order_number} faturado — ${formatBRL(n.total as number)}`, href: `/pedidos/${a.record_id}` };
        return { text: `Pedido #${n.order_number}: ${ORDER_STATUS[st]?.label ?? st}`, href: `/pedidos/${a.record_id}` };
      }
      return null;
    case 'tasks':
      if (a.action === 'status_change' && n.status === 'concluida') return { text: `${who} concluiu a tarefa "${n.title}"`, href: companyHref };
      return null;
    default:
      return null;
  }
}
