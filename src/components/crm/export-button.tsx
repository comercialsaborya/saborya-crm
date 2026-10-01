'use client';

import { useSearchParams } from 'next/navigation';
import { Download } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Exporta a lista atual (com os mesmos filtros da URL) para CSV compatível com Excel. */
export function ExportButton({ entity, className }: { entity: string; className?: string }) {
  const params = useSearchParams();
  const qs = params.toString();
  return (
    <a
      href={`/api/export/${entity}${qs ? `?${qs}` : ''}`}
      className={cn(buttonVariants({ variant: 'secondary', size: 'md' }), className)}
      download
    >
      <Download /> Exportar
    </a>
  );
}
