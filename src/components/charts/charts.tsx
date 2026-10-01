'use client';

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatBRL, formatBRLCompact, formatInt, formatMonth } from '@/lib/format';
import { cn } from '@/lib/utils';

// Série única em verde-nori; o mês atual ganha a cor da marca como destaque.
const SERIES = '#2f463c';
const HIGHLIGHT = 'var(--color-brand)';
const GRID = '#e2e5e0';
const AXIS = '#66706b';

type Fmt = 'brl' | 'int';
const fmt = (v: number, f: Fmt) => (f === 'brl' ? formatBRL(v) : `${formatInt(v)} un.`);
const fmtShort = (v: number, f: Fmt) => (f === 'brl' ? formatBRLCompact(v) : formatInt(v));

function TooltipBox({ title, lines }: { title: string; lines: { label: string; value: string }[] }) {
  return (
    <div className="rounded-lg bg-nori-900 px-3 py-2 text-xs text-white shadow-lg">
      <p className="mb-1 font-semibold">{title}</p>
      {lines.map((l) => (
        <p key={l.label} className="num flex justify-between gap-4">
          <span className="text-white/70">{l.label}</span>
          <span>{l.value}</span>
        </p>
      ))}
    </div>
  );
}

/** Evolução mensal — uma métrica por vez (nunca eixo duplo). */
export function MonthlyChart({ data }: { data: { month: string; revenue: number; volume: number; orders: number }[] }) {
  const [metric, setMetric] = React.useState<'revenue' | 'volume'>('revenue');
  const f: Fmt = metric === 'revenue' ? 'brl' : 'int';
  const last = data.length - 1;
  return (
    <div>
      <div className="mb-3 inline-flex rounded-lg bg-rice p-0.5 ring-1 ring-line" role="tablist" aria-label="Métrica">
        {(
          [
            ['revenue', 'Faturamento'],
            ['volume', 'Volume'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={metric === k}
            onClick={() => setMetric(k)}
            className={cn('rounded-md px-3 py-1.5 text-xs font-medium', metric === k ? 'bg-surface shadow-sm' : 'text-muted')}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis
              dataKey="month"
              tickFormatter={(m) => formatMonth(m)}
              tick={{ fontSize: 11, fill: AXIS }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis tickFormatter={(v) => fmtShort(v, f)} tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} width={64} />
            <Tooltip
              cursor={{ fill: 'rgba(23,37,31,0.05)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as (typeof data)[number];
                return (
                  <TooltipBox
                    title={formatMonth(d.month)}
                    lines={[
                      { label: 'Faturamento', value: formatBRL(d.revenue) },
                      { label: 'Volume', value: `${formatInt(d.volume)} un.` },
                      { label: 'Pedidos', value: formatInt(d.orders) },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey={metric} radius={[4, 4, 0, 0]} maxBarSize={36}>
              {data.map((_, i) => (
                <Cell key={i} fill={i === last ? HIGHLIGHT : SERIES} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-muted">
        Mês atual em destaque · {fmt(data.reduce((s, d) => s + d[metric], 0), f)} em 12 meses.
      </p>
    </div>
  );
}

/** Barras horizontais ranqueadas (produto, cliente, vendedor). */
export function RankBars({
  data,
  format,
  emptyText = 'Sem dados no período.',
  max = 10,
}: {
  data: { label: string; value: number; sub?: string }[];
  format: Fmt;
  emptyText?: string;
  max?: number;
}) {
  const rows = data.slice(0, max);
  if (!rows.length) return <p className="py-8 text-center text-sm text-muted">{emptyText}</p>;
  const top = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={`${r.label}-${i}`} className="group">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="num shrink-0 font-semibold">{fmt(r.value, format)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-line/60" title={`${r.label}: ${fmt(r.value, format)}${r.sub ? ` · ${r.sub}` : ''}`}>
            <div className="h-2 rounded-full bg-nori-700 group-hover:bg-brand" style={{ width: `${Math.max((r.value / top) * 100, 1.5)}%` }} />
          </div>
          {r.sub && <p className="mt-0.5 text-xs text-muted">{r.sub}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Funil comercial: quantidade (barra) e valor (à direita) por etapa. */
export function Funnel({
  stages,
}: {
  stages: { key: string; name: string; color: string; count: number; value: number; closed?: boolean }[];
}) {
  const open = stages.filter((s) => !s.closed);
  const closed = stages.filter((s) => s.closed);
  const top = Math.max(...stages.map((s) => s.count), 1);
  const row = (s: (typeof stages)[number]) => (
    <li key={s.key} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[9rem_1fr_auto]">
      <span className="truncate text-muted">{s.name}</span>
      <div className="h-6 rounded-md bg-line/40">
        <div
          className="flex h-6 items-center rounded-md px-2 text-xs font-semibold text-white"
          style={{ width: `${Math.max((s.count / top) * 100, s.count ? 8 : 0)}%`, background: s.color }}
          title={`${s.name}: ${s.count} oportunidade(s)`}
        >
          {s.count > 0 ? s.count : ''}
        </div>
      </div>
      <span className="num w-20 text-right font-medium">{formatBRLCompact(s.value)}</span>
    </li>
  );
  return (
    <div>
      <ul className="space-y-1.5">{open.map(row)}</ul>
      {closed.length > 0 && (
        <>
          <p className="mb-1.5 mt-4 text-xs text-muted">Fechadas no período</p>
          <ul className="space-y-1.5">{closed.map(row)}</ul>
        </>
      )}
    </div>
  );
}
