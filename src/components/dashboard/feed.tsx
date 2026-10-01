import Link from 'next/link';
import { describeAudit } from '@/lib/feed';
import { formatTime, relativeTime, todayISO } from '@/lib/format';
import type { AuditRow } from '@/types/db';

export function ActivityFeed({ rows, limit = 12 }: { rows: AuditRow[]; limit?: number }) {
  const today = todayISO();
  const items = rows
    .map((r) => ({ r, d: describeAudit(r) }))
    .filter((x): x is { r: AuditRow; d: { text: string; href: string | null } } => x.d !== null)
    .slice(0, limit);
  if (!items.length) return <p className="py-6 text-center text-sm text-muted">Nenhuma movimentação recente.</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map(({ r, d }) => {
        const when = todayISO(new Date(r.created_at)) === today ? formatTime(r.created_at) : relativeTime(r.created_at);
        const body = (
          <span className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
            <span>{d.text}</span>
            <span className="num shrink-0 text-xs text-muted">{when}</span>
          </span>
        );
        return <li key={r.id}>{d.href ? <Link href={d.href} className="block hover:text-brand">{body}</Link> : body}</li>;
      })}
    </ul>
  );
}
