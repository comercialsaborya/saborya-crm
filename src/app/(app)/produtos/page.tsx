import type { Metadata } from 'next';
import { Package } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { getProducts, one } from '@/lib/queries';
import { PRODUCT_CATEGORY_LABELS, OPTIONS } from '@/lib/constants';
import { formatBRL, formatPercent } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { FilterBar } from '@/components/crm/filter-bar';
import { ProductDialog } from './product-dialog';

export const metadata: Metadata = { title: 'Produtos' };

export default async function ProdutosPage({ searchParams }: PageProps<'/produtos'>) {
  const session = await requireSession();
  const sp = await searchParams;
  const all = await getProducts(false);
  const q = (one(sp.q) ?? '').toLowerCase();
  const cat = one(sp.categoria);
  const status = one(sp.status);
  const products = all.filter(
    (p) =>
      (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) &&
      (!cat || p.category === cat) &&
      (!status || (status === 'ativo' ? p.active : !p.active)),
  );

  return (
    <>
      <PageHeader
        title="Produtos"
        description={session.isAdmin ? 'Catálogo usado em visitas e pedidos. Novos produtos não exigem alteração no sistema.' : 'Catálogo e preços de referência.'}
        actions={session.isAdmin ? <ProductDialog /> : undefined}
      />
      <FilterBar
        fields={[
          { type: 'search', name: 'q', placeholder: 'Nome ou SKU' },
          { type: 'select', name: 'categoria', label: 'Categoria', options: OPTIONS.productCategory },
          { type: 'select', name: 'status', label: 'Situação', options: [{ value: 'ativo', label: 'Ativos' }, { value: 'inativo', label: 'Inativos' }] },
        ]}
      />
      {products.length === 0 ? (
        <Card>
          <EmptyState icon={<Package />} title="Nenhum produto encontrado" />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {products.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {p.name} {!p.active && <Badge className="ml-1">Inativo</Badge>}
                  </p>
                  <p className="text-sm text-muted">
                    SKU {p.sku} · {PRODUCT_CATEGORY_LABELS[p.category]} · vendido por {p.sales_unit}
                  </p>
                  {p.notes && <p className="text-xs text-muted">{p.notes}</p>}
                </div>
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="num text-sm">
                    <p className="font-semibold">{formatBRL(p.price)}</p>
                    {session.isAdmin && (
                      <p className="text-xs text-muted">
                        Custo {formatBRL(p.cost)} · Margem {formatPercent(p.margin_percent)}
                      </p>
                    )}
                  </div>
                  {session.isAdmin && <ProductDialog product={p} />}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
