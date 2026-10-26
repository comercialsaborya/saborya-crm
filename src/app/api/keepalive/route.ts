import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from '@/lib/env';

/**
 * "Despertador" do banco: o plano gratuito do Supabase pausa o projeto após
 * 7 dias sem uso. A Vercel chama esta rota a cada 3 dias (vercel.json → crons)
 * e ela faz uma consulta real no banco, mantendo o projeto ativo.
 *
 * Não lê nem expõe dados: a função public.keepalive() só devolve a hora atual.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Se CRON_SECRET estiver configurado na Vercel, só a própria Vercel pode chamar.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 });
  }
  if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY) {
    return NextResponse.json({ ok: false, error: 'Supabase não configurado' }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc('keepalive');
  if (error) {
    console.error('[keepalive]', error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  }
  return NextResponse.json({ ok: true, database_time: data }, { headers: { 'Cache-Control': 'no-store' } });
}
