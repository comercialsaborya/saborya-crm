-- =====================================================================
-- Saborya CRM — 0008 · Despertador do banco
-- Função mínima chamada a cada 3 dias pela Vercel (/api/keepalive) para o
-- plano gratuito do Supabase não pausar o projeto por inatividade.
-- Não acessa nenhuma tabela.
-- =====================================================================

create or replace function public.keepalive()
returns timestamptz
language sql stable security invoker set search_path = ''
as $$ select now() $$;

revoke execute on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated, service_role;
