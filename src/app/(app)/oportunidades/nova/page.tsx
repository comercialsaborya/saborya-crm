import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { getCompanyOptions, getContactOptions, getSellerOptions, getStages, one } from '@/lib/queries';
import { PageHeader } from '@/components/ui/misc';
import { OpportunityForm } from '@/components/crm/opportunity-form';

export const metadata: Metadata = { title: 'Nova oportunidade' };

export default async function NovaOportunidadePage({ searchParams }: PageProps<'/oportunidades/nova'>) {
  const session = await requireSession();
  const sp = await searchParams;
  const [companies, contacts, stages, sellers] = await Promise.all([
    getCompanyOptions(),
    getContactOptions(),
    getStages(),
    session.isAdmin ? getSellerOptions() : Promise.resolve(undefined),
  ]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Nova oportunidade" back={{ href: '/pipeline', label: 'Pipeline' }} />
      <OpportunityForm companies={companies} contacts={contacts} stages={stages} sellers={sellers} initialCompany={one(sp.cliente) ?? null} />
    </div>
  );
}
