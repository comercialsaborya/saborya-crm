import { onlyDigits } from './utils';

export const APP_TIMEZONE = 'America/Sao_Paulo';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const oneDecimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

type Num = number | string | null | undefined;
const toNumber = (v: Num) => (v === null || v === undefined || v === '' ? 0 : Number(v));

export const formatBRL = (v: Num) => brl.format(toNumber(v));
/** "R$ 42 mil", "R$ 1,2 mi" — formatação própria (o "compact" do Intl varia entre Node e navegadores). */
export function formatBRLCompact(v: Num): string {
  const n = toNumber(v);
  const a = Math.abs(n);
  if (a < 10000) return brl.format(n);
  if (a < 1_000_000) return `R$\u00a0${oneDecimal.format(n / 1000)}\u00a0mil`;
  return `R$\u00a0${oneDecimal.format(n / 1_000_000)}\u00a0mi`;
}
export const formatInt = (v: Num) => integer.format(toNumber(v));
export const formatNumber = (v: Num) => decimal.format(toNumber(v));
export const formatPercent = (v: Num, digits = 1) =>
  v === null || v === undefined ? '—' : `${toNumber(v).toLocaleString('pt-BR', { maximumFractionDigits: digits })}%`;

/** Datas "puras" (YYYY-MM-DD) não sofrem conversão de fuso. */
function parse(value: string | Date): Date {
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00Z`);
  return new Date(value);
}

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: APP_TIMEZONE, ...opts });
const fDate = fmt({ day: '2-digit', month: '2-digit', year: 'numeric' });
const fShort = fmt({ day: '2-digit', month: '2-digit' });
const fDateTime = fmt({ day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const fTime = fmt({ hour: '2-digit', minute: '2-digit' });
const fMonth = fmt({ month: 'short', year: '2-digit' });
const fMonthLong = fmt({ month: 'long', year: 'numeric' });
const fWeekday = fmt({ weekday: 'short', day: '2-digit', month: '2-digit' });

export const formatDate = (v?: string | Date | null) => (v ? fDate.format(parse(v)) : '—');
export const formatShortDate = (v?: string | Date | null) => (v ? fShort.format(parse(v)) : '—');
export const formatDateTime = (v?: string | Date | null) => (v ? fDateTime.format(parse(v)) : '—');
export const formatTime = (v?: string | Date | null) => (v ? fTime.format(parse(v)) : '—');
export const formatWeekday = (v?: string | Date | null) => (v ? fWeekday.format(parse(v)) : '—');
export const formatMonth = (v?: string | Date | null) => (v ? fMonth.format(parse(v)).replace('.', '') : '—');
export const formatMonthLong = (v?: string | Date | null) => (v ? fMonthLong.format(parse(v)) : '—');

/** Data de hoje no fuso de São Paulo, em YYYY-MM-DD. */
export function todayISO(base: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }).format(base);
}

/** Hora atual em HH:mm no fuso de São Paulo. */
export function nowTimeHM(base: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: APP_TIMEZONE, hour: '2-digit', minute: '2-digit' }).format(base);
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDaysISO(a: string, b: string): number {
  return Math.round((new Date(`${a}T12:00:00Z`).getTime() - new Date(`${b}T12:00:00Z`).getTime()) / 86400000);
}

/** Converte data + hora locais (São Paulo, UTC-3 sem horário de verão) em ISO UTC. */
export function localDateTimeToISO(date: string, time: string): string {
  return new Date(`${date}T${time || '12:00'}:00-03:00`).toISOString();
}

export function relativeTime(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (!value) return '—';
  const d = parse(value);
  const sec = Math.round((now.getTime() - d.getTime()) / 1000);
  if (sec < 60) return 'agora';
  const min = Math.round(sec / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.round(h / 24);
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  return formatDate(d);
}

export function formatCNPJ(v?: string | null) {
  const d = onlyDigits(v);
  if (d.length !== 14) return v ?? '';
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export function formatPhone(v?: string | null) {
  const d = onlyDigits(v).replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return v ?? '';
}

/** Link do WhatsApp (assume Brasil quando vier sem DDI). */
export function whatsappLink(phone?: string | null, text?: string) {
  let d = onlyDigits(phone);
  if (!d) return null;
  if (d.length <= 11) d = `55${d}`;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function telLink(phone?: string | null) {
  const d = onlyDigits(phone);
  return d ? `tel:+${d.length <= 11 ? `55${d}` : d}` : null;
}

export function mapsLink(parts: (string | null | undefined)[]) {
  const q = parts.filter(Boolean).join(', ');
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

export function mapsCoordsLink(lat?: number | null, lng?: number | null) {
  return lat != null && lng != null ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : null;
}

export function greeting(base: Date = new Date()) {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: APP_TIMEZONE, hour: '2-digit', hour12: false }).format(base));
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}
