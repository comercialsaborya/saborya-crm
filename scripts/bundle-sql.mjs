// Gera supabase/setup.sql (todas as migrations em um arquivo) para colar no SQL Editor do Supabase.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = 'supabase/migrations';
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const body = files.map((f) => `-- >>> ${f}\n${readFileSync(`${dir}/${f}`, 'utf8')}`).join('\n\n');
writeFileSync(
  'supabase/setup.sql',
  `-- Saborya CRM — instalação completa do banco (gerado por npm run db:bundle).\n-- Rode UMA vez em um projeto Supabase novo: SQL Editor → New query → colar → Run.\n\n${body}`,
);
console.log(`supabase/setup.sql gerado com ${files.length} migrations.`);
