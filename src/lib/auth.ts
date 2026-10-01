import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/types/db';

export type Session = {
  userId: string;
  profile: Profile;
  isAdmin: boolean;
  organization: { id: string; name: string; brand_color: string };
};

/** Sessão atual (memorizada por requisição). Retorna null se não autenticado. */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle<Profile>();
  if (!profile) return null;

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, brand_color')
    .eq('id', profile.organization_id)
    .maybeSingle();

  return {
    userId,
    profile,
    isAdmin: profile.role === 'admin' && profile.active,
    organization: org ?? { id: profile.organization_id, name: 'Saborya', brand_color: '#c8364a' },
  };
});

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!session.profile.active) redirect('/login?inativo=1');
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (!session.isAdmin) redirect('/?sem_permissao=1');
  return session;
}
