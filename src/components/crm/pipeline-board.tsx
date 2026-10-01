'use client';

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CalendarClock, Clock, User } from 'lucide-react';
import { moveOpportunity } from '@/app/actions/crm';
import { TemperatureBadge } from '@/components/ui/misc';
import { formatBRLCompact, formatShortDate, todayISO } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { OpportunityBoardRow, PipelineStage } from '@/types/db';

export function PipelineBoard({
  stages,
  opportunities,
  showOwner,
}: {
  stages: PipelineStage[];
  opportunities: OpportunityBoardRow[];
  showOwner: boolean;
}) {
  const [items, setItems] = React.useState(opportunities);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const firstOpen = stages.find((s) => items.some((o) => o.stage_key === s.key && !s.is_won && !s.is_lost))?.key ?? stages[0]?.key;
  const [mobileStage, setMobileStage] = React.useState<string>(firstOpen);
  // Sincroniza quando o servidor envia dados novos (tempo real / filtros).
  const [source, setSource] = React.useState(opportunities);
  if (source !== opportunities) {
    setSource(opportunities);
    setItems(opportunities);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  const move = React.useCallback(
    async (id: string, stageKey: string) => {
      const opp = items.find((o) => o.id === id);
      const stage = stages.find((s) => s.key === stageKey);
      if (!opp || !stage || opp.stage_key === stageKey) return;
      let reason: string | undefined;
      if (stage.is_lost) {
        const r = window.prompt('Motivo da perda (opcional):');
        if (r === null) return;
        reason = r || undefined;
      }
      const previous = items;
      setItems((list) =>
        list.map((o) =>
          o.id === id
            ? {
                ...o,
                stage_key: stageKey,
                stage_name: stage.name,
                days_in_stage: 0,
                temperature: stage.is_won ? 'cliente' : stage.is_lost ? 'perdido' : o.temperature,
              }
            : o,
        ),
      );
      const res = await moveOpportunity(id, stageKey, reason);
      if (res.ok) toast.success(`Movida para ${stage.name}.`);
      else {
        setItems(previous);
        toast.error(res.error);
      }
    },
    [items, stages],
  );

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (e.over) void move(String(e.active.id), String(e.over.id));
  };
  const active = items.find((o) => o.id === activeId);

  const byStage = (key: string) => items.filter((o) => o.stage_key === key);

  return (
    <>
      {/* Celular: etapas em abas + lista */}
      <div className="md:hidden">
        <div className="scrollbar-thin -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {stages.map((s) => {
            const list = byStage(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setMobileStage(s.key)}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-medium ring-1',
                  mobileStage === s.key ? 'bg-nori-900 text-white ring-nori-900' : 'bg-surface ring-line-strong',
                )}
              >
                <span className="size-2 rounded-full" style={{ background: s.color }} />
                {s.name}
                <span className={cn('text-xs', mobileStage === s.key ? 'text-white/70' : 'text-muted')}>{list.length}</span>
              </button>
            );
          })}
        </div>
        <StageSummary list={byStage(mobileStage)} />
        <ul className="mt-2 space-y-2">
          {byStage(mobileStage).map((o) => (
            <li key={o.id}>
              <OppCard opp={o} showOwner={showOwner}>
                <select
                  aria-label="Mover para etapa"
                  value={o.stage_key}
                  onChange={(e) => void move(o.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-3 h-10 w-full rounded-lg bg-rice px-3 text-sm ring-1 ring-line"
                >
                  {stages.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.key === o.stage_key ? `Etapa: ${s.name}` : `Mover para: ${s.name}`}
                    </option>
                  ))}
                </select>
              </OppCard>
            </li>
          ))}
          {byStage(mobileStage).length === 0 && <li className="py-10 text-center text-sm text-muted">Nenhuma oportunidade nesta etapa.</li>}
        </ul>
      </div>

      {/* Desktop/tablet: Kanban */}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="scrollbar-thin -mx-4 hidden gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 md:flex lg:-mx-8 lg:px-8">
          {stages.map((s) => (
            <Column key={s.key} stage={s} list={byStage(s.key)} showOwner={showOwner} />
          ))}
        </div>
        <DragOverlay>{active ? <OppCard opp={active} showOwner={showOwner} dragging /> : null}</DragOverlay>
      </DndContext>
    </>
  );
}

