'use client';

import { changeMyPassword, saveMyProfile, saveOrganization } from '@/app/actions/admin';
import { useFormAction } from '@/hooks/use-form-action';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { Organization } from '@/types/db';

export function ProfileForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const { state, pending, onSubmit, errors } = useFormAction(saveMyProfile);
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="E-mail de acesso">
        <Input value={email} disabled readOnly />
      </Field>
      <Field label="Nome" htmlFor="full_name" required error={errors.full_name}>
        <Input id="full_name" name="full_name" defaultValue={name} />
      </Field>
      <Field label="Telefone" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" defaultValue={phone} />
      </Field>
      <FormError message={state.error} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Salvando…' : 'Salvar perfil'}
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const { state, pending, onSubmit, errors } = useFormAction(changeMyPassword);
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Nova senha" htmlFor="password" required error={errors.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" />
      </Field>
      <Field label="Confirmar nova senha" htmlFor="confirm" required error={errors.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" />
      </Field>
      <FormError message={state.error} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? 'Salvando…' : 'Alterar senha'}
      </Button>
    </form>
  );
}

export function OrganizationForm({ org }: { org: Organization }) {
  const { state, pending, onSubmit, errors } = useFormAction(saveOrganization);
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Nome da empresa" htmlFor="name" required error={errors.name}>
        <Input id="name" name="name" defaultValue={org.name} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Cliente sem contato após" htmlFor="inactivity_days" hint="dias" error={errors.inactivity_days}>
          <Input id="inactivity_days" name="inactivity_days" type="number" min={1} defaultValue={org.inactivity_days} />
        </Field>
        <Field label="Oportunidade parada após" htmlFor="stalled_opportunity_days" hint="dias" error={errors.stalled_opportunity_days}>
          <Input id="stalled_opportunity_days" name="stalled_opportunity_days" type="number" min={1} defaultValue={org.stalled_opportunity_days} />
        </Field>
        <Field label="Alerta de recompra após" htmlFor="repurchase_alert_days" hint="dias" error={errors.repurchase_alert_days}>
          <Input id="repurchase_alert_days" name="repurchase_alert_days" type="number" min={1} defaultValue={org.repurchase_alert_days} />
        </Field>
      </div>
      <Field label="Cor da marca" htmlFor="brand_color" hint="Usada nos botões principais." error={errors.brand_color}>
        <div className="flex items-center gap-3">
          <input id="brand_color" name="brand_color" type="color" defaultValue={org.brand_color} className="h-10 w-16 cursor-pointer rounded-lg ring-1 ring-line" />
          <span className="text-sm text-muted">{org.brand_color}</span>
        </div>
      </Field>
      <FormError message={state.error} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Salvando…' : 'Salvar configurações'}
      </Button>
    </form>
  );
}
