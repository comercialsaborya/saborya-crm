import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { EDITABLE_ORDER_STATUSES, ORDER_STATUS } from '@/lib/constants';
import { formatBRL, formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PageHeader, StatusBadge } from '@/components/ui/misc';
import { OrderStatusActions } from './status-actions';
import type { OrderItem, OrderRow } from '@/types/db';

export const metadata: Metadata = { title: 'Pedido' };

export default async function PedidoPage({ params }: PageProps<'/pedidos/[id]'>) {
  const { id } = await params;
  const session = await requireSession();
  const supabase = await createClient();
  const { data: order } = await supabase.from('order_list').select('*').eq('id', id).maybeSingle<OrderRow>();
  if (!order) notFound();
  const { data: items } = await supabase
    .from('order_items')
    .select('*, products(name, sku, sales_unit, category)')
    .eq('order_id', id)
    .order('created_at');
  const lines = (items ?? []) as OrderItem[];
  const editable = EDITABLE_ORDER_STATUSES.includes(order.status);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={`${order.status === 'orcamento' ? 'Orçamento' : 'Pedido'} #${order.order_number}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/clientes/${order.company_id}`} className="font-medium text-brand">
              {order.company_name}
            </Link>
            · {formatDate(order.order_date)} <StatusBadge meta={ORDER_STATUS[order.status]} />
          </span>
        }
        back={{ href: '/pedidos', label: 'Pedidos' }}
        actions={
          editable ? (
            <Button asChild variant="secondary">
              <Link href={`/pedidos/${id}/editar`}>
                <Pencil /> Editar
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Itens" />
          <CardBody>
            <ul className="divide-y divide-line">
              {lines.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{i.products?.name}</p>
                    <p className="num text-xs text-muted">
                      {formatNumber(i.quantity)} {i.products?.sales_unit} × {formatBRL(i.unit_price)}
                    </p>
                  </div>
                  <p className="num font-semibold">{formatBRL(i.subtotal)}</p>
                </li>
              ))}
            </ul>
            <dl className="num mt-3 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal ({formatNumber(order.total_quantity)} un.)</dt>
                <dd>{formatBRL(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Desconto</dt>
                <dd>− {formatBRL(order.discount)}</dd>
              </div>
              <div className="flex justify-between text-lg font-semibold">
                <dt>Total</dt>
                <dd>{formatBRL(order.total)}</dd>
              </div>
            </dl>
            {order.notes && <p className="mt-4 whitespace-pre-line rounded-lg bg-rice p-3 text-sm">{order.notes}</p>}
          </CardBody>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Status" />
            <CardBody>
              <OrderStatusActions id={order.id} status={order.status} isAdmin={session.isAdmin} invoiceNumber={order.invoice_number} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Detalhes" />
            <CardBody className="space-y-2 text-sm">
              <Row label="Vendedor" value={order.owner_name} />
              <Row label="Comprador" value={order.contact_name} />
              <Row label="NF" value={order.invoice_number} />
              <Row label="Faturado em" value={order.invoiced_at ? formatDateTime(order.invoiced_at) : null} />
              <Row label="Entregue em" value={order.delivered_at ? formatDateTime(order.delivered_at) : null} />
              <Row label="Cancelado em" value={order.canceled_at ? formatDateTime(order.canceled_at) : null} />
              <Row label="Criado em" value={formatDateTime(order.created_at)} />
              {order.opportunity_id && (
                <Link href={`/oportunidades/${order.opportunity_id}`} className="block pt-1 font-medium text-brand">
                  Ver oportunidade
                </Link>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
