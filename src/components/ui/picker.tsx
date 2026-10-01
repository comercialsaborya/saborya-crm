'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { Dialog, DialogContent } from './dialog';
import { cn } from '@/lib/utils';

export type PickerOption = { value: string; label: string; description?: string | null };

/**
 * Seleção com busca, pensada para o celular (abre em folha inferior).
 * Envia o valor no formulário via input hidden com `name`.
 */
export function Picker({
  name,
  options,
  value: controlled,
  defaultValue,
  onChange,
  placeholder = 'Selecionar…',
  title = 'Selecionar',
  emptyText = 'Nada encontrado.',
  allowClear = true,
  invalid,
  id,
  disabled,
}: {
  name?: string;
  options: PickerOption[];
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string | null) => void;
  placeholder?: string;
  title?: string;
  emptyText?: string;
  allowClear?: boolean;
  invalid?: boolean;
  id?: string;
  disabled?: boolean;
}) {
  const [internal, setInternal] = React.useState<string | null>(defaultValue ?? null);
  const value = controlled !== undefined ? controlled : internal;
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const selected = options.find((o) => o.value === value);

  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const filtered = React.useMemo(() => {
    const t = norm(q.trim());
    if (!t) return options.slice(0, 200);
    return options.filter((o) => norm(`${o.label} ${o.description ?? ''}`).includes(t)).slice(0, 200);
  }, [q, options]);

  const choose = (v: string | null) => {
    if (controlled === undefined) setInternal(v);
    onChange?.(v);
    setOpen(false);
    setQ('');
  };

  return (
    <>
      {name && <input type="hidden" name={name} value={value ?? ''} />}
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen(true)}
        className={cn(
          'flex h-11 w-full items-center justify-between gap-2 rounded-lg bg-surface px-3 text-left text-base ring-1 ring-inset ring-line-strong sm:h-10 sm:text-sm',
          'focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-60 aria-[invalid=true]:ring-red-500',
        )}
      >
        <span className={cn('truncate', !selected && 'text-muted/80')}>{selected?.label ?? placeholder}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={title}>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar…"
              className="h-11 w-full rounded-lg bg-rice pl-9 pr-3 text-base ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-brand sm:text-sm"
            />
          </div>
          <ul className="-mx-2 max-h-[55dvh] overflow-y-auto">
            {allowClear && value && (
              <li>
                <button
                  type="button"
                  onClick={() => choose(null)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-sm text-muted hover:bg-rice"
                >
                  <X className="size-4" /> Limpar seleção
                </button>
              </li>
            )}
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => choose(o.value)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left hover:bg-rice"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{o.label}</span>
                    {o.description && <span className="block truncate text-xs text-muted">{o.description}</span>}
                  </span>
                  {o.value === value && <Check className="size-4 shrink-0 text-brand" />}
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">{emptyText}</li>}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
