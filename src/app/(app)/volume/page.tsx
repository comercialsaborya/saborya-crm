import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { getCompanyOptions, getProducts, getSellerOptions, one, searchTerm } from '@/lib/queries';
import { resolvePeriod } from '@/lib/periods';
import { OPTIONS, PRODUCT_CATEGORY_LABELS, type ProductCategory } from '@/lib/constants';
import { formatBRL, formatInt } from '@/lib/format';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PageHeader, Stat } from '@/components/ui/misc';
import { FilterBar } from '@/components/crm/filter-bar';
import { RankBars } from '@/components/charts/charts';
import type { BreakdownRow } from '@/types/db';

export const metadata: Metadata = { title: 'Volume vendido' };

export default async function VolumePage({ searchParams }: PageProps<'/volume'>) {
  const session = await requireSession();
  const sp = await searchParams;
  const range = resolvePeriod(sp, 'mes');
  const filters = {
    p_from: range.from,
    p_to: range.to,
    p_seller: session.isAdmin ? (one(sp.vendedor) ?? null) : null,
    p_company: one(sp.cliente) ?? null,
    p_product: one(sp.produto) ?? null,
    p_category: one(sp.categoria) ?? null,
    p_city: searchTerm(one(sp.cidade)),
    p_state: one(sp.uf) ?? null,
  };
  const supabase = await createClient();
  const [byProduct, byClient, bySeller, byCategory, companies, products, sellers] = await Promise.all([
    supabase.rpc('sales_breakdown', { p_group: 'product', ...filters }),
    supabase.rpc('sales_breakdown', { p_group: 'client', ...filters }),
    session.isAdmin ? supabase.rpc('sales_breakdown', { p_group: 'seller', ...filters }) : Promise.resolve({ data: [] }),
    supabase.rpc('sales_breakdown', { p_group: 'category', ...filters }),
    getCompanyOptions(),
    getProducts(false),
    session.isAdmin ? getSellerOptions() : Promise.resolve([]),
  ]);
  const toBars = (rows: BreakdownRow[], label?: (r: BreakdownRow) => string) =>
    rows
      .map((r) => ({ label: label ? label(r) : (r.label ?? '—'), value: Number(r.volume), sub: `${formatBRL(r.revenue)} · ${r.orders} pedido(s)` }))
      .sort((a, b) => b.value - a.value);
  const prod = (byProduct.data ?? []) as BreakdownRow[];
  const totalVol = prod.reduce((s, r) => s + Number(r.volume), 0);
  const totalRev = prod.reduce((s, r) => s + Number(r.revenue), 0);

  return (
    <>
      <PageHeader title="Volume vendido" description={`Unidades faturadas · ${range.label}`} />
      <FilterBar
        fields={[
          { type: 'period', defaultPreset: 'mes' },
          ...(session.isAdmin ? [{ type: 'picker' as const, name: 'vendedor', label: 'Vendedor', options: sellers }] : []),
          { type: 'picker', name: 'cliente', label: 'Cliente', options: companies },
          { type: 'picker', name: 'produto', label: 'Produto', options: products.map((p) => ({ value: p.id, label: p.name })) },
          { type: 'select', name: 'categoria', label: 'Categoria', options: OPTIONS.productCategory },
          { type: 'text', name: 'cidade', label: 'Cidade' },
          { type: 'select', name: 'uf', label: 'UF', options: OPTIONS.uf },
        ]}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Unidades vendidas" value={formatInt(totalVol)} />
        <Stat label="Faturamento correspondente" value={formatBRL(totalRev)} />
        <Stat label="Produtos vendidos" value={formatInt(prod.length)} />
        <Stat label="Preço médio por unidade" value={formatBRL(totalVol ? totalRev / totalVol : 0)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Volume por produto" />
          <CardBody>
            <RankBars data={toBars(prod)} format="int" max={20} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Volume por categoria" />
          <CardBody>
            <RankBars data={toBars((byCategory.data ?? []) as BreakdownRow[], (r) => PRODUCT_CATEGORY_LABELS[r.key as ProductCategory] ?? r.key)} format="int" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Volume por cliente" />
          <CardBody>
            <RankBars data={toBars((byClient.data ?? []) as BreakdownRow[])} format="int" max={15} />
          </CardBody>
        </Card>
        {session.isAdmin && (
          <Card>
            <CardHeader title="Volume por vendedor" />
            <CardBody>
              <RankBars data={toBars((bySeller.data ?? []) as BreakdownRow[])} format="int" />
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
