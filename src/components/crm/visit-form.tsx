'use client';

import * as React from 'react';
import { Check, ChevronLeft, LocateFixed, LocateOff, Loader2, MapPin } from 'lucide-react';
import { saveVisit } from '@/app/actions/crm';
import { useFormAction } from '@/hooks/use-form-action';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/field';
import { Checkbox, Input, Textarea } from '@/components/ui/input';
import { Picker, type PickerOption } from '@/components/ui/picker';
import { INTEREST_LABELS, VISIT_RESULT_LABELS, VISIT_TYPE_LABELS, type InterestLevel, type VisitResult, type VisitType } from '@/lib/constants';
import { addDaysISO, nowTimeHM, todayISO } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Product } from '@/types/db';

type ContactOpt = PickerOption & { company_id: string };
type OppOpt = PickerOption & { company_id: string };
type Geo = { state: 'idle' | 'loading' | 'ok' | 'denied' | 'error'; lat?: number; lng?: number; acc?: number; at?: string };

const STEPS = ['Cliente', 'Resultado', 'Próximo passo'] as const;

const RESULT_TONE: Record<VisitResult, string> = {
  sem_interesse: 'data-[on=true]:bg-slate-700',
  interessado: 'data-[on=true]:bg-yellow-500',
  negociacao: 'data-[on=true]:bg-orange-600',
  pedido_realizado: 'data-[on=true]:bg-green-600',
  retornar_depois: 'data-[on=true]:bg-blue-600',
  perdido: 'data-[on=true]:bg-red-600',
};

