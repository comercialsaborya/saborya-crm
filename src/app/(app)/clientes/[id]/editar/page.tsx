import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { getSellerOptions } from '@/lib/queries';
import { PageHeader } from '@/components/ui/misc';
import { CompanyForm } from '@/components/crm/company-form';
import type { Company } from '@/types/db';

export const metadata: Metadata = { title: 'Editar cliente' };

export default async function EditarClientePage({ params }: PageProps<'/clientes/[id]/editar'>) {
  const { id } = await params;
  const session = await requireSession();
  const supabase = await createClient();
  const { data } = await supabase.from('companies').select('*').eq('id', id).maybeSingle<Company>();
  if (!data) notFound();
  const sellers = session.isAdmin ? await getSellerOptions() : undefined;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Editar cliente" back={{ href: `/clientes/${id}`, label: data.trade_name || data.legal_name }} />
      <CompanyForm company={data} isAdmin={session.isAdmin} sellers={sellers} />
    </div>
  );
}
