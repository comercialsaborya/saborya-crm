import Link from 'next/link';
import { AlertTriangle, ChevronRight, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AlertRow } from '@/types/db';

export function AlertsPanel({ alerts }: { alerts: AlertRow[] }) {
  if (!alerts.length)
    return <p className="rounded-[var(--radius-card)] bg-green-50 px-4 py-3 text-sm text-green-800 ring-1 ring-green-200">Nenhum alerta: carteira em dia.</p>;
  return (
    <ul className="space-y-2" aria-label="Alertas">
      {alerts.map((a, i) => (
        <li key={`${a.kind}-${a.ref_id ?? i}`}>
          <Link
            href={a.href}
            className={cn(
              'flex items-center gap-3 rounded-[var(--radius-card)] px-4 py-3 text-sm ring-1 hover:opacity-90',
              a.severity === 'alta' ? 'bg-red-50 text-red-900 ring-red-200' : 'bg-yellow-50 text-yellow-900 ring-yellow-200',
            )}
          >
            {a.severity === 'alta' ? <AlertTriangle className="size-4 shrink-0" /> : <Info className="size-4 shrink-0" />}
            <span className="flex-1">{a.message}</span>
            <ChevronRight className="size-4 shrink-0 opacity-60" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