function StageSummary({ list }: { list: OpportunityBoardRow[] }) {
  const total = list.reduce((s, o) => s + Number(o.estimated_value), 0);
  return (
    <p className="text-sm text-muted">
      {list.length} oportunidade(s) · <span className="num font-semibold text-ink">{formatBRLCompact(total)}</span>
    </p>
  );
}

function Column({ stage, list, showOwner }: { stage: PipelineStage; list: OpportunityBoardRow[]; showOwner: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });
  const total = list.reduce((s, o) => s + Number(o.estimated_value), 0);
  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-[var(--radius-card)] bg-line/40 transition-colors',
        isOver && 'bg-brand-soft ring-2 ring-brand',
      )}
      aria-label={stage.name}
    >
      <header className="sticky top-0 px-3 pb-2 pt-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <span className="size-2.5 rounded-full" style={{ background: stage.color }} />
            {stage.name}
          </h2>
          <span className="rounded-full bg-surface px-2 text-xs font-medium text-muted">{list.length}</span>
        </div>
        <p className="num mt-0.5 text-xs text-muted">{formatBRLCompact(total)}</p>
      </header>
      <div className="flex min-h-40 flex-1 flex-col gap-2 px-2 pb-2">
        {list.map((o) => (
          <Draggable key={o.id} opp={o} showOwner={showOwner} />
        ))}
      </div>
    </section>
  );
}

function Draggable({ opp, showOwner }: { opp: OpportunityBoardRow; showOwner: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: opp.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={cn('touch-manipulation', isDragging && 'opacity-30')}>
      <OppCard opp={opp} showOwner={showOwner} />
    </div>
  );
}

function OppCard({
  opp,
  showOwner,
  dragging,
  children,
}: {
  opp: OpportunityBoardRow;
  showOwner: boolean;
  dragging?: boolean;
  children?: React.ReactNode;
}) {
  const today = todayISO();
  const next = opp.next_task_date ?? opp.next_activity_date;
  const overdue = next && next < today;
  const stale = !opp.is_won && !opp.is_lost && opp.days_without_contact >= 14;
  return (
    <div className={cn('rounded-xl bg-surface p-3 ring-1 ring-line', dragging && 'rotate-2 shadow-xl ring-brand')}>
      <Link href={`/oportunidades/${opp.id}`} className="block" draggable={false}>
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-sm font-semibold leading-snug">{opp.company_name}</p>
          <p className="num shrink-0 text-sm font-semibold">{formatBRLCompact(opp.estimated_value)}</p>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted">{opp.title}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <TemperatureBadge value={opp.temperature} />
          {opp.contact_name && (
            <span className="flex items-center gap-1 text-xs text-muted">
              <User className="size-3" />
              {opp.contact_name}
            </span>
          )}
        </div>
        <div className="mt-2 space-y-0.5 text-xs">
          <p className={cn('flex items-center gap-1', stale ? 'font-medium text-red-600' : 'text-muted')}>
            <Clock className="size-3" />
            {opp.days_without_contact === 0 ? 'Contato hoje' : `${opp.days_without_contact} dia(s) sem contato`}
          </p>
          <p className={cn('flex items-center gap-1', overdue ? 'font-medium text-red-600' : next ? 'text-ink' : 'text-muted')}>
            <CalendarClock className="size-3" />
            {next ? `Próxima: ${formatShortDate(next)}${opp.next_task_title || opp.next_activity_note ? ` · ${opp.next_task_title ?? opp.next_activity_note}` : ''}` : 'Sem próxima atividade'}
          </p>
          {showOwner && opp.owner_name && <p className="text-muted">{opp.owner_name}</p>}
        </div>
      </Link>
      {children}
    </div>
  );
}
