import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, Contact, Package, Search, ShoppingCart, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { one } from '@/lib/queries';
import { Card } from '@/components/ui/card';
import { EmptyState, PageHeader } from '@/components/ui/misc';
import { SearchBox } from './search-box';
import type { SearchResult } from '@/types/db';

export const metadata: Metadata = { title: 'Busca' };

const KIND = {
  cliente: { label: 'Clientes', icon: Building2 },
  comprador: { label: 'Compradores', icon: Contact },
  pedido: { label: 'Pedidos', icon: ShoppingCart },
  produto: { label: 'Produtos', icon: Package },
  vendedor: { label: 'Vendedores', icon: UserRound },
} as const;

export default async function BuscaPage({ searchParams }: PageProps<'/busca'>) {
  await requireSession();
  const sp = await searchParams;
  const q = (one(sp.q) ?? '').trim();
  let results: SearchResult[] = [];
  if (q.length >= 2) {
    const supabase = await createClient();
    const { data } = await supabase.rpc('global_search', { p_query: q, p_limit: 10 });
    results = (data ?? []) as SearchResult[];
  }
  const groups = (Object.keys(KIND) as (keyof typeof KIND)[])
    .map((k) => ({ kind: k, items: results.filter((r) => r.kind === k) }))
    .filter((g) => g.items.length);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Busca" />
      <SearchBox initial={q} />
      {q.length >= 2 && groups.length === 0 && (
        <Card className="mt-4">
          <EmptyState icon={<Search />} title={`Nada encontrado para “${q}”`} description="Tente parte do nome, CNPJ, telefone ou número do pedido." />
        </Card>
      )}
      <div className="mt-4 space-y-4">
        {groups.map((g) => {
          const Icon = KIND[g.kind].icon;
          return (
            <Card key={g.kind}>
              <p className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold">
                <Icon className="size-4 text-muted" /> {KIND[g.kind].label}
              </p>
              <ul className="divide-y divide-line">
                {g.items.map((r) => (
                  <li key={`${r.kind}-${r.id}`}>
                    <Link href={r.href} className="block px-4 py-3 hover:bg-rice">
                      <p className="font-medium">{r.title}</p>
                      {r.subtitle && <p className="text-sm text-muted">{r.subtitle}</p>}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
