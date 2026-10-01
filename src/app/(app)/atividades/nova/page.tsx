import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { getCompanyOptions, getContactOptions, getOpenOpportunityOptions, one } from '@/lib/queries';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/misc';
import { ActivityForm } from '@/components/crm/activity-form';
import { ACTIVITY_TYPE_LABELS, type ActivityType } from '@/lib/constants';

export const metadata: Metadata = { title: 'Nova atividade' };

export default async function NovaAtividadePage({ searchParams }: PageProps<'/atividades/nova'>) {
  await requireSession();
  const sp = await searchParams;
  const [companies, contacts, opportunities] = await Promise.all([getCompanyOptions(), getContactOptions(), getOpenOpportunityOptions()]);
  const tipo = one(sp.tipo);
  const cliente = one(sp.cliente) ?? null;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Nova atividade" description="Ligação, WhatsApp, e-mail, reunião ou follow-up." back={{ href: cliente ? `/clientes/${cliente}` : '/atividades', label: 'Voltar' }} />
      <Card className="p-4 sm:p-5">
        <ActivityForm
          companies={companies}
          contacts={contacts}
          opportunities={opportunities}
          initialCompany={cliente}
          initialType={tipo && tipo in ACTIVITY_TYPE_LABELS ? (tipo as ActivityType) : undefined}
        />
      </Card>
    </div>
  );
}
