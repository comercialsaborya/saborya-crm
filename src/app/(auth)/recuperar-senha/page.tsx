'use client';

import Link from 'next/link';
import { requestPasswordReset } from '@/app/actions/auth';
import { useFormAction } from '@/hooks/use-form-action';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export default function RecoverPage() {
  const { state, pending, onSubmit } = useFormAction(requestPasswordReset, { successToast: false });
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Recuperar senha</h1>
      <p className="mt-1 text-sm text-muted">Enviaremos um link para você criar uma nova senha.</p>
      {state.ok ? (
        <p className="mt-6 rounded-lg bg-green-50 px-3 py-3 text-sm text-green-800 ring-1 ring-green-200">{state.message}</p>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Field label="E-mail" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
          </Field>
          <FormError message={state.error} />
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? 'Enviando…' : 'Enviar link'}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-muted hover:text-ink">
          Voltar para o login
        </Link>
      </p>
    </>
  );
}
