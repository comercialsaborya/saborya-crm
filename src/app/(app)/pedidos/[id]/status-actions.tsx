'use client';

import * as React from 'react';
import { setOrderStatus } from '@/app/actions/orders';
import { useFormAction } from '@/hooks/use-form-action';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, FormError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/misc';
import { ORDER_STATUS, type OrderStatus } from '@/lib/constants';

/** Próximos passos possíveis para o pedido, conforme o perfil. */
function transitions(status: OrderStatus, isAdmin: boolean): { to: OrderStatus; label: string; variant?: 'primary' | 'secondary' | 'danger' }[] {
  const list: { to: OrderStatus; label: string; variant?: 'primary' | 'secondary' | 'danger' }[] = [];
  if (status === 'orcamento') list.push({ to: 'pedido_realizado', label: 'Converter em pedido' });
  if (isAdmin) {
    if (status === 'pedido_realizado') list.push({ to: 'faturado', label: 'Faturar pedido' });
    if (status === 'faturado') list.push({ to: 'em_entrega', label: 'Marcar em entrega' });
    if (status === 'faturado' || status === 'em_entrega') list.push({ to: 'entregue', label: 'Marcar como entregue', variant: status === 'faturado' ? 'secondary' : 'primary' });
    if (status === 'cancelado') list.push({ to: 'pedido_realizado', label: 'Reabrir pedido', variant: 'secondary' });
  }
  if (status !== 'cancelado' && (isAdmin || status === 'orcamento' || status === 'pedido_realizado'))
    list.push({ to: 'cancelado', label: status === 'orcamento' ? 'Descartar orçamento' : 'Cancelar pedido', variant: 'danger' });
  return list;
}

export function OrderStatusActions({
  id,
  status,
  isAdmin,
  invoiceNumber,
}: {
  id: string;
  status: OrderStatus;
  isAdmin: boolean;
  invoiceNumber: string | null;
}) {
  const [billing, setBilling] = React.useState(false);
  const { state, pending, onSubmit, submitData } = useFormAction(setOrderStatus, { onSuccess: () => setBilling(false) });
  const go = (to: OrderStatus) => {
    if (to === 'faturado') return setBilling(true);
    if (to === 'cancelado' && !confirm(status === 'faturado' || status === 'em_entrega' || status === 'entregue'
      ? 'Cancelar este pedido faturado? O faturamento será estornado.'
      : 'Cancelar este pedido?')) return;
    const fd = new FormData();
    fd.set('id', id);
    fd.set('status', to);
    submitData(fd);
  };
  const options = transitions(status, isAdmin);
  return (
    <div className="space-y-3">
      <StatusBadge meta={ORDER_STATUS[status]} className="px-3 py-1 text-sm" />
      {options.length > 0 && (
        <div className="flex flex-col gap-2">
          {options.map((o) => (
            <Button key={o.to + o.label} variant={o.variant ?? 'primary'} disabled={pending} onClick={() => go(o.to)}>
              {o.label}
            </Button>
          ))}
        </div>
      )}
      {!isAdmin && status === 'pedido_realizado' && (
        <p className="text-xs text-muted">O faturamento é feito pela gestão comercial. Você será notificado.</p>
      )}
      <FormError message={state.error} />
      <Dialog open={billing} onOpenChange={setBilling}>
        <DialogContent title="Faturar pedido" description="Gera o registro de faturamento e marca a oportunidade como venda.">
          <form onSubmit={onSubmit} className="space-y-4">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="faturado" />
            <Field label="Número da NF" htmlFor="invoice_number" hint="Opcional — pode ser informado depois.">
              <Input id="invoice_number" name="invoice_number" defaultValue={invoiceNumber ?? ''} />
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? 'Faturando…' : 'Confirmar faturamento'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
