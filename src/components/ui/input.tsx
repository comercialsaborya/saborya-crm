import * as React from 'react';
import { cn } from '@/lib/utils';

const base =
  'w-full rounded-lg bg-surface px-3 text-base sm:text-sm text-ink ring-1 ring-inset ring-line-strong placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-60 aria-[invalid=true]:ring-red-500';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, 'h-11 sm:h-10', className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, 'min-h-24 py-2.5', className)} {...props} />;
}

export function Select({
  className,
  options,
  placeholder,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      className={cn(
        base,
        'h-11 sm:h-10 appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27none%27 stroke=%27%2366706b%27 stroke-width=%272%27><path d=%27m4 6 4 4 4-4%27/></svg>")] bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-9',
        className,
      )}
      {...props}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({ className, label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={cn('flex min-h-11 cursor-pointer items-center gap-3 text-sm', className)}>
      <input type="checkbox" className="size-5 rounded accent-[var(--color-brand)]" {...props} />
      <span>{label}</span>
    </label>
  );
}
