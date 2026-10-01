import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { TEMPERATURE, type Temperature } from '@/lib/constants';
import { Badge } from './badge';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-line/70', className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {icon && <div className="mb-3 text-muted [&_svg]:size-8">{icon}</div>}
      <p className="font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-1 inline-block text-sm text-muted hover:text-ink">
            ‹ {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function TemperatureBadge({ value, className }: { value: Temperature; className?: string }) {
  const t = TEMPERATURE[value];
  return (
    <Badge className={cn(t.badge, className)}>
      <span className={cn('size-2 rounded-full', t.dot)} aria-hidden />
      {t.label}
    </Badge>
  );
}

export function StatusBadge({ meta, className }: { meta: { label: string; className: string }; className?: string }) {
  return <Badge className={cn(meta.className, className)}>{meta.label}</Badge>;
}

export function Stat({
  label,
  value,
  hint,
  tone,
  href,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'default' | 'alert' | 'good';
  href?: string;
  className?: string;
}) {
  const body = (
    <div
      className={cn(
        'h-full rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-line',
        tone === 'alert' && 'ring-red-200 bg-red-50/60',
        href && 'transition-colors hover:ring-line-strong',
        className,
      )}
    >
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <p className={cn('num mt-1 text-2xl font-semibold tracking-tight', tone === 'alert' ? 'text-red-700' : 'text-ink')}>
        {value}
      </p>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-base font-semibold text-ink">{children}</h2>
      {action}
    </div>
  );
}
