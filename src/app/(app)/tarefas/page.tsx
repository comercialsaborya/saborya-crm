import type { Metadata } from 'next';
import { CalendarCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { getCompanyOptions, getContactOptions, getSellerOptions, one } from '@/lib/queries';
import { addDaysISO, todayISO } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { FilterBar } from '@/components/crm/filter-bar';
import { TaskItem } from '@/components/crm/task-item';
import { NewTaskButton } from '@/components/crm/task-form';
import { OPTIONS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { TaskRow } from '@/types/db';

export const metadata: Metadata = { title: 'Minhas tarefas' };

export default async function TarefasPage({ searchParams }: PageProps<'/tarefas'>) {
  const session = await requireSession();
  const sp = await searchParams;
  const supabase = await createClient();
  const today = todayISO();
  const in7 = addDaysISO(today, 7);

  let pending = supabase.from('task_list').select('*').eq('status', 'pendente').is('deleted_at', null);
  let done = supabase
    .from('task_list')
    .select('*')
    .eq('status', 'concluida')
    .is('deleted_at', null)
    .gte('completed_at', `${addDaysISO(today, -7)}T00:00:00-03:00`);
  const seller = session.isAdmin ? one(sp.vendedor) : session.userId;
  if (seller) {
    pending = pending.eq('owner_id', seller);
    done = done.eq('owner_id', seller);
  } else if (!session.isAdmin) {
    pending = pending.eq('owner_id', session.userId);
  }
  if (one(sp.prioridade)) pending = pending.eq('priority', one(sp.prioridade)!);

  const [p, d, companies, contacts, sellers] = await Promise.all([
    pending.order('due_date').order('priority').limit(500),
    done.order('completed_at', { ascending: false }).limit(30),
    getCompanyOptions(),
    getContactOptions(),
    session.isAdmin ? getSellerOptions() : Promise.resolve([]),
  ]);
  const tasks = (p.data ?? []) as TaskRow[];
  const groups = [
    { key: 'atrasadas', title: 'Atrasadas', items: tasks.filter((t) => t.due_date < today), alert: true },
    { key: 'hoje', title: 'Hoje', items: tasks.filter((t) => t.due_date === today) },
    { key: '7dias', title: 'Próximos 7 dias', items: tasks.filter((t) => t.due_date > today && t.due_date <= in7) },
    { key: 'futuras', title: 'Futuras', items: tasks.filter((t) => t.due_date > in7) },
  ];
  const completed = (d.data ?? []) as TaskRow[];

  return (
    <>
      <PageHeader
        title={session.isAdmin && !seller ? 'Tarefas da equipe' : 'Minhas tarefas'}
        description="Follow-ups e próximos contatos."
        actions={<NewTaskButton companies={companies} contacts={contacts} sellers={session.isAdmin ? sellers : undefined} />}
      />
      {session.isAdmin && (
        <FilterBar
          fields={[
            { type: 'picker', name: 'vendedor', label: 'Responsável', options: sellers },
            { type: 'select', name: 'prioridade', label: 'Prioridade', options: OPTIONS.priority },
          ]}
        />
      )}
      {tasks.length === 0 && (
        <Card className="mb-4">
          <EmptyState icon={<CalendarCheck />} title="Nenhuma tarefa pendente" description="Crie follow-ups ao registrar visitas e atividades." />
        </Card>
      )}
      <div className="space-y-6">
        {groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <section key={g.key}>
              <h2 className={cn('mb-2 flex items-center gap-2 text-sm font-semibold', g.alert && 'text-red-700')}>
                {g.title}
                <span className={cn('rounded-full px-2 py-0.5 text-xs', g.alert ? 'bg-red-100 text-red-700' : 'bg-line text-muted')}>{g.items.length}</span>
              </h2>
              <div className="space-y-2">
                {g.items.map((t) => (
                  <TaskItem key={t.id} task={t} showOwner={session.isAdmin} />
                ))}
              </div>
            </section>
          ))}
        {completed.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-sm font-semibold text-muted">Concluídas nos últimos 7 dias ({completed.length})</summary>
            <div className="mt-2 space-y-2">
              {completed.map((t) => (
                <TaskItem key={t.id} task={t} showOwner={session.isAdmin} />
              ))}
            </div>
          </details>
        )}
      </div>
    </>
  );
}
