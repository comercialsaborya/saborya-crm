'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { archiveContact } from '@/app/actions/companies';
import { Button } from '@/components/ui/button';

export function ArchiveContactButton({ id, companyId }: { id: string; companyId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() => {
        if (!confirm('Remover este comprador? O histórico de interações é mantido.')) return;
        start(async () => {
          const r = await archiveContact(id);
          if (r.ok) {
            toast.success(r.message);
            router.push(`/clientes/${companyId}?aba=contatos`);
          } else toast.error(r.error);
        });
      }}
    >
      <Trash2 /> Remover
    </Button>
  );
}
