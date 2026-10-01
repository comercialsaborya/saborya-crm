'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const TABLES = ['activities', 'visits', 'orders', 'sales', 'opportunities', 'tasks', 'companies', 'contacts'];

/**
 * Escuta mudanças no banco (Supabase Realtime, respeitando RLS) e atualiza
 * os dados da página atual sem recarregar. Não atualiza telas de formulário
 * para não atrapalhar quem está digitando.
 */
export function RealtimeRefresher({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      const p = pathRef.current;
      if (/\/(novo|nova|editar)(\/|$)/.test(p)) return;
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 600);
    };
    const channel = supabase.channel(`crm-live-${userId}`);
    for (const table of TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, refresh);
    }
    if (isAdmin) channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, refresh);
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [router, userId, isAdmin]);

  return null;
}
