'use client';

import { saveContact } from '@/app/actions/companies';
import { useFormAction } from '@/hooks/use-form-action';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/field';
import { Checkbox, Input, Textarea } from '@/components/ui/input';
import { Picker, type PickerOption } from '@/components/ui/picker';
import type { Contact } from '@/types/db';

export function ContactForm({
  contact,
  companies,
  companyId,
  redirectTo,
  onDone,
}: {
  contact?: Contact | null;
  companies: PickerOption[];
  companyId?: string | null;
  redirectTo?: string;
  onDone?: () => void;
}) {
  const { state, pending, onSubmit, errors } = useFormAction(saveContact, {
    redirectTo: onDone ? undefined : (redirectTo ?? '/contatos'),
    onSuccess: onDone,
  });
  const c = contact;
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {c && <input type="hidden" name="id" value={c.id} />}
      <Field label="Cliente" required error={errors.company_id}>
        <Picker name="company_id" title="Cliente" options={companies} defaultValue={c?.company_id ?? companyId ?? null} placeholder="Selecionar cliente" invalid={!!errors.company_id} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" htmlFor="name" required error={errors.name}>
          <Input id="name" name="name" defaultValue={c?.name ?? ''} required aria-invalid={!!errors.name} autoFocus={!c} />
        </Field>
        <Field label="Cargo" htmlFor="job_title" error={errors.job_title}>
          <Input id="job_title" name="job_title" placeholder="Ex.: Comprador de congelados" defaultValue={c?.job_title ?? ''} />
        </Field>
        <Field label="Departamento" htmlFor="department" error={errors.department}>
          <Input id="department" name="department" defaultValue={c?.department ?? ''} />
        </Field>
        <Field label="Melhor horário para contato" htmlFor="best_contact_time" error={errors.best_contact_time}>
          <Input id="best_contact_time" name="best_contact_time" placeholder="Ex.: terças de manhã" defaultValue={c?.best_contact_time ?? ''} />
        </Field>
        <Field label="WhatsApp" htmlFor="whatsapp" error={errors.whatsapp}>
          <Input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" placeholder="(11) 90000-0000" defaultValue={c?.whatsapp ?? ''} aria-invalid={!!errors.whatsapp} />
        </Field>
        <Field label="Telefone" htmlFor="phone" error={errors.phone}>
          <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={c?.phone ?? ''} aria-invalid={!!errors.phone} />
        </Field>
        <Field label="E-mail" htmlFor="email" error={errors.email}>
          <Input id="email" name="email" type="email" inputMode="email" defaultValue={c?.email ?? ''} aria-invalid={!!errors.email} />
        </Field>
        <Field label="LinkedIn" htmlFor="linkedin" error={errors.linkedin}>
          <Input id="linkedin" name="linkedin" inputMode="url" defaultValue={c?.linkedin ?? ''} />
        </Field>
      </div>
      <Field label="Observações" htmlFor="notes" error={errors.notes}>
        <Textarea id="notes" name="notes" defaultValue={c?.notes ?? ''} />
      </Field>
      <Checkbox name="is_primary" defaultChecked={c?.is_primary ?? false} label="Comprador principal deste cliente" />
      <FormError message={state.error} />
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending}>
        {pending ? 'Salvando…' : c ? 'Salvar comprador' : 'Cadastrar comprador'}
      </Button>
    </form>
  );
}
