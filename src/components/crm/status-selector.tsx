'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Check, ChevronDown } from 'lucide-react';
import { setCompanyStatus } from '@/app/actions/companies';
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownTrigger } from '@/components/ui/dropdown';
import { TemperatureBadge } from '@/components/ui/misc';
import { TEMPERATURE, TEMPERATURE_ORDER, type Temperature } from '@/lib/constants';
import { cn } from '@/lib/utils';

/** Altera a temperatura do cliente. O banco registra quem alterou e quando. */
export function StatusSelector({ companyId, value }: { companyId: string; value: Temperature }) {
  const [current, setCurrent] = React.useState(value);
  const [pending, start] = React.useTransition();
  const [source, setSource] = React.useState(value);
  if (source !== value) {
    setSource(value);
    setCurrent(value);
  }

  const choose = (t: Temperature) => {
    if (t === current) return;
    const prev = current;
    setCurrent(t);
    start(async () => {
      const r = await setCompanyStatus(companyId, t);
      if (r.ok) toast.success(`Status alterado para ${TEMPERATURE[t].label}.`);
      else {
        setCurrent(prev);
        toast.error(r.error);
      }
    });
  };

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button type="button" className={cn('flex items-center gap-1 rounded-full', pending && 'opacity-60')} aria-label="Alterar status">
          <TemperatureBadge value={current} className="py-1 text-sm" />
          <ChevronDown className="size-4 text-muted" />
        </button>
      </DropdownTrigger>
      <DropdownContent align="start">
        <DropdownLabel>Temperatura do cliente</DropdownLabel>
        {TEMPERATURE_ORDER.map((t) => (
          <DropdownItem key={t} onSelect={() => choose(t)}>
            <span className={cn('size-2.5 rounded-full', TEMPERATURE[t].dot)} />
            <span className="flex-1">{TEMPERATURE[t].label}</span>
            {t === current && <Check className="!text-brand" />}
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}
