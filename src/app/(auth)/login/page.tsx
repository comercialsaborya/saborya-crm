import type { Metadata } from 'next';
import { LoginForm } from './login-form';
import { HashSession } from './hash-session';

export const metadata: Metadata = { title: 'Entrar' };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const sp = await searchParams;
  const next = typeof sp.next === 'string' ? sp.next : undefined;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
      <p className="mt-1 text-sm text-muted">Use o e-mail e a senha fornecidos pela gestão.</p>
      {sp.inativo && (
        <p className="mt-4 rounded-lg bg-yellow-50 px-3 py-2 text-sm text-yellow-800 ring-1 ring-yellow-200">
          Seu acesso está desativado. Fale com a gestão comercial.
        </p>
      )}
      <HashSession />
      <LoginForm next={next} />
    </>
  );
}
