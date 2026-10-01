'use client';

import * as React from 'react';
import { Mail, MessageCircle, Phone, RefreshCcw, ShoppingCart, Users, HeartHandshake, MapPin } from 'lucide-react';
import { saveActivity } from '@/app/actions/crm';
import { useFormAction } from '@/hooks/use-form-action';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/field';
import { Checkbox, Input, Textarea } from '@/components/ui/input';
import { Picker, type PickerOption } from '@/components/ui/picker';
import { ACTIVITY_TYPE_LABELS, type ActivityType } from '@/lib/constants';
import { addDaysISO, nowTimeHM, todayISO } from '@/lib/format';
import { cn } from '@/lib/utils';

type Opt = PickerOption & { company_id: string };

const TYPES: { type: ActivityType; icon: React.ElementType }[] = [
  { type: 'ligacao', icon: Phone },
  { type: 'whatsapp', icon: MessageCircle },
  { type: 'email', icon: Mail },
  { type: 'reuniao', icon: Users },
  { type: 'follow_up', icon: RefreshCcw },
  { type: 'pos_venda', icon: HeartHandshake },
  { type: 'pedido', icon: ShoppingCart },
  { type: 'visita', icon: MapPin },
];

export function ActivityForm({
  companies,
  contacts,
  opportunities,
  initialCompany,
  initialType,
}: {
  companies: PickerOption[];
  contacts: Opt[];
  opportunities: Opt[];
  initialCompany?: string | null;
  initialType?: ActivityType;
}) {
  const [type, setType] = React.useState<ActivityType>(initialType ?? 'ligacao');
  const [company, setCompany] = React.useState<string | null>(initialCompany ?? null);
  const today = todayISO();
  const { state, pending, onSubmit, errors } = useFormAction(saveActivity, { redirectTo: (s) => s.id });
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <input type="hidden" name="type" value={type} />
      <Field label="Tipo">
        <div className="grid grid-cols-4 gap-2">
          {TYPES.map(({ type: t, icon: Icon }) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              aria-pressed={type === t}
              className={cn(
                'flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium ring-1',
                type === t ? 'bg-nori-900 text-white ring-nori-900' : 'bg-surface ring-line-strong',
              )}
            >
              <Icon className="size-5" />
              {ACTIVITY_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        {type === 'visita' && (
          <p className="mt-2 text-xs text-muted">Para visitas presenciais, prefira “Registrar visita” — inclui resultado e localização.</p>
        )}
      </Field>
      <Field label="Cliente" required error={errors.company_id}>
        <Picker name="company_id" title="Cliente" options={companies} value={company} onChange={setCompany} placeholder="Buscar cliente" allowClear={false} />
      </Field>
      {company && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Comprador">
            <Picker name="contact_id" title="Comprador" options={contacts.filter((c) => c.company_id === company)} placeholder="Opcional" />
          </Field>
          <Field label="Oportunidade">
            <Picker name="opportunity_id" title="Oportunidade" options={opportunities.filter((o) => o.company_id === company)} placeholder="Opcional" />
          </Field>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data" htmlFor="activity_date" required error={errors.activity_date}>
          <Input id="activity_date" name="activity_date" type="date" defaultValue={today} />
        </Field>
        <Field label="Hora" htmlFor="activity_time" required error={errors.activity_time}>
          <Input id="activity_time" name="activity_time" type="time" defaultValue={nowTimeHM()} />
        </Field>
      </div>
      <Field label="Descrição" htmlFor="description" required error={errors.description}>
        <Textarea id="description" name="description" placeholder="O que foi tratado?" aria-invalid={!!errors.description} />
      </Field>
      <Field label="Resultado" htmlFor="result">
        <Input id="result" name="result" placeholder="Ex.: pediu proposta, sem resposta…" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Próxima ação" htmlFor="next_action">
          <Input id="next_action" name="next_action" placeholder="Ex.: retornar com amostras" />
        </Field>
        <Field label="Data da próxima ação" htmlFor="next_action_date" error={errors.next_action_date}>
          <Input id="next_action_date" name="next_action_date" type="date" min={today} defaultValue={addDaysISO(today, 3)} />
        </Field>
      </div>
      <Checkbox name="create_follow_up" defaultChecked label="Criar tarefa para a próxima ação" />
      <FormError message={state.error} />
      <Button type="submit" size="xl" className="w-full" disabled={pending}>
        {pending ? 'Salvando…' : 'Registrar atividade'}
      </Button>
    </form>
  );
}
