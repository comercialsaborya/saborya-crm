import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { getCompanyOptions, one } from '@/lib/queries';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/misc';
import { ContactForm } from '@/components/crm/contact-form';

export const metadata: Metadata = { title: 'Novo comprador' };

export default async function NovoContatoPage({ searchParams }: PageProps<'/contatos/novo'>) {
  await requireSession();
  const sp = await searchParams;
  const companyId = one(sp.cliente) ?? null;
  const companies = await getCompanyOptions();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Novo comprador" back={{ href: companyId ? `/clientes/${companyId}` : '/contatos', label: 'Voltar' }} />
      <Card className="p-4 sm:p-5">
        <ContactForm companies={companies} companyId={companyId} redirectTo={companyId ? `/clientes/${companyId}?aba=contatos` : '/contatos'} />
      </Card>
    </div>
  );
}
