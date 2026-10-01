import { TrendingDown, TrendingUp } from 'lucide-react';
import { formatPercent } from '@/lib/format';

export function growth(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

export function GrowthHint({ value, label = 'vs. período anterior' }: { value: number | null; label?: string }) {
  if (value === null) return <span>Sem base de comparação</span>;
  const up = value >= 0;
  return (
    <span className={up ? 'text-green-700' : 'text-red-700'}>
      {up ? <TrendingUp className="mr-1 inline size-3" /> : <TrendingDown className="mr-1 inline size-3" />}
      {up ? '+' : ''}
      {formatPercent(value)} {label}
    </span>
  );
}

