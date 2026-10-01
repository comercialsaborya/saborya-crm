import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/misc';
import { OrganizationForm, PasswordForm, ProfileForm } from './settings-forms';
import type { Organization } from '@/types/db';

export const metadata: Metadata = { title: 'Configurações' };

export default async function ConfiguracoesPage() {
  const session = await requireSession();
  let org: Organization | null = null;
  if (session.isAdmin) {
    const supabase = await createClient();
    const { data } = await supabase.from('organizations').select('*').eq('id', session.profile.organization_id).single<Organization>();
    org = data;
  }
  return (
    <>
      <PageHeader title="Configurações" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Meu perfil" />
            <CardBody>
              <ProfileForm name={session.profile.full_name} phone={session.profile.phone ?? ''} email={session.profile.email ?? ''} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Alterar senha" />
            <CardBody>
              <PasswordForm />
            </CardBody>
          </Card>
        </div>
        {org && (
          <Card>
            <CardHeader title="Empresa e alertas" description="Valem para toda a equipe." />
            <CardBody>
              <OrganizationForm org={org} />
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
