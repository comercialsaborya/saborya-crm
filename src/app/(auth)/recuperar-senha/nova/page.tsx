'use client';

import { updatePassword } from '@/app/actions/auth';
import { useFormAction } from '@/hooks/use-form-action';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export default function NewPasswordPage() {
  const { state, pending, onSubmit } = useFormAction(updatePassword, { redirectTo: '/' });
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Criar nova senha</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Nova senha" htmlFor="password" hint="Mínimo de 8 caracteres.">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Field label="Confirmar senha" htmlFor="confirm">
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        </Field>
        <FormError message={state.error} />
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Salvando…' : 'Salvar senha'}
        </Button>
      </form>
    </>
  );
}
