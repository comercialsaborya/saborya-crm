'use client';

import * as React from 'react';
import { Pencil, Plus } from 'lucide-react';
import { saveProduct } from '@/app/actions/admin';
import { useFormAction } from '@/hooks/use-form-action';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field, FormError } from '@/components/ui/field';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/input';
import { OPTIONS } from '@/lib/constants';
import { formatPercent } from '@/lib/format';
import { parseDecimal } from '@/lib/validation';
import type { Product } from '@/types/db';

const dec = (v: unknown) => (v === null || v === undefined ? '' : String(v).replace('.', ','));

export function ProductDialog({ product }: { product?: Product }) {
  const [open, setOpen] = React.useState(false);
  const [price, setPrice] = React.useState(dec(product?.price));
  const [cost, setCost] = React.useState(dec(product?.cost));
  const { state, pending, onSubmit, errors } = useFormAction(saveProduct, { onSuccess: () => setOpen(false) });
  const p = parseDecimal(price) ?? 0;
  const c = parseDecimal(cost) ?? 0;
  const margin = p > 0 ? ((p - c) / p) * 100 : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {product ? (
          <Button variant="secondary" size="sm">
            <Pencil /> Editar
          </Button>
        ) : (
          <Button>
            <Plus /> Novo produto
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={product ? 'Editar produto' : 'Novo produto'}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {product && <input type="hidden" name="id" value={product.id} />}
          <Field label="Nome" htmlFor="name" required error={errors.name}>
            <Input id="name" name="name" defaultValue={product?.name} aria-invalid={!!errors.name} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU" htmlFor="sku" required error={errors.sku}>
              <Input id="sku" name="sku" defaultValue={product?.sku} className="uppercase" aria-invalid={!!errors.sku} />
            </Field>
            <Field label="Categoria" htmlFor="category" required>
              <Select id="category" name="category" defaultValue={product?.category ?? 'onigiri'} options={OPTIONS.productCategory} />
            </Field>
            <Field label="Unidade de venda" htmlFor="sales_unit" required error={errors.sales_unit}>
              <Input id="sales_unit" name="sales_unit" defaultValue={product?.sales_unit ?? 'unidade'} placeholder="unidade, caixa, pacote" />
            </Field>
            <Field label="Margem" hint="Calculada automaticamente">
              <p className="num flex h-10 items-center text-sm font-semibold">{formatPercent(margin)}</p>
            </Field>
            <Field label="Preço (R$)" htmlFor="price" required error={errors.price}>
              <Input id="price" name="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} aria-invalid={!!errors.price} />
            </Field>
            <Field label="Custo (R$)" htmlFor="cost" required error={errors.cost}>
              <Input id="cost" name="cost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} aria-invalid={!!errors.cost} />
            </Field>
          </div>
          <Field label="Observações" htmlFor="notes">
            <Textarea id="notes" name="notes" defaultValue={product?.notes ?? ''} className="min-h-16" />
          </Field>
          <Checkbox name="active" defaultChecked={product?.active ?? true} label="Produto ativo (aparece em visitas e pedidos)" />
          <FormError message={state.error} />
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? 'Salvando…' : 'Salvar produto'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
