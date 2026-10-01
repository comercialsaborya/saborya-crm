import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { getCompanyOptions, getContactOptions, getOpenOpportunityOptions, getProducts, getSellerOptions, one } from '@/lib/queries';
import { PageHeader } from '@/components/ui/misc';
import { OrderForm } from '@/components/crm/order-form';

export const metadata: Metadata = { title: 'Novo pedido' };

export default async function NovoPedidoPage({ searchParams }: PageProps<'/pedidos/novo'>) {
  const session = await requireSession();
  const sp = await searchParams;
  const [companies, contacts, opportunities, products, sellers] = await Promise.all([
    getCompanyOptions(),
    getContactOptions(),
    getOpenOpportunityOptions(),
    getProducts(true),
    session.isAdmin ? getSellerOptions() : Promise.resolve(undefined),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Novo pedido" back={{ href: '/pedidos', label: 'Pedidos' }} />
      <OrderForm
        companies={companies}
        contacts={contacts}
        opportunities={opportunities}
        products={products}
        sellers={sellers}
        initial={{ company: one(sp.cliente), contact: one(sp.comprador), opportunity: one(sp.oportunidade) }}
      />
    </div>
  );
}