export function VisitForm({
  companies,
  contacts,
  opportunities,
  products,
  initialCompany,
  initialOpportunity,
}: {
  companies: PickerOption[];
  contacts: ContactOpt[];
  opportunities: OppOpt[];
  products: Product[];
  initialCompany?: string | null;
  initialOpportunity?: string | null;
}) {
  const [step, setStep] = React.useState(0);
  const [company, setCompany] = React.useState<string | null>(initialCompany ?? null);
  const [contact, setContact] = React.useState<string | null>(null);
  const [opportunity, setOpportunity] = React.useState<string | null>(initialOpportunity ?? null);
  const [visitType, setVisitType] = React.useState<VisitType>('follow_up');
  const [result, setResult] = React.useState<VisitResult | null>(null);
  const [interest, setInterest] = React.useState<InterestLevel | null>(null);
  const [productIds, setProductIds] = React.useState<string[]>([]);
  const [nextDate, setNextDate] = React.useState<string>(addDaysISO(todayISO(), 7));
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [geo, setGeo] = React.useState<Geo>({ state: 'idle' });
  const today = todayISO();

  const { state, pending, onSubmit, errors } = useFormAction(saveVisit, { redirectTo: (s) => s.id });

  const companyContacts = contacts.filter((c) => c.company_id === company);
  const companyOpps = opportunities.filter((o) => o.company_id === company);
  const positive = result === 'interessado' || result === 'negociacao' || result === 'pedido_realizado';

  React.useEffect(() => {
    if (companyContacts.length === 1) setContact(companyContacts[0].value);
    if (companyOpps.length === 1 && !initialOpportunity) setOpportunity(companyOpps[0].value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company]);

  const captureLocation = React.useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGeo({ state: 'error' });
      return;
    }
    setGeo({ state: 'loading' });
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setGeo({
          state: 'ok',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: Math.round(pos.coords.accuracy),
          at: new Date(pos.timestamp).toISOString(),
        }),
      (err) => setGeo({ state: err.code === err.PERMISSION_DENIED ? 'denied' : 'error' }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, []);

  // Captura automática só se a permissão já foi concedida antes (sem pop-up surpresa).
  React.useEffect(() => {
    navigator.permissions
      ?.query({ name: 'geolocation' as PermissionName })
      .then((p) => {
        if (p.state === 'granted') captureLocation();
      })
      .catch(() => {});
  }, [captureLocation]);

  const next = () => {
    setLocalError(null);
    if (step === 0 && !company) return setLocalError('Selecione o cliente visitado.');
    if (step === 1 && !result) return setLocalError('Informe o resultado da visita.');
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleProduct = (id: string) =>
    setProductIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <form onSubmit={onSubmit} noValidate className="pb-24 lg:pb-0">
      {/* Progresso */}
      <ol className="mb-5 grid grid-cols-3 gap-2" aria-label="Etapas">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              className="w-full text-left"
              aria-current={i === step ? 'step' : undefined}
            >
              <span className={cn('block h-1.5 rounded-full', i <= step ? 'bg-brand' : 'bg-line')} />
              <span className={cn('mt-1.5 block text-xs font-medium', i === step ? 'text-ink' : 'text-muted')}>
                {i + 1}. {label}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {/* Campos controlados enviados no formulário */}
      <input type="hidden" name="visit_type" value={visitType} />
      <input type="hidden" name="result" value={result ?? ''} />
      <input type="hidden" name="interest_level" value={interest ?? ''} />
      {productIds.map((id) => (
        <input key={id} type="hidden" name="product_ids" value={id} />
      ))}
      {geo.state === 'ok' && (
        <>
          <input type="hidden" name="latitude" value={geo.lat} />
          <input type="hidden" name="longitude" value={geo.lng} />
          <input type="hidden" name="location_accuracy_m" value={geo.acc} />
          <input type="hidden" name="location_captured_at" value={geo.at} />
        </>
      )}

      {/* Etapa 1 */}
      <section className={cn('space-y-4', step !== 0 && 'hidden')}>
        <Field label="Cliente visitado" required error={errors.company_id}>
          <Picker name="company_id" title="Cliente visitado" options={companies} value={company} onChange={(v) => { setCompany(v); setContact(null); setOpportunity(null); }} placeholder="Buscar cliente" allowClear={false} />
        </Field>
        {company && (
          <Field label="Com quem falou?">
            <Picker name="contact_id" title="Comprador" options={companyContacts} value={contact} onChange={setContact} placeholder={companyContacts.length ? 'Selecionar comprador' : 'Nenhum comprador cadastrado'} emptyText="Cadastre compradores na página do cliente." />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data" htmlFor="visit_date" required error={errors.visit_date}>
            <Input id="visit_date" name="visit_date" type="date" defaultValue={today} max={today} />
          </Field>
          <Field label="Hora" htmlFor="visit_time" required error={errors.visit_time}>
            <Input id="visit_time" name="visit_time" type="time" defaultValue={nowTimeHM()} />
          </Field>
        </div>
        <Field label="Tipo de visita">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(VISIT_TYPE_LABELS) as VisitType[]).map((t) => (
              <Chip key={t} on={visitType === t} onClick={() => setVisitType(t)}>
                {VISIT_TYPE_LABELS[t]}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="Objetivo" htmlFor="objective">
          <Input id="objective" name="objective" placeholder="Ex.: apresentar linha de onigiris" />
        </Field>
      </section>

      {/* Etapa 2 */}
      <section className={cn('space-y-4', step !== 1 && 'hidden')}>
        <Field label="Resultado" required error={errors.result}>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(VISIT_RESULT_LABELS) as VisitResult[]).map((r) => (
              <button
                key={r}
                type="button"
                data-on={result === r}
                onClick={() => setResult(r)}
                className={cn(
                  'flex min-h-14 items-center justify-center rounded-xl px-3 text-center text-sm font-semibold ring-1 ring-line-strong bg-surface data-[on=true]:text-white data-[on=true]:ring-0',
                  RESULT_TONE[r],
                )}
              >
                {VISIT_RESULT_LABELS[r]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Interesse demonstrado">
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(INTEREST_LABELS) as InterestLevel[]).map((l) => (
              <Chip key={l} on={interest === l} onClick={() => setInterest(interest === l ? null : l)}>
                {INTEREST_LABELS[l]}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="Produtos apresentados">
          <div className="flex flex-wrap gap-2">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleProduct(p.id)}
                className={cn(
                  'flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm ring-1',
                  productIds.includes(p.id) ? 'bg-nori-900 text-white ring-nori-900' : 'bg-surface ring-line-strong',
                )}
                aria-pressed={productIds.includes(p.id)}
              >
                {productIds.includes(p.id) && <Check className="size-3.5" />}
                {p.name}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Valor potencial (R$)" htmlFor="potential_value" error={errors.potential_value} hint="Estimativa de compra do cliente.">
          <Input id="potential_value" name="potential_value" inputMode="decimal" placeholder="0,00" />
        </Field>
        <Field label="Observações" htmlFor="notes">
          <Textarea id="notes" name="notes" placeholder="O que foi conversado, objeções, concorrentes, condições…" />
        </Field>
      </section>

      {/* Etapa 3 */}
      <section className={cn('space-y-4', step !== 2 && 'hidden')}>
        <Field label="Próximo passo" htmlFor="next_step">
          <Input id="next_step" name="next_step" placeholder="Ex.: enviar proposta com tabela" />
        </Field>
        <Field label="Data do próximo contato" error={errors.next_contact_date}>
          <div className="flex flex-wrap gap-2">
            {[
              { l: 'Amanhã', d: 1 },
              { l: '3 dias', d: 3 },
              { l: '1 semana', d: 7 },
              { l: '15 dias', d: 15 },
              { l: '1 mês', d: 30 },
            ].map((o) => (
              <Chip key={o.l} compact on={nextDate === addDaysISO(today, o.d)} onClick={() => setNextDate(addDaysISO(today, o.d))}>
                {o.l}
              </Chip>
            ))}
          </div>
          <Input className="mt-2" type="date" name="next_contact_date" value={nextDate} min={today} onChange={(e) => setNextDate(e.target.value)} />
        </Field>
        <Checkbox name="create_follow_up" defaultChecked label="Criar tarefa de follow-up nesta data" />

        {company && companyOpps.length > 0 && (
          <Field label="Oportunidade relacionada" hint="A etapa avança automaticamente conforme o resultado.">
            <Picker name="opportunity_id" title="Oportunidade" options={companyOpps} value={opportunity} onChange={setOpportunity} placeholder="Nenhuma" />
          </Field>
        )}
        {positive && !opportunity && (
          <Checkbox name="create_opportunity" defaultChecked label="Criar oportunidade no pipeline com este interesse" />
        )}
        {result === 'pedido_realizado' && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 ring-1 ring-green-200">
            Ao salvar, você vai direto para o cadastro do pedido.
          </p>
        )}

        <LocationStatus geo={geo} onCapture={captureLocation} />
      </section>

      <FormError message={localError ?? state.error} />

      {/* Barra de ações fixa no celular */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-surface/95 p-3 backdrop-blur pb-safe lg:static lg:mt-6 lg:border-0 lg:bg-transparent lg:p-0">
        <div className="mx-auto flex max-w-2xl gap-2">
          {step > 0 && (
            <Button type="button" variant="secondary" size="xl" onClick={() => setStep(step - 1)} aria-label="Voltar">
              <ChevronLeft />
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" size="xl" className="flex-1" onClick={next}>
              Continuar
            </Button>
          ) : (
            <Button type="submit" size="xl" className="flex-1" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="animate-spin" /> Salvando…
                </>
              ) : (
                <>
                  <MapPin /> Salvar visita
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

function Chip({ on, onClick, children, compact }: { on: boolean; onClick: () => void; children: React.ReactNode; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'rounded-xl px-3 text-sm font-medium ring-1',
        compact ? 'h-9 rounded-full' : 'min-h-12',
        on ? 'bg-nori-900 text-white ring-nori-900' : 'bg-surface ring-line-strong',
      )}
    >
      {children}
    </button>
  );
}

function LocationStatus({ geo, onCapture }: { geo: Geo; onCapture: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-rice p-3 ring-1 ring-line">
      <div className="flex items-center gap-2 text-sm">
        {geo.state === 'ok' ? <LocateFixed className="size-5 text-green-600" /> : <LocateOff className="size-5 text-muted" />}
        <div>
          <p className="font-medium">
            {geo.state === 'ok'
              ? 'Localização registrada'
              : geo.state === 'loading'
                ? 'Obtendo localização…'
                : geo.state === 'denied'
                  ? 'Localização bloqueada no navegador'
                  : 'Localização (opcional)'}
          </p>
          <p className="text-xs text-muted">
            {geo.state === 'ok' ? `Precisão aproximada de ${geo.acc} m` : 'Comprova a visita no local. Não é obrigatória.'}
          </p>
        </div>
      </div>
      {geo.state !== 'ok' && geo.state !== 'loading' && (
        <Button type="button" variant="secondary" size="sm" onClick={onCapture}>
          Registrar
        </Button>
      )}
    </div>
  );
}
