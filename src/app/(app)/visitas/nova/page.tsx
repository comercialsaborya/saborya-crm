import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { getCompanyOptions, getContactOptions, getOpenOpportunityOptions, getProducts, one } from '@/lib/queries';
import { PageHeader } from '@/components/ui/misc';
import { VisitForm } from '@/components/crm/visit-form';

export const metadata: Metadata = { title: 'Registrar visita' };

export default async function NovaVisitaPage({ searchParams }: PageProps<'/visitas/nova'>) {
  await requireSession();
  const sp = await searchParams;
  const [companies, contacts, opportunities, products] = await Promise.all([
    getCompanyOptions(),
    getContactOptions(),
    getOpenOpportunityOptions(),
    getProducts(true),
  ]);
  const cliente = one(sp.cliente) ?? null;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Registrar visita" back={{ href: cliente ? `/clientes/${cliente}` : '/visitas', label: 'Voltar' }} />
      <VisitForm
        companies={companies}
        contacts={contacts}
        opportunities={opportunities}
        products={products}
        initialCompany={cliente}
        initialOpportunity={one(sp.oportunidade) ?? null}
      />
    </div>
  );
}
