import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { getCompanyOptions, getContactOptions, getOpenOpportunityOptions, getProducts, getSellerOptions } from '@/lib/queries';
import { EDITABLE_ORDER_STATUSES } from '@/lib/constants';
import { PageHeader } from '@/components/ui/misc';
import { OrderForm } from '@/components/crm/order-form';
import type { OrderItem, OrderRow } from '@/types/db';

export const metadata: Metadata = { title: 'Editar pedido' };

export default async function EditarPedidoPage({ params }: PageProps<'/pedidos/[id]/editar'>) {
  const { id } = await params;
  const session = await requireSession();
  const supabase = await createClient();
  const { data: order } = await supabase.from('order_list').select('*').eq('id', id).maybeSingle<OrderRow>();
  if (!order) notFound();
  if (!EDITABLE_ORDER_STATUSES.includes(order.status)) redirect(`/pedidos/${id}`);
  const [{ data: items }, companies, contacts, opportunities, products, sellers] = await Promise.all([
    supabase.from('order_items').select('*').eq('order_id', id).order('created_at'),
    getCompanyOptions(),
    getContactOptions(),
    getOpenOpportunityOptions(),
    getProducts(false),
    session.isAdmin ? getSellerOptions() : Promise.resolve(undefined),
  ]);
  // A oportunidade vinculada pode já estar fechada: mantém na lista.
  const opps = order.opportunity_id && !opportunities.some((o) => o.value === order.opportunity_id)
    ? [...opportunities, { value: order.opportunity_id, label: 'Oportunidade vinculada', company_id: order.company_id }]
    : opportunities;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Editar pedido #${order.order_number}`} back={{ href: `/pedidos/${id}`, label: 'Pedido' }} />
      <OrderForm order={order} items={(items ?? []) as OrderItem[]} companies={companies} contacts={contacts} opportunities={opps} products={products} sellers={sellers} />
    </div>
  );
}
