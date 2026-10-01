'use client';

import { saveCompany } from '@/app/actions/companies';
import { useFormAction } from '@/hooks/use-form-action';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, FormError } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Picker, type PickerOption } from '@/components/ui/picker';
import { OPTIONS } from '@/lib/constants';
import { formatCNPJ } from '@/lib/format';
import type { Company } from '@/types/db';

export function CompanyForm({
  company,
  sellers,
  isAdmin,
}: {
  company?: Company | null;
  sellers?: PickerOption[];
  isAdmin: boolean;
}) {
  const { state, pending, onSubmit, errors } = useFormAction(saveCompany, {
    redirectTo: (s) => (s.id ? `/clientes/${s.id}` : '/clientes'),
  });
  const c = company;
  const err = (k: string) => errors[k];

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {c && <input type="hidden" name="id" value={c.id} />}

      <Card className="space-y-4 p-4 sm:p-5">
        <h2 className="font-semibold">Empresa</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome fantasia" htmlFor="trade_name" error={err('trade_name')} hint="Como a equipe chama o cliente.">
            <Input id="trade_name" name="trade_name" defaultValue={c?.trade_name ?? ''} autoFocus={!c} />
          </Field>
          <Field label="Razão social" htmlFor="legal_name" required error={err('legal_name')}>
            <Input id="legal_name" name="legal_name" defaultValue={c?.legal_name ?? ''} required aria-invalid={!!err('legal_name')} />
          </Field>
          <Field label="CNPJ" htmlFor="cnpj" error={err('cnpj')}>
            <Input id="cnpj" name="cnpj" inputMode="numeric" placeholder="00.000.000/0000-00" defaultValue={formatCNPJ(c?.cnpj)} aria-invalid={!!err('cnpj')} />
          </Field>
          <Field label="Tipo de cliente" htmlFor="client_type" required error={err('client_type')}>
            <Select id="client_type" name="client_type" defaultValue={c?.client_type ?? 'rede_supermercado'} options={OPTIONS.clientType} />
          </Field>
          <Field label="Segmento" htmlFor="segment" error={err('segment')}>
            <Input id="segment" name="segment" placeholder="Ex.: varejo alimentar, oriental" defaultValue={c?.segment ?? ''} />
          </Field>
          <Field label="Status" htmlFor="status" error={err('status')}>
            <Select id="status" name="status" defaultValue={c?.status ?? 'frio'} options={OPTIONS.temperature} />
          </Field>
          <Field label="Potencial de compra (R$/mês)" htmlFor="purchase_potential" error={err('purchase_potential')}>
            <Input id="purchase_potential" name="purchase_potential" inputMode="decimal" placeholder="0,00" defaultValue={c?.purchase_potential ? String(c.purchase_potential).replace('.', ',') : ''} />
          </Field>
          <Field label="Próximo contato" htmlFor="next_contact_date" error={err('next_contact_date')}>
            <Input id="next_contact_date" name="next_contact_date" type="date" defaultValue={c?.next_contact_date ?? ''} />
          </Field>
          {isAdmin && sellers && (
            <Field label="Vendedor responsável" htmlFor="owner_id" error={err('owner_id')} hint="Em branco: você.">
              <Picker id="owner_id" name="owner_id" title="Vendedor responsável" options={sellers} defaultValue={c?.owner_id ?? null} placeholder="Selecionar vendedor" />
            </Field>
          )}
        </div>
      </Card>

      <Card className="space-y-4 p-4 sm:p-5">
        <h2 className="font-semibold">Contato e endereço</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Telefone" htmlFor="phone" error={err('phone')}>
            <Input id="phone" name="phone" type="tel" inputMode="tel" placeholder="(11) 0000-0000" defaultValue={c?.phone ?? ''} aria-invalid={!!err('phone')} />
          </Field>
          <Field label="E-mail" htmlFor="email" error={err('email')}>
            <Input id="email" name="email" type="email" inputMode="email" defaultValue={c?.email ?? ''} aria-invalid={!!err('email')} />
          </Field>
          <Field label="Site" htmlFor="website" error={err('website')}>
            <Input id="website" name="website" inputMode="url" placeholder="www.exemplo.com.br" defaultValue={c?.website ?? ''} />
          </Field>
          <Field label="Instagram" htmlFor="instagram" error={err('instagram')}>
            <Input id="instagram" name="instagram" placeholder="@perfil" defaultValue={c?.instagram ?? ''} />
          </Field>
          <Field label="Endereço" htmlFor="address" className="sm:col-span-2" error={err('address')}>
            <Input id="address" name="address" placeholder="Rua, número, bairro" defaultValue={c?.address ?? ''} />
          </Field>
          <Field label="Cidade" htmlFor="city" error={err('city')}>
            <Input id="city" name="city" defaultValue={c?.city ?? ''} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="UF" htmlFor="state" error={err('state')}>
              <Select id="state" name="state" defaultValue={c?.state ?? ''} placeholder="—" options={OPTIONS.uf} />
            </Field>
            <Field label="CEP" htmlFor="zip_code" error={err('zip_code')}>
              <Input id="zip_code" name="zip_code" inputMode="numeric" defaultValue={c?.zip_code ?? ''} />
            </Field>
          </div>
        </div>
        <Field label="Observações" htmlFor="notes" error={err('notes')}>
          <Textarea id="notes" name="notes" defaultValue={c?.notes ?? ''} placeholder="Horários de recebimento, perfil da loja, concorrentes…" />
        </Field>
      </Card>

      <FormError message={state.error} />
      <div className="sticky bottom-20 z-10 flex gap-2 lg:static">
        <Button type="submit" size="lg" className="flex-1 sm:flex-none" disabled={pending}>
          {pending ? 'Salvando…' : c ? 'Salvar alterações' : 'Cadastrar cliente'}
        </Button>
        <Button type="button" variant="secondary" size="lg" onClick={() => history.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
