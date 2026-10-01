import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatPhone } from '@/lib/format';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/misc';
import { NewUserDialog, EditUserDialog, TransferClientsForm } from './team-forms';
import type { Profile } from '@/types/db';

export const metadata: Metadata = { title: 'Equipe' };

export default async function EquipePage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data }, { data: counts }] = await Promise.all([
    supabase.from('profiles').select('*').order('active', { ascending: false }).order('full_name'),
    supabase.from('companies').select('owner_id').is('deleted_at', null),
  ]);
  const users = (data ?? []) as Profile[];
  const clientsBy = new Map<string, number>();
  for (const c of counts ?? []) clientsBy.set(c.owner_id, (clientsBy.get(c.owner_id) ?? 0) + 1);
  const options = users.map((u) => ({ value: u.id, label: u.full_name || u.email || '—', description: u.active ? undefined : 'inativo' }));

  return (
    <>
      <PageHeader title="Equipe comercial" description="Vendedores e gestores com acesso ao CRM." actions={<NewUserDialog />} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <ul className="divide-y divide-line">
            {users.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {u.full_name || '—'}{' '}
                    <Badge className={u.role === 'admin' ? 'bg-nori-900 text-white ring-nori-900' : ''}>{u.role === 'admin' ? 'Gestor' : 'Vendedor'}</Badge>{' '}
                    {!u.active && <Badge className="bg-red-50 text-red-700 ring-red-200">Inativo</Badge>}
                    {u.is_demo && <Badge className="bg-yellow-50 text-yellow-800 ring-yellow-200">Demo</Badge>}
                  </p>
                  <p className="truncate text-sm text-muted">
                    {[u.email, u.phone && formatPhone(u.phone)].filter(Boolean).join(' · ')}
                  </p>
                  <p className="text-xs text-muted">
                    {clientsBy.get(u.id) ?? 0} cliente(s) · desde {formatDate(u.created_at)}
                  </p>
                </div>
                <EditUserDialog user={u} />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Transferir carteira" description="Move clientes, oportunidades abertas e tarefas pendentes de um vendedor para outro." />
          <CardBody>
            <TransferClientsForm options={options} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
