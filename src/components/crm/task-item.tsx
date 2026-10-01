'use client';

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CalendarClock, Check, MoreHorizontal, RotateCcw, X } from 'lucide-react';
import { postponeTask, setTaskStatus } from '@/app/actions/crm';
import { Badge } from '@/components/ui/badge';
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from '@/components/ui/dropdown';
import { PRIORITY } from '@/lib/constants';
import { addDaysISO, formatShortDate, todayISO } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TaskRow } from '@/types/db';
import { ContactActions } from './contact-actions';

export function TaskItem({ task, showCompany = true, showOwner = false }: { task: TaskRow; showCompany?: boolean; showOwner?: boolean }) {
  const [pending, start] = React.useTransition();
  const [done, setDone] = React.useState(task.status === 'concluida');
  const today = todayISO();
  const overdue = task.status === 'pendente' && task.due_date < today;

  const run = (fn: () => Promise<{ ok?: boolean; error?: string; message?: string }>, optimistic?: () => void) => {
    optimistic?.();
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message);
      else {
        setDone(task.status === 'concluida');
        toast.error(r.error);
      }
    });
  };

  return (
    <div className={cn('flex items-start gap-3 rounded-[var(--radius-card)] bg-surface p-3 ring-1 ring-line', overdue && 'ring-red-200 bg-red-50/40', pending && 'opacity-60')}>
      <button
        type="button"
        onClick={() =>
          run(() => setTaskStatus(task.id, done ? 'pendente' : 'concluida'), () => setDone((d) => !d))
        }
        className={cn(
          'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ring-2',
          done ? 'bg-green-600 text-white ring-green-600' : 'ring-line-strong hover:ring-brand',
        )}
        aria-label={done ? 'Reabrir tarefa' : 'Concluir tarefa'}
      >
        {done && <Check className="size-4" strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium', done && 'text-muted line-through')}>{task.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span className={cn('font-medium', overdue ? 'text-red-600' : task.due_date === today ? 'text-ink' : '')}>
            {overdue ? `Atrasada · ${formatShortDate(task.due_date)}` : task.due_date === today ? 'Hoje' : formatShortDate(task.due_date)}
            {task.due_time ? ` ${task.due_time.slice(0, 5)}` : ''}
          </span>
          <Badge className={PRIORITY[task.priority].className}>{PRIORITY[task.priority].label}</Badge>
          {showCompany && task.company_name && task.company_id && (
            <Link href={`/clientes/${task.company_id}`} className="truncate hover:text-ink">
              {task.company_name}
            </Link>
          )}
          {task.contact_name && <span>· {task.contact_name}</span>}
          {showOwner && task.owner_name && <span>· {task.owner_name}</span>}
        </div>
        {task.description && <p className="mt-1 text-xs text-muted">{task.description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!done && <ContactActions size="sm" whatsapp={task.contact_whatsapp} phone={task.contact_phone} className="hidden sm:flex" />}
        <Dropdown>
          <DropdownTrigger asChild>
            <button type="button" className="rounded-lg p-2 text-muted hover:bg-black/5" aria-label="Mais ações">
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownTrigger>
          <DropdownContent>
            {!done && (
              <>
                <DropdownItem onSelect={() => run(() => postponeTask(task.id, addDaysISO(today, 1)))}>
                  <CalendarClock /> Adiar para amanhã
                </DropdownItem>
                <DropdownItem onSelect={() => run(() => postponeTask(task.id, addDaysISO(today, 7)))}>
                  <CalendarClock /> Adiar 1 semana
                </DropdownItem>
                <DropdownItem onSelect={() => run(() => setTaskStatus(task.id, 'cancelada'))}>
                  <X /> Cancelar tarefa
                </DropdownItem>
              </>
            )}
            {done && (
              <DropdownItem onSelect={() => run(() => setTaskStatus(task.id, 'pendente'), () => setDone(false))}>
                <RotateCcw /> Reabrir
              </DropdownItem>
            )}
          </DropdownContent>
        </Dropdown>
      </div>
    </div>
  );
}
