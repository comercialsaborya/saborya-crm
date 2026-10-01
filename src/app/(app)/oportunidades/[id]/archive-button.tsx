'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Archive } from 'lucide-react';
import { archiveOpportunity } from '@/app/actions/crm';
import { Button } from '@/components/ui/button';

export function ArchiveOpportunityButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      disabled={pending}
      aria-label="Arquivar oportunidade"
      onClick={() => {
        if (!confirm('Arquivar esta oportunidade? Ela sai do pipeline, mas o histórico é mantido.')) return;
        start(async () => {
          const r = await archiveOpportunity(id);
          if (r.ok) {
            toast.success(r.message);
            router.push('/pipeline');
          } else toast.error(r.error);
        });
      }}
    >
      <Archive />
    </Button>
  );
}
