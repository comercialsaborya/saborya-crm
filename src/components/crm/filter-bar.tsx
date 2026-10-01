'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Select } from '@/components/ui/input';
import { Picker, type PickerOption } from '@/components/ui/picker';
import { PERIOD_PRESETS } from '@/lib/periods';
import { cn } from '@/lib/utils';

export type FilterField =
  | { type: 'search'; name: string; placeholder?: string }
  | { type: 'select'; name: string; label: string; options: { value: string; label: string }[] }
  | { type: 'picker'; name: string; label: string; options: PickerOption[] }
  | { type: 'period'; defaultPreset?: string }
  | { type: 'text'; name: string; label: string };

/**
 * Filtros sincronizados com a URL (compartilháveis e usados pela exportação).
 * No celular, os filtros secundários ficam recolhidos.
 */
export function FilterBar({ fields, className }: { fields: FilterField[]; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = React.useState(false);

  const setParams = React.useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(changes)) {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      }
      next.delete('pagina');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const search = fields.find((f) => f.type === 'search') as Extract<FilterField, { type: 'search' }> | undefined;
  const others = fields.filter((f) => f.type !== 'search');
  const activeCount = others.reduce((n, f) => {
    if (f.type === 'period') return n + (params.get('periodo') ? 1 : 0);
    return n + (params.get(f.name) ? 1 : 0);
  }, 0);

  return (
    <div className={cn('mb-4 space-y-2', className)}>
      <div className="flex gap-2">
        {search && <SearchInput key={params.get(search.name) ?? ''} name={search.name} placeholder={search.placeholder} value={params.get(search.name) ?? ''} onChange={(v) => setParams({ [search.name]: v })} />}
        {others.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className={cn(
              'flex h-11 shrink-0 items-center gap-2 rounded-lg bg-surface px-3 text-sm font-medium ring-1 ring-inset ring-line-strong md:hidden',
              activeCount > 0 && 'ring-brand text-brand',
            )}
            aria-expanded={open}
          >
            <SlidersHorizontal className="size-4" />
            Filtros{activeCount > 0 ? ` (${activeCount})` : ''}
          </button>
        )}
      </div>
      {others.length > 0 && (
        <div className={cn('grid grid-cols-1 gap-2 sm:grid-cols-2 md:flex md:flex-wrap md:items-center', !open && 'hidden md:flex')}>
          {others.map((f, i) => {
            if (f.type === 'period') {
              const preset = params.get('periodo') ?? f.defaultPreset ?? 'mes';
              return (
                <div key={`p${i}`} className="contents">
                  <Select
                    aria-label="Período"
                    className="md:w-52"
                    value={preset}
                    onChange={(e) => setParams({ periodo: e.target.value, ...(e.target.value !== 'personalizado' ? { de: null, ate: null } : {}) })}
                    options={PERIOD_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
                  />
                  {preset === 'personalizado' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        aria-label="De"
                        defaultValue={params.get('de') ?? ''}
                        onChange={(e) => setParams({ de: e.target.value })}
                        className="h-11 rounded-lg bg-surface px-3 text-sm ring-1 ring-inset ring-line-strong md:h-10"
                      />
                      <span className="text-sm text-muted">a</span>
                      <input
                        type="date"
                        aria-label="Até"
                        defaultValue={params.get('ate') ?? ''}
                        onChange={(e) => setParams({ ate: e.target.value })}
                        className="h-11 rounded-lg bg-surface px-3 text-sm ring-1 ring-inset ring-line-strong md:h-10"
                      />
                    </div>
                  )}
                </div>
              );
            }
            if (f.type === 'select') {
              return (
                <Select
                  key={f.name}
                  aria-label={f.label}
                  className="md:w-48"
                  value={params.get(f.name) ?? ''}
                  onChange={(e) => setParams({ [f.name]: e.target.value })}
                  placeholder={`${f.label}: todos`}
                  options={f.options}
                />
              );
            }
            if (f.type === 'picker') {
              return (
                <div key={f.name} className="md:w-56">
                  <Picker
                    title={f.label}
                    placeholder={`${f.label}: todos`}
                    options={f.options}
                    value={params.get(f.name)}
                    onChange={(v) => setParams({ [f.name]: v })}
                  />
                </div>
              );
            }
            return (
              <TextFilter key={`${f.name}:${params.get(f.name) ?? ''}`} label={f.label} value={params.get(f.name) ?? ''} onChange={(v) => setParams({ [f.name]: v })} />
            );
          })}
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => setParams(Object.fromEntries([...others.flatMap((f) => (f.type === 'period' ? ['periodo', 'de', 'ate'] : [f.name]))].map((k) => [k, null])))}
              className="flex h-10 items-center gap-1 px-2 text-sm text-muted hover:text-ink"
            >
              <X className="size-4" /> Limpar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }: { name: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [v, setV] = React.useState(value);
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      if (v !== value) onChange(v.trim());
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);
  return (
    <div className="relative flex-1 md:max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={placeholder ?? 'Buscar…'}
        className="h-11 w-full rounded-lg bg-surface pl-9 pr-3 text-base ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand md:h-10 md:text-sm"
      />
    </div>
  );
}

function TextFilter({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [v, setV] = React.useState(value);
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onChange(v.trim())}
      onKeyDown={(e) => e.key === 'Enter' && onChange(v.trim())}
      placeholder={label}
      aria-label={label}
      className="h-11 rounded-lg bg-surface px-3 text-base ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand md:h-10 md:w-40 md:text-sm"
    />
  );
}
