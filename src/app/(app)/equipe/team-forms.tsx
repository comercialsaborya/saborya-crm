'use client';

import * as React from 'react';
import { Pencil, UserPlus } from 'lucide-react';
import { createSeller, transferClients, updateProfile } from '@/app/actions/admin';
import { useFormAction } from '@/hooks/use-form-action';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field, FormError } from '@/components/ui/field';
import { Checkbox, Input, Select } from '@/components/ui/input';
import { Picker, type PickerOption } from '@/components/ui/picker';
import type { Profile } from '@/types/db';

const ROLE_OPTIONS = [
  { value: 'vendedor', label: 'Vendedor — vê apenas a própria carteira' },
  { value: 'admin', label: 'Gestor — vê toda a operação' },
];

export function NewUserDialog() {
  const [open, setOpen] = React.useState(false);
  const { state, pending, onSubmit, errors } = useFormAction(createSeller, { onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus /> Novo usuário
        </Button>
      </DialogTrigger>
      <DialogContent title="Novo usuário" description="O acesso é criado já confirmado. Passe o e-mail e a senha provisória ao vendedor.">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Nome completo" htmlFor="full_name" required error={errors.full_name}>
            <Input id="full_name" name="full_name" aria-invalid={!!errors.full_name} />
          </Field>
          <Field label="E-mail" htmlFor="email" required error={errors.email}>
            <Input id="email" name="email" type="email" aria-invalid={!!errors.email} />
          </Field>
          <Field label="Telefone" htmlFor="phone" error={errors.phone}>
            <Input id="phone" name="phone" type="tel" />
          </Field>
          <Field label="Senha provisória" htmlFor="password" required error={errors.password} hint="Mínimo 8 caracteres. O vendedor pode trocar em Configurações.">
            <Input id="password" name="password" type="text" autoComplete="off" aria-invalid={!!errors.password} />
          </Field>
          <Field label="Perfil" htmlFor="role">
            <Select id="role" name="role" defaultValue="vendedor" options={ROLE_OPTIONS} />
          </Field>
          <FormError message={state.error} />
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? 'Criando…' : 'Criar acesso'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditUserDialog({ user }: { user: Profile }) {
  const [open, setOpen] = React.useState(false);
  const { state, pending, onSubmit, errors } = useFormAction(updateProfile, { onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Pencil /> Editar
        </Button>
      </DialogTrigger>
      <DialogContent title={user.full_name || 'Usuário'} description={user.email ?? undefined}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <input type="hidden" name="id" value={user.id} />
          <Field label="Nome completo" htmlFor="full_name" required error={errors.full_name}>
            <Input id="full_name" name="full_name" defaultValue={user.full_name} />
          </Field>
          <Field label="Telefone" htmlFor="phone" error={errors.phone}>
            <Input id="phone" name="phone" type="tel" defaultValue={user.phone ?? ''} />
          </Field>
          <Field label="Perfil" htmlFor="role">
            <Select id="role" name="role" defaultValue={user.role} options={ROLE_OPTIONS} />
          </Field>
          <Checkbox name="active" defaultChecked={user.active} label="Acesso ativo (desmarque para bloquear o login)" />
          <FormError message={state.error} />
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? 'Salvando…' : 'Salvar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TransferClientsForm({ options }: { options: PickerOption[] }) {
  const { state, pending, onSubmit, errors } = useFormAction(transferClients);
  return (
    <form
      onSubmit={(e) => {
        if (!confirm('Transferir todos os clientes ativos do vendedor de origem?')) {
          e.preventDefault();
          return;
        }
        onSubmit(e);
      }}
      className="space-y-3"
      noValidate
    >
      <Field label="De" error={errors.from}>
        <Picker name="from" title="Vendedor de origem" options={options} placeholder="Vendedor de origem" />
      </Field>
      <Field label="Para" error={errors.to}>
        <Picker name="to" title="Vendedor de destino" options={options} placeholder="Vendedor de destino" />
      </Field>
      <FormError message={state.error} />
      <Button type="submit" variant="dark" className="w-full" disabled={pending}>
        {pending ? 'Transferindo…' : 'Transferir carteira'}
      </Button>
    </form>
  );
}
