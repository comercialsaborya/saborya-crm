'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Links de convite / confirmação enviados pelo painel do Supabase chegam com
 * os tokens no fragmento da URL (#access_token=…). Aqui criamos a sessão e
 * levamos a pessoa para definir a própria senha.
 */
export function HashSession() {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const access_token = hash.get('access_token');
    const refresh_token = hash.get('refresh_token');
    if (!access_token || !refresh_token) return;
    const type = hash.get('type');
    setBusy(true);
    createClient()
      .auth.setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) {
          setBusy(false);
          return;
        }
        window.location.replace(type === 'invite' || type === 'recovery' || type === 'signup' ? '/recuperar-senha/nova' : '/');
      });
  }, []);
  if (!busy) return null;
  return <p className="mt-4 rounded-lg bg-rice px-3 py-2 text-sm text-muted ring-1 ring-line">Validando seu acesso…</p>;
}
