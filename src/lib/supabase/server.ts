import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { assertSupabaseEnv, SUPABASE_PUBLIC_KEY, SUPABASE_URL } from '@/lib/env';

/**
 * Cliente do servidor com a sessão do usuário (RLS sempre aplicado).
 * Use em Server Components, Server Actions e Route Handlers.
 */
export async function createClient() {
  assertSupabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chamado a partir de Server Component: o proxy já renova a sessão.
        }
      },
    },
  });
}
