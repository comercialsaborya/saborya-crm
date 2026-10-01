'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { saveTask } from '@/app/actions/crm';
import { useFormAction } from '@/hooks/use-form-action';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field, FormError } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Picker, type PickerOption } from '@/components/ui/picker';
import { OPTIONS } from '@/lib/constants';
import { addDaysISO, todayISO } from '@/lib/format';

type ContactOpt = PickerOption & { company_id: string };

export function TaskForm({
  companies,
  contacts,
  sellers,
  companyId,
  onDone,
}: {
  companies: PickerOption[];
  contacts: ContactOpt[];
  sellers?: PickerOption[];
  companyId?: string;
  onDone?: () => void;
}) {
  const [company, setCompany] = React.useState<string | null>(companyId ?? null);
  const { state, pending, onSubmit, errors } = useFormAction(saveTask, { onSuccess: onDone });
  const today = todayISO();
  const quickDates = [
    { label: 'Hoje', value: today },
    { label: 'Amanhã', value: addDaysISO(today, 1) },
    { label: 'Em 3 dias', value: addDaysISO(today, 3) },
    { label: 'Em 1 semana', value: addDaysISO(today, 7) },
  ];
  const [due, setDue] = React.useState(addDaysISO(today, 1));
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="O que precisa ser feito?" htmlFor="title" required error={errors.title}>
        <Input id="title" name="title" placeholder="Ex.: Ligar para o comprador sobre a proposta" autoFocus aria-invalid={!!errors.title} />
      </Field>
      <Field label="Prazo" required error={errors.due_date}>
        <div className="flex flex-wrap gap-2">
          {quickDates.map((d) => (
            <button
              key={d.label}
              type="button"
              onClick={() => setDue(d.value)}
              className={`h-9 rounded-full px-3 text-sm ring-1 ${due === d.value ? 'bg-nori-900 text-white ring-nori-900' : 'bg-surface ring-line-strong'}`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Input type="date" name="due_date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Data" />
          <Input type="time" name="due_time" aria-label="Hora (opcional)" />
        </div>
      </Field>
      <Field label="Prioridade" htmlFor="priority">
        <Select id="priority" name="priority" defaultValue="media" options={OPTIONS.priority} />
      </Field>
      <Field label="Cliente" error={errors.company_id}>
        <Picker name="company_id" title="Cliente" options={companies} value={company} onChange={setCompany} placeholder="Opcional" />
      </Field>
      {company && (
        <Field label="Comprador">
          <Picker name="contact_id" title="Comprador" options={contacts.filter((c) => c.company_id === company)} placeholder="Opcional" />
        </Field>
      )}
      {sellers && sellers.length > 0 && (
        <Field label="Responsável" hint="Em branco: você.">
          <Picker name="owner_id" title="Responsável" options={sellers} placeholder="Eu mesmo" />
        </Field>
      )}
      <Field label="Detalhes" htmlFor="description">
        <Textarea id="description" name="description" className="min-h-16" />
      </Field>
      <FormError message={state.error} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Salvando…' : 'Criar tarefa'}
      </Button>
    </form>
  );
}

export function NewTaskButton(props: Omit<React.ComponentProps<typeof TaskForm>, 'onDone'> & { label?: string; variant?: 'primary' | 'secondary' }) {
  const [open, setOpen] = React.useState(false);
  const { label = 'Nova tarefa', variant = 'primary', ...rest } = props;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant}>
          <Plus /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent title="Nova tarefa">
        <TaskForm {...rest} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
