'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { actionError, actionOk, dbError, validationError, type ActionState } from '@/lib/actions';
import { formDataToObject, orderSchema } from '@/lib/validation';
import type { OrderStatus } from '@/lib/constants';

export async function saveOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const raw = formDataToObject(formData);
  let items: unknown = [];
  try {
    items = JSON.parse(String(raw.items ?? '[]'));
  } catch {
    return actionError('Itens do pedido inválidos.');
  }
  const parsed = orderSchema.safeParse({ ...raw, items });
  if (!parsed.success) return validationError(parsed.error);
  const { items: lines, owner_id, ...header } = parsed.data;
  const id = formData.get('id')?.toString() || null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('save_order', {
    p_id: id,
    p_header: { ...header, owner_id: session.isAdmin ? (owner_id ?? null) : null },
    p_items: lines,
  });
  if (error) return dbError(error);
  revalidatePath('/pedidos');
  revalidatePath(`/clientes/${header.company_id}`);
  return actionOk(id ? 'Pedido atualizado.' : 'Pedido registrado.', data as string);
}

const statusSchema = z.object({
  id: z.uuid(),
  status: z.enum(['orcamento', 'pedido_realizado', 'faturado', 'em_entrega', 'entregue', 'cancelado']),
  invoice_number: z.string().trim().max(60).optional(),
});

/** Mudança de status. Faturar/entregar é exclusivo do gestor (regra no banco). */
export async function setOrderStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const parsed = statusSchema.safeParse({
    id: formData.get('id'),
    status: formData.get('status'),
    invoice_number: formData.get('invoice_number')?.toString() || undefined,
  });
  if (!parsed.success) return validationError(parsed.error);
  const { id, status, invoice_number } = parsed.data;
  const supabase = await createClient();
  const update: { status: OrderStatus; invoice_number?: string } = { status };
  if (invoice_number) update.invoice_number = invoice_number;
  const { error } = await supabase.from('orders').update(update).eq('id', id);
  if (error) return dbError(error);
  revalidatePath(`/pedidos/${id}`);
  revalidatePath('/pedidos');
  revalidatePath('/faturamento');
  const labels: Partial<Record<OrderStatus, string>> = {
    faturado: 'Pedido faturado.',
    em_entrega: 'Pedido em entrega.',
    entregue: 'Pedido entregue.',
    cancelado: 'Pedido cancelado.',
  };
  return actionOk(labels[status] ?? 'Status atualizado.');
}
