import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { getSellerOptions } from '@/lib/queries';
import { PageHeader } from '@/components/ui/misc';
import { CompanyForm } from '@/components/crm/company-form';

export const metadata: Metadata = { title: 'Novo cliente' };

export default async function NovoClientePage() {
  const session = await requireSession();
  const sellers = session.isAdmin ? await getSellerOptions() : undefined;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Novo cliente" back={{ href: '/clientes', label: 'Clientes' }} />
      <CompanyForm isAdmin={session.isAdmin} sellers={sellers} />
    </div>
  );
}
