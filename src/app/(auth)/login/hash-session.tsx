'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

function readHash() {
  if (typeof window === 'undefined') return null;
  const h = new URLSearchParams(window.location.hash.slice(1));
  const access_token = h.get('access_token');
  const refresh_token = h.get('refresh_token');
  return access_token && refresh_token ? { access_token, refresh_token, type: h.get('type') } : null;
}

/**
 * Links de convite / confirmação enviados pelo painel do Supabase chegam com
 * os tokens no fragmento da URL (#access_token=…). Aqui criamos a sessão e
 * levamos a pessoa para definir a própria senha.
 */
export function HashSession() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const t = readHash();
    if (!t) return;
    const start = setTimeout(() => setBusy(true), 0);
    createClient()
      .auth.setSession({ access_token: t.access_token, refresh_token: t.refresh_token })
      .then(({ error }: { error: unknown }) => {
        if (error) {
          setBusy(false);
          setFailed(true);
          return;
        }
        window.location.replace(t.type === 'invite' || t.type === 'recovery' || t.type === 'signup' ? '/recuperar-senha/nova' : '/');
      });
    return () => clearTimeout(start);
  }, []);
  if (failed)
    return (
      <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
        Este link expirou. Peça um novo convite ou use “Esqueci minha senha”.
      </p>
    );
  if (!busy) return null;
  return <p className="mt-4 rounded-lg bg-rice px-3 py-2 text-sm text-muted ring-1 ring-line">Validando seu acesso…</p>;
}
