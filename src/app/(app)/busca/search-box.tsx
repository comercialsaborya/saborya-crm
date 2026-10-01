'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export function SearchBox({ initial }: { initial: string }) {
  const router = useRouter();
  const [q, setQ] = React.useState(initial);
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        router.replace(`/busca?q=${encodeURIComponent(q.trim())}`);
      }}
      className="relative"
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted" />
      <input
        autoFocus
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cliente, CNPJ, comprador, telefone, vendedor, pedido ou produto"
        className="h-12 w-full rounded-xl bg-surface pl-10 pr-3 text-base ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand"
        enterKeyHint="search"
      />
    </form>
  );
}
