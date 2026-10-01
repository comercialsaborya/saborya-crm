'use client';

import * as React from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { saveOrder } from '@/app/actions/orders';
import { useFormAction } from '@/hooks/use-form-action';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, FormError } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Picker, type PickerOption } from '@/components/ui/picker';
import { PRODUCT_CATEGORY_LABELS } from '@/lib/constants';
import { formatBRL, todayISO } from '@/lib/format';
import { calcLineSubtotal, calcOrderSubtotal, parseDecimal } from '@/lib/validation';
import { cn } from '@/lib/utils';
import type { OrderItem, OrderRow, Product } from '@/types/db';

type Opt = PickerOption & { company_id: string };
type Line = { key: string; product_id: string; quantity: string; unit_price: string };

const toStr = (n: number | string) => String(n).replace('.', ',');
let seq = 0;
const newKey = () => `l${++seq}`;

export function OrderForm({
  order,
  items,
  companies,
  contacts,
  opportunities,
  products,
  sellers,
  initial,
}: {
  order?: OrderRow | null;
  items?: OrderItem[];
  companies: PickerOption[];
  contacts: Opt[];
  opportunities: Opt[];
  products: Product[];
  sellers?: PickerOption[];
  initial?: { company?: string | null; contact?: string | null; opportunity?: string | null };
}) {
  const [company, setCompany] = React.useState<string | null>(order?.company_id ?? initial?.company ?? null);
  const [status, setStatus] = React.useState<'orcamento' | 'pedido_realizado'>(
    order?.status === 'orcamento' ? 'orcamento' : 'pedido_realizado',
  );
  const [lines, setLines] = React.useState<Line[]>(
    (items ?? []).map((i) => ({ key: newKey(), product_id: i.product_id, quantity: toStr(i.quantity), unit_price: toStr(i.unit_price) })),
  );
  const [discount, setDiscount] = React.useState(order ? toStr(order.discount) : '');
  const productMap = React.useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const { state, pending, onSubmit, errors } = useFormAction(saveOrder, {
    redirectTo: (s) => (s.id ? `/pedidos/${s.id}` : '/pedidos'),
  });

  const parsed = lines.map((l) => ({
    product_id: l.product_id,
    quantity: parseDecimal(l.quantity) ?? 0,
    unit_price: parseDecimal(l.unit_price) ?? 0,
  }));
  const subtotal = calcOrderSubtotal(parsed.map((p) => ({ quantity: p.quantity || 0, unit_price: p.unit_price || 0 })));
  const disc = Math.min(parseDecimal(discount) || 0, subtotal);
  const total = Math.max(subtotal - disc, 0);
  const totalUnits = parsed.reduce((s, p) => s + (p.quantity || 0), 0);

  const addProduct = (id: string | null) => {
    if (!id) return;
    const existing = lines.find((l) => l.product_id === id);
    if (existing) {
      setLines((ls) => ls.map((l) => (l.key === existing.key ? { ...l, quantity: toStr((parseDecimal(l.quantity) || 0) + 1) } : l)));
      return;
    }
    const p = productMap.get(id);
    setLines((ls) => [...ls, { key: newKey(), product_id: id, quantity: '10', unit_price: toStr(p?.price ?? 0) }]);
  };
  const update = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const step = (key: string, delta: number) =>
    setLines((ls) =>
      ls.map((l) => (l.key === key ? { ...l, quantity: toStr(Math.max((parseDecimal(l.quantity) || 0) + delta, 1)) } : l)),
    );

  const available = products
    .filter((p) => p.active || lines.some((l) => l.product_id === p.id))
    .map((p) => ({ value: p.id, label: p.name, description: `${PRODUCT_CATEGORY_LABELS[p.category]} · ${formatBRL(p.price)} / ${p.sales_unit}` }));

  return (
    <form onSubmit={onSubmit} className="space-y-4 pb-28 lg:pb-0" noValidate>
      {order && <input type="hidden" name="id" value={order.id} />}
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="discount" value={discount} />
      <input type="hidden" name="items" value={JSON.stringify(parsed)} />

      <Card className="space-y-4 p-4 sm:p-5">
        <Field label="Tipo">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['pedido_realizado', 'Pedido realizado'],
                ['orcamento', 'Orçamento'],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setStatus(v)}
                aria-pressed={status === v}
                className={cn('h-11 rounded-xl text-sm font-semibold ring-1', status === v ? 'bg-nori-900 text-white ring-nori-900' : 'bg-surface ring-line-strong')}
              >
                {l}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Cliente" required error={errors.company_id}>
          <Picker name="company_id" title="Cliente" options={companies} value={company} onChange={setCompany} placeholder="Buscar cliente" allowClear={false} invalid={!!errors.company_id} />
        </Field>
        {company && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Comprador">
              <Picker name="contact_id" title="Comprador" options={contacts.filter((c) => c.company_id === company)} defaultValue={order?.contact_id ?? initial?.contact ?? null} placeholder="Opcional" />
            </Field>
            <Field label="Oportunidade" hint="Ao faturar, ela é marcada como venda.">
              <Picker name="opportunity_id" title="Oportunidade" options={opportunities.filter((o) => o.company_id === company)} defaultValue={order?.opportunity_id ?? initial?.opportunity ?? null} placeholder="Opcional" />
            </Field>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data do pedido" htmlFor="order_date" required error={errors.order_date}>
            <Input id="order_date" name="order_date" type="date" defaultValue={order?.order_date ?? todayISO()} />
          </Field>
          {sellers && (
            <Field label="Vendedor" hint="Em branco: mantém o atual / você.">
              <Picker name="owner_id" title="Vendedor" options={sellers} defaultValue={order?.owner_id ?? null} placeholder="Selecionar" />
            </Field>
          )}
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-semibold">Produtos</h2>
          <span className="text-sm text-muted">{lines.length} item(ns)</span>
        </div>
        {lines.length > 0 && (
          <ul className="mb-4 divide-y divide-line">
            {lines.map((l, idx) => {
              const p = productMap.get(l.product_id);
              const lineTotal = calcLineSubtotal(parseDecimal(l.quantity) || 0, parseDecimal(l.unit_price) || 0);
              const err = errors[`items.${idx}.quantity`] ?? errors[`items.${idx}.unit_price`];
              return (
                <li key={l.key} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{p?.name ?? 'Produto'}</p>
                      <p className="text-xs text-muted">
                        SKU {p?.sku} · tabela {formatBRL(p?.price)} / {p?.sales_unit}
                      </p>
                    </div>
                    <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-600" aria-label={`Remover ${p?.name}`}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr_1fr] items-end gap-2 sm:grid-cols-[auto_9rem_1fr]">
                    <div>
                      <span className="mb-1 block text-xs text-muted">Quantidade</span>
                      <div className="flex items-center">
                        <button type="button" onClick={() => step(l.key, -1)} className="flex size-11 items-center justify-center rounded-l-lg bg-rice ring-1 ring-line-strong sm:size-10" aria-label="Diminuir">
                          <Minus className="size-4" />
                        </button>
                        <input
                          value={l.quantity}
                          onChange={(e) => update(l.key, { quantity: e.target.value })}
                          inputMode="decimal"
                          aria-label="Quantidade"
                          className="num h-11 w-20 bg-surface text-center text-base ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand sm:h-10 sm:text-sm"
                        />
                        <button type="button" onClick={() => step(l.key, 1)} className="flex size-11 items-center justify-center rounded-r-lg bg-rice ring-1 ring-line-strong sm:size-10" aria-label="Aumentar">
                          <Plus className="size-4" />
                        </button>
                      </div>
                    </div>
                    <label>
                      <span className="mb-1 block text-xs text-muted">Preço unitário</span>
                      <Input value={l.unit_price} onChange={(e) => update(l.key, { unit_price: e.target.value })} inputMode="decimal" className="num" />
                    </label>
                    <p className="num col-span-2 text-right text-sm sm:col-span-1">
                      <span className="block text-xs text-muted">Subtotal</span>
                      <span className="font-semibold">{formatBRL(lineTotal)}</span>
                    </p>
                  </div>
                  {err && <p className="mt-1 text-xs text-red-600">{err[0]}</p>}
                </li>
              );
            })}
          </ul>
        )}
        <Picker options={available} value={null} onChange={addProduct} placeholder="+ Adicionar produto" title="Adicionar produto" allowClear={false} invalid={!!errors.items} />
        {errors.items && <p className="mt-1 text-xs font-medium text-red-600">{errors.items[0]}</p>}
      </Card>

      <Card className="space-y-4 p-4 sm:p-5">
        <Field label="Desconto (R$)" htmlFor="discount_input" error={errors.discount}>
          <Input id="discount_input" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0,00" />
        </Field>
        <Field label="Observações" htmlFor="notes">
          <Textarea id="notes" name="notes" defaultValue={order?.notes ?? ''} placeholder="Prazo de entrega, condição de pagamento…" className="min-h-16" />
        </Field>
        <dl className="num space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal ({totalUnits.toLocaleString('pt-BR')} un.)</dt>
            <dd>{formatBRL(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Desconto</dt>
            <dd>− {formatBRL(disc)}</dd>
          </div>
          <div className="flex justify-between text-lg font-semibold">
            <dt>Total</dt>
            <dd>{formatBRL(total)}</dd>
          </div>
        </dl>
      </Card>

      <FormError message={state.error} />
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-surface/95 p-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <p className="num flex-1 text-sm lg:hidden">
            <span className="block text-xs text-muted">Total</span>
            <span className="text-lg font-semibold">{formatBRL(total)}</span>
          </p>
          <Button type="submit" size="xl" className="flex-1 lg:flex-none" disabled={pending}>
            {pending ? 'Salvando…' : order ? 'Salvar pedido' : status === 'orcamento' ? 'Salvar orçamento' : 'Registrar pedido'}
          </Button>
        </div>
      </div>
    </form>
  );
}
