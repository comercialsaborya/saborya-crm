import { addDaysISO, todayISO } from './format';

export const PERIOD_PRESETS = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes', label: 'Este mês' },
  { value: 'mes_anterior', label: 'Mês anterior' },
  { value: '3m', label: 'Últimos 3 meses' },
  { value: '6m', label: 'Últimos 6 meses' },
  { value: '12m', label: 'Últimos 12 meses' },
  { value: 'personalizado', label: 'Período personalizado' },
] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number]['value'];
export type DateRange = { from: string; to: string; preset: PeriodPreset; label: string };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function monthStart(iso: string, offsetMonths = 0) {
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offsetMonths, 1, 12));
  return d.toISOString().slice(0, 10);
}

function monthEnd(iso: string) {
  const [y, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0, 12)).toISOString().slice(0, 10);
}

/** Resolve o período a partir dos parâmetros da URL (?periodo=&de=&ate=). */
export function resolvePeriod(
  params: { periodo?: string | string[]; de?: string | string[]; ate?: string | string[] },
  fallback: PeriodPreset = 'mes',
  today: string = todayISO(),
): DateRange {
  const one = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);
  const raw = one(params.periodo) as PeriodPreset | undefined;
  const preset: PeriodPreset = PERIOD_PRESETS.some((p) => p.value === raw) ? (raw as PeriodPreset) : fallback;
  const label = PERIOD_PRESETS.find((p) => p.value === preset)!.label;

  switch (preset) {
    case 'hoje':
      return { from: today, to: today, preset, label };
    case 'semana': {
      const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 = domingo
      const from = addDaysISO(today, dow === 0 ? -6 : 1 - dow);
      return { from, to: addDaysISO(from, 6), preset, label };
    }
    case 'mes':
      return { from: monthStart(today), to: monthEnd(today), preset, label };
    case 'mes_anterior': {
      const from = monthStart(today, -1);
      return { from, to: monthEnd(from), preset, label };
    }
    case '3m':
      return { from: monthStart(today, -2), to: today, preset, label };
    case '6m':
      return { from: monthStart(today, -5), to: today, preset, label };
    case '12m':
      return { from: monthStart(today, -11), to: today, preset, label };
    case 'personalizado': {
      let from = one(params.de) ?? '';
      let to = one(params.ate) ?? '';
      if (!ISO.test(from)) from = monthStart(today);
      if (!ISO.test(to)) to = today;
      if (from > to) [from, to] = [to, from];
      return { from, to, preset, label: `${from.split('-').reverse().join('/')} a ${to.split('-').reverse().join('/')}` };
    }
  }
}
