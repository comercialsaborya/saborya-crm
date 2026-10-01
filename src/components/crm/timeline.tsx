import Link from 'next/link';
import {
  ArrowRightLeft,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCcw,
  ShoppingCart,
  Thermometer,
  Users,
  CalendarCheck,
  HeartHandshake,
  type LucideIcon,
} from 'lucide-react';
import { ACTIVITY_TYPE_LABELS, type ActivityType } from '@/lib/constants';
import { formatDateTime, formatShortDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export type TimelineItem = {
  id: string;
  at: string;
  kind: ActivityType | 'status' | 'stage';
  title: string;
  detail?: string | null;
  by?: string | null;
  href?: string;
  next?: { label: string | null; date: string | null } | null;
};

const ICONS: Record<TimelineItem['kind'], LucideIcon> = {
  visita: MapPin,
  ligacao: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  reuniao: Users,
  follow_up: RefreshCcw,
  pedido: ShoppingCart,
  pos_venda: HeartHandshake,
  status: Thermometer,
  stage: ArrowRightLeft,
};

const TONES: Partial<Record<TimelineItem['kind'], string>> = {
  visita: 'bg-brand text-white',
  pedido: 'bg-green-600 text-white',
  whatsapp: 'bg-green-100 text-green-800',
  status: 'bg-yellow-100 text-yellow-800',
  stage: 'bg-violet-100 text-violet-800',
};

export function Timeline({ items, empty = 'Nenhuma interação registrada ainda.' }: { items: TimelineItem[]; empty?: string }) {
  if (!items.length) return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  return (
    <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-line">
      {items.map((it) => {
        const Icon = ICONS[it.kind] ?? CalendarCheck;
        const body = (
          <>
            <p className="text-sm font-medium leading-snug">{it.title}</p>
            {it.detail && <p className="mt-0.5 whitespace-pre-line text-sm text-muted">{it.detail}</p>}
            {it.next?.label && (
              <p className="mt-1 text-xs text-ink">
                Próximo passo: {it.next.label}
                {it.next.date ? ` · ${formatShortDate(it.next.date)}` : ''}
              </p>
            )}
            <p className="mt-1 text-xs text-muted">
              {formatDateTime(it.at)}
              {it.by ? ` · ${it.by}` : ''}
            </p>
          </>
        );
        return (
          <li key={`${it.kind}-${it.id}`} className="relative flex gap-3">
            <span className={cn('z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-rice ring-4 ring-surface', TONES[it.kind])}>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              {it.href ? (
                <Link href={it.href} className="block hover:opacity-80">
                  {body}
                </Link>
              ) : (
                body
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function activityTitle(type: ActivityType, description: string) {
  return type === 'visita' || type === 'pedido' ? description : `${ACTIVITY_TYPE_LABELS[type]}: ${description}`;
}
