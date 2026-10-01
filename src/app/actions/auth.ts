'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { actionError, actionOk, type ActionState } from '@/lib/actions';

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ email: z.email('E-mail inválido.'), password: z.string().min(1, 'Informe a senha.'), next: z.string().optional() })
    .safeParse({ email: formData.get('email'), password: formData.get('password'), next: formData.get('next') ?? undefined });
  if (!parsed.success) return actionError(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) {
    if (error.message.toLowerCase().includes('invalid')) return actionError('E-mail ou senha incorretos.');
    if (error.message.toLowerCase().includes('confirm')) return actionError('Confirme seu e-mail antes de entrar.');
    return actionError('Não foi possível entrar. Tente novamente.');
  }
  const next = parsed.data.next && parsed.data.next.startsWith('/') && !parsed.data.next.startsWith('//') ? parsed.data.next : '/';
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = z.email().safeParse(formData.get('email'));
  if (!email.success) return actionError('E-mail inválido.');
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${origin}/auth/callback?next=/recuperar-senha/nova` });
  // Mesma resposta exista ou não a conta (evita enumeração de e-mails).
  return actionOk('Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.');
}

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ password: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres.'), confirm: z.string() })
    .refine((d) => d.password === d.confirm, { message: 'As senhas não conferem.', path: ['confirm'] })
    .safeParse({ password: formData.get('password'), confirm: formData.get('confirm') });
  if (!parsed.success) return actionError(parsed.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return actionError('Não foi possível alterar a senha. Abra o link do e-mail novamente.');
  return actionOk('Senha alterada.');
}
