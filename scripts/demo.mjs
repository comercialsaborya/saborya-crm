// Dados de demonstração (claramente marcados e removíveis).
//
//   npm run demo:seed     cria 3 vendedores demo + clientes, compradores, oportunidades,
//                         visitas, atividades, pedidos e tarefas (tudo com is_demo = true)
//   npm run demo:remove   apaga tudo que é demo, inclusive os usuários demo
//
// Requer .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local');
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const SELLERS = [
  { email: 'carlos.demo@demo.saborya.local', name: 'Carlos Mendes (demo)' },
  { email: 'daniela.demo@demo.saborya.local', name: 'Daniela Souza (demo)' },
  { email: 'eduardo.demo@demo.saborya.local', name: 'Eduardo Lima (demo)' },
];

async function seed() {
  const { data: admins, error } = await supabase.from('profiles').select('id').eq('role', 'admin').eq('is_demo', false).limit(1);
  if (error) throw error;
  if (!admins?.length) {
    console.error('Crie primeiro o usuário gestor (o primeiro cadastro vira gestor). Veja o README.');
    process.exit(1);
  }
  const password = `Demo-${randomBytes(4).toString('hex')}`;
  const ids = [];
  for (const s of SELLERS) {
    const { data, error: e } = await supabase.auth.admin.createUser({
      email: s.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: s.name },
      app_metadata: { role: 'vendedor', is_demo: true },
    });
    if (e) throw new Error(`${s.email}: ${e.message}`);
    ids.push(data.user.id);
  }
  const { data: summary, error: e2 } = await supabase.rpc('seed_demo_data', { p_seller_ids: ids });
  if (e2) throw e2;
  console.log('Dados demo criados:', summary);
  console.log('\nVendedores demo (senha para todos):', password);
  SELLERS.forEach((s) => console.log(' -', s.email));
  console.log('\nPara remover tudo depois: npm run demo:remove');
}

async function remove() {
  const { data: users, error } = await supabase.rpc('remove_demo_data');
  if (error) throw error;
  for (const id of users ?? []) {
    const { error: e } = await supabase.auth.admin.deleteUser(id);
    if (e) console.warn('Não foi possível remover o usuário', id, e.message);
  }
  console.log(`Dados demo removidos (${(users ?? []).length} usuário(s) demo apagado(s)).`);
}

const cmd = process.argv[2];
(cmd === 'seed' ? seed() : cmd === 'remove' ? remove() : Promise.reject(new Error('Use: seed | remove'))).catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
