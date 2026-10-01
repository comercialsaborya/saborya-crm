'use client';

import * as React from 'react';
import { saveOpportunity } from '@/app/actions/crm';
import { useFormAction } from '@/hooks/use-form-action';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, FormError } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Picker, type PickerOption } from '@/components/ui/picker';
import { OPTIONS } from '@/lib/constants';
import type { Opportunity, PipelineStage } from '@/types/db';

type ContactOpt = PickerOption & { company_id: string };

export function OpportunityForm({
  opportunity,
  companies,
  contacts,
  stages,
  sellers,
  initialCompany,
}: {
  opportunity?: Opportunity | null;
  companies: PickerOption[];
  contacts: ContactOpt[];
  stages: PipelineStage[];
  sellers?: PickerOption[];
  initialCompany?: string | null;
}) {
  const o = opportunity;
  const [company, setCompany] = React.useState<string | null>(o?.company_id ?? initialCompany ?? null);
  const [stage, setStage] = React.useState(o?.stage_key ?? 'prospeccao');
  const { state, pending, onSubmit, errors } = useFormAction(saveOpportunity, {
    redirectTo: (s) => (s.id ? `/oportunidades/${s.id}` : '/pipeline'),
  });
  const lost = stages.find((s) => s.key === stage)?.is_lost;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {o && <input type="hidden" name="id" value={o.id} />}
      <Card className="space-y-4 p-4 sm:p-5">
        <Field label="Cliente" required error={errors.company_id}>
          <Picker name="company_id" title="Cliente" options={companies} value={company} onChange={setCompany} placeholder="Buscar cliente" allowClear={false} invalid={!!errors.company_id} />
        </Field>
        {company && (
          <Field label="Comprador">
            <Picker name="contact_id" title="Comprador" options={contacts.filter((c) => c.company_id === company)} defaultValue={o?.contact_id ?? null} placeholder="Opcional" />
          </Field>
        )}
        <Field label="Título" htmlFor="title" required error={errors.title}>
          <Input id="title" name="title" defaultValue={o?.title ?? ''} placeholder="Ex.: Linha de onigiris nas 12 lojas" aria-invalid={!!errors.title} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Etapa" htmlFor="stage_key" required>
            <Select id="stage_key" name="stage_key" value={stage} onChange={(e) => setStage(e.target.value)} options={stages.map((s) => ({ value: s.key, label: s.name }))} />
          </Field>
          <Field label="Temperatura" htmlFor="temperature">
            <Select id="temperature" name="temperature" defaultValue={o?.temperature ?? 'interessado'} options={OPTIONS.temperature} />
          </Field>
          <Field label="Valor estimado (R$)" htmlFor="estimated_value" required error={errors.estimated_value} hint="Faturamento esperado com esta oportunidade.">
            <Input id="estimated_value" name="estimated_value" inputMode="decimal" defaultValue={o ? String(o.estimated_value).replace('.', ',') : ''} placeholder="0,00" aria-invalid={!!errors.estimated_value} />
          </Field>
          <Field label="Previsão de fechamento" htmlFor="expected_close_date">
            <Input id="expected_close_date" name="expected_close_date" type="date" defaultValue={o?.expected_close_date ?? ''} />
          </Field>
          <Field label="Próxima atividade" htmlFor="next_activity_note">
            <Input id="next_activity_note" name="next_activity_note" defaultValue={o?.next_activity_note ?? ''} placeholder="Ex.: enviar proposta" />
          </Field>
          <Field label="Data da próxima atividade" htmlFor="next_activity_date">
            <Input id="next_activity_date" name="next_activity_date" type="date" defaultValue={o?.next_activity_date ?? ''} />
          </Field>
          {sellers && (
            <Field label="Vendedor responsável" hint="Em branco: você.">
              <Picker name="owner_id" title="Vendedor" options={sellers} defaultValue={o?.owner_id ?? null} placeholder="Selecionar" />
            </Field>
          )}
        </div>
        {lost && (
          <Field label="Motivo da perda" htmlFor="lost_reason">
            <Input id="lost_reason" name="lost_reason" defaultValue={o?.lost_reason ?? ''} placeholder="Ex.: preço, já tem fornecedor, sem espaço no freezer" />
          </Field>
        )}
        <Field label="Observações" htmlFor="notes">
          <Textarea id="notes" name="notes" defaultValue={o?.notes ?? ''} />
        </Field>
      </Card>
      <FormError message={state.error} />
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending}>
        {pending ? 'Salvando…' : o ? 'Salvar oportunidade' : 'Criar oportunidade'}
      </Button>
    </form>
  );
}
