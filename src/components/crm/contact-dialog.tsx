'use client';

import * as React from 'react';
import { Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import type { PickerOption } from '@/components/ui/picker';
import type { Contact } from '@/types/db';
import { ContactForm } from './contact-form';

export function ContactDialog({
  companies,
  companyId,
  contact,
}: {
  companies: PickerOption[];
  companyId?: string;
  contact?: Contact;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {contact ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Editar ${contact.name}`}>
            <Pencil />
          </Button>
        ) : (
          <Button variant="secondary" size="sm">
            <Plus /> Comprador
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={contact ? 'Editar comprador' : 'Novo comprador'} wide>
        <ContactForm companies={companies} companyId={companyId} contact={contact} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
