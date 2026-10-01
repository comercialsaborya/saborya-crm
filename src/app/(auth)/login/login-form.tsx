'use client';

import Link from 'next/link';
import { signIn } from '@/app/actions/auth';
import { useFormAction } from '@/hooks/use-form-action';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export function LoginForm({ next }: { next?: string }) {
  const { state, pending, onSubmit } = useFormAction(signIn, { successToast: false });
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next ?? ''} />
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required autoFocus />
      </Field>
      <Field label="Senha" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <FormError message={state.error} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Entrando…' : 'Entrar'}
      </Button>
      <p className="text-center text-sm">
        <Link href="/recuperar-senha" className="text-muted underline-offset-4 hover:text-ink hover:underline">
          Esqueci minha senha
        </Link>
      </p>
    </form>
  );
}
