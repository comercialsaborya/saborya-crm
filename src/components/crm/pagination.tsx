import Link from 'next/link';
import { cn } from '@/lib/utils';

export const PAGE_SIZE = 30;

export function pageRange(pageParam: string | undefined) {
  const page = Math.max(1, Number(pageParam) || 1);
  return { page, from: (page - 1) * PAGE_SIZE, to: page * PAGE_SIZE - 1 };
}

export function Pagination({
  page,
  total,
  basePath,
  params,
}: {
  page: number;
  total: number;
  basePath: string;
  params: Record<string, string | string[] | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return <p className="mt-3 text-xs text-muted">{total} registro(s)</p>;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (k === 'pagina' || v === undefined) continue;
      sp.set(k, Array.isArray(v) ? v[0] : v);
    }
    if (p > 1) sp.set('pagina', String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const btn = 'flex h-10 items-center rounded-lg px-4 text-sm font-medium ring-1 ring-line bg-surface';
  return (
    <div className="mt-4 flex items-center justify-between gap-2">
      <p className="text-xs text-muted">
        {total} registro(s) · página {page} de {pages}
      </p>
      <div className="flex gap-2">
        <Link aria-disabled={page <= 1} className={cn(btn, page <= 1 && 'pointer-events-none opacity-40')} href={href(page - 1)}>
          Anterior
        </Link>
        <Link aria-disabled={page >= pages} className={cn(btn, page >= pages && 'pointer-events-none opacity-40')} href={href(page + 1)}>
          Próxima
        </Link>
      </div>
    </div>
  );
}
