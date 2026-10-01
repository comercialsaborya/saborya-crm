import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { getCompanyOptions } from '@/lib/queries';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/misc';
import { ContactForm } from '@/components/crm/contact-form';
import { ArchiveContactButton } from './archive-button';
import type { Contact } from '@/types/db';

export const metadata: Metadata = { title: 'Editar comprador' };

export default async function EditarContatoPage({ params }: PageProps<'/contatos/[id]/editar'>) {
  const { id } = await params;
  await requireSession();
  const supabase = await createClient();
  const { data } = await supabase.from('contacts').select('*').eq('id', id).is('deleted_at', null).maybeSingle<Contact>();
  if (!data) notFound();
  const companies = await getCompanyOptions();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={data.name}
        back={{ href: `/clientes/${data.company_id}?aba=contatos`, label: 'Cliente' }}
        actions={<ArchiveContactButton id={id} companyId={data.company_id} />}
      />
      <Card className="p-4 sm:p-5">
        <ContactForm contact={data} companies={companies} redirectTo={`/clientes/${data.company_id}?aba=contatos`} />
      </Card>
    </div>
  );
}
