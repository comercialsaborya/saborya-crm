import { z } from 'zod';
import { onlyDigits } from './utils';

z.config(z.locales.pt());

// ---------------------------------------------------------------------------
// Primitivas tolerantes a formulários (strings vazias -> null, números pt-BR)
// ---------------------------------------------------------------------------

const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

/** Aceita "1.234,56", "1234.56", "R$ 1.234,56". */
export function parseDecimal(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).replace(/[R$\s%]/g, '').trim();
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

const text = (max = 500) => z.preprocess(blankToNull, z.string().trim().max(max).nullable().optional());
const requiredText = (label: string, max = 200) =>
  z.string({ error: `Informe ${label}.` }).trim().min(1, `Informe ${label}.`).max(max);
const money = (label = 'o valor') =>
  z.preprocess(
    parseDecimal,
    z.number({ error: `Valor inválido para ${label}.` }).min(0, `${label} não pode ser negativo.`).nullable().optional(),
  );
const uuid = (label: string) => z.uuid({ error: `Selecione ${label}.` });
const optionalUuid = z.preprocess(blankToNull, z.uuid().nullable().optional());
const isoDate = (label: string) =>
  z.string({ error: `Informe ${label}.` }).regex(/^\d{4}-\d{2}-\d{2}$/, `Informe ${label}.`);
const optionalDate = z.preprocess(blankToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.').nullable().optional());
const optionalTime = z.preprocess(blankToNull, z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Hora inválida.').nullable().optional());
const optionalEmail = z.preprocess(blankToNull, z.email('E-mail inválido.').nullable().optional());
const optionalNumber = z.preprocess(parseDecimal, z.number().nullable().optional());

const phone = z.preprocess(
  blankToNull,
  z
    .string()
    .trim()
    .refine((v) => onlyDigits(v).length >= 10 && onlyDigits(v).length <= 13, 'Telefone deve ter DDD + número.')
    .nullable()
    .optional(),
);

/** Valida dígitos verificadores do CNPJ. */
export function isValidCNPJ(value: string): boolean {
  const c = onlyDigits(value);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + Number(c[i]) * w, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

const cnpj = z.preprocess(
  (v) => (typeof v === 'string' ? onlyDigits(v) || null : v),
  z.string().refine(isValidCNPJ, 'CNPJ inválido.').nullable().optional(),
);

const enumOf = <T extends string>(values: readonly [T, ...T[]], label: string) =>
  z.enum(values, { error: `Selecione ${label}.` });

// ---------------------------------------------------------------------------
// Schemas por entidade
// ---------------------------------------------------------------------------

export const companySchema = z.object({
  legal_name: requiredText('a razão social'),
  trade_name: text(200),
  cnpj,
  segment: text(120),
  client_type: enumOf(
    ['rede_supermercado', 'supermercado_independente', 'distribuidor', 'atacadista', 'conveniencia', 'restaurante', 'food_service', 'outro'],
    'o tipo de cliente',
  ),
  address: text(300),
  city: text(120),
  state: z.preprocess(blankToNull, z.string().regex(/^[A-Z]{2}$/, 'UF inválida.').nullable().optional()),
  zip_code: text(12),
  phone,
  email: optionalEmail,
  website: text(300),
  instagram: text(120),
  status: enumOf(['frio', 'interessado', 'quente', 'cliente', 'perdido'], 'o status'),
  purchase_potential: money('o potencial de compra'),
  next_contact_date: optionalDate,
  notes: text(4000),
  owner_id: optionalUuid,
});

export const contactSchema = z.object({
  company_id: uuid('o cliente'),
  name: requiredText('o nome'),
  job_title: text(120),
  department: text(120),
  phone,
  whatsapp: phone,
  email: optionalEmail,
  linkedin: text(300),
  best_contact_time: text(120),
  notes: text(4000),
  is_primary: z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean()),
});

export const productSchema = z.object({
  name: requiredText('o nome'),
  sku: requiredText('o SKU', 40).transform((v) => v.toUpperCase()),
  category: enumOf(['bento', 'onigiri', 'tamago', 'hot_roll', 'food_service', 'outros'], 'a categoria'),
  sales_unit: requiredText('a unidade de venda', 40),
  price: z.preprocess(parseDecimal, z.number({ error: 'Informe o preço.' }).min(0, 'Preço inválido.')),
  cost: z.preprocess(parseDecimal, z.number({ error: 'Informe o custo.' }).min(0, 'Custo inválido.')),
  active: z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean()),
  notes: text(2000),
});

export const opportunitySchema = z.object({
  company_id: uuid('o cliente'),
  contact_id: optionalUuid,
  title: requiredText('o título'),
  stage_key: z.string().min(1, 'Selecione a etapa.'),
  temperature: enumOf(['frio', 'interessado', 'quente', 'cliente', 'perdido'], 'a temperatura'),
  estimated_value: z.preprocess(parseDecimal, z.number({ error: 'Informe o valor estimado.' }).min(0)),
  expected_close_date: optionalDate,
  next_activity_date: optionalDate,
  next_activity_note: text(300),
  lost_reason: text(500),
  notes: text(4000),
  owner_id: optionalUuid,
});

export const visitSchema = z.object({
  company_id: uuid('o cliente'),
  contact_id: optionalUuid,
  opportunity_id: optionalUuid,
  visit_date: isoDate('a data'),
  visit_time: z.string().regex(/^\d{2}:\d{2}$/, 'Informe a hora.'),
  visit_type: enumOf(['primeira_visita', 'follow_up', 'apresentacao', 'negociacao', 'pos_venda', 'reativacao'], 'o tipo de visita'),
  objective: text(500),
  result: enumOf(
    ['sem_interesse', 'interessado', 'negociacao', 'pedido_realizado', 'retornar_depois', 'perdido'],
    'o resultado',
  ),
  notes: text(4000),
  next_step: text(500),
  next_contact_date: optionalDate,
  potential_value: money('o valor potencial'),
  interest_level: z.preprocess(blankToNull, z.enum(['baixo', 'medio', 'alto']).nullable().optional()),
  product_ids: z.array(z.uuid()).default([]),
  latitude: optionalNumber,
  longitude: optionalNumber,
  location_accuracy_m: optionalNumber,
  location_captured_at: z.preprocess(blankToNull, z.string().nullable().optional()),
  create_follow_up: z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean()),
  create_opportunity: z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean()),
});

export const activitySchema = z.object({
  type: enumOf(['visita', 'ligacao', 'whatsapp', 'email', 'reuniao', 'follow_up', 'pedido', 'pos_venda'], 'o tipo'),
  company_id: uuid('o cliente'),
  contact_id: optionalUuid,
  opportunity_id: optionalUuid,
  activity_date: isoDate('a data'),
  activity_time: z.string().regex(/^\d{2}:\d{2}$/, 'Informe a hora.'),
  description: requiredText('a descrição', 2000),
  result: text(2000),
  next_action: text(500),
  next_action_date: optionalDate,
  create_follow_up: z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean()),
});

export const taskSchema = z.object({
  title: requiredText('a descrição da tarefa', 300),
  description: text(2000),
  company_id: optionalUuid,
  contact_id: optionalUuid,
  opportunity_id: optionalUuid,
  due_date: isoDate('o prazo'),
  due_time: optionalTime,
  priority: enumOf(['alta', 'media', 'baixa'], 'a prioridade'),
  owner_id: optionalUuid,
});

export const orderItemSchema = z.object({
  product_id: uuid('o produto'),
  quantity: z.preprocess(parseDecimal, z.number({ error: 'Quantidade inválida.' }).gt(0, 'Quantidade deve ser maior que zero.')),
  unit_price: z.preprocess(parseDecimal, z.number({ error: 'Preço inválido.' }).min(0, 'Preço inválido.')),
});

export const orderSchema = z
  .object({
    company_id: uuid('o cliente'),
    contact_id: optionalUuid,
    opportunity_id: optionalUuid,
    order_date: isoDate('a data do pedido'),
    status: z.enum(['orcamento', 'pedido_realizado']),
    discount: z.preprocess(parseDecimal, z.number().min(0, 'Desconto não pode ser negativo.').nullable().optional()),
    notes: text(4000),
    owner_id: optionalUuid,
    items: z.array(orderItemSchema).min(1, 'Adicione pelo menos um produto.'),
  })
  .superRefine((o, ctx) => {
    const subtotal = calcOrderSubtotal(o.items);
    if ((o.discount ?? 0) > subtotal) {
      ctx.addIssue({ code: 'custom', path: ['discount'], message: 'Desconto maior que o subtotal.' });
    }
    const ids = o.items.map((i) => i.product_id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'O mesmo produto aparece mais de uma vez.' });
    }
  });

export const sellerCreateSchema = z.object({
  full_name: requiredText('o nome'),
  email: z.email('E-mail inválido.'),
  phone,
  password: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres.'),
  role: enumOf(['admin', 'vendedor'], 'o perfil'),
});

export const profileUpdateSchema = z.object({
  full_name: requiredText('o nome'),
  phone,
  role: enumOf(['admin', 'vendedor'], 'o perfil'),
  active: z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean()),
});

export const organizationSchema = z.object({
  name: requiredText('o nome da empresa'),
  inactivity_days: z.coerce.number().int().min(1).max(365),
  stalled_opportunity_days: z.coerce.number().int().min(1).max(365),
  repurchase_alert_days: z.coerce.number().int().min(1).max(365),
  brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida.'),
});

// ---------------------------------------------------------------------------
// Cálculos de pedido (compartilhados por formulário, servidor e testes)
// ---------------------------------------------------------------------------

export function calcLineSubtotal(quantity: number, unitPrice: number) {
  return Math.round(quantity * unitPrice * 100) / 100;
}

export function calcOrderSubtotal(items: { quantity: number; unit_price: number }[]) {
  return Math.round(items.reduce((s, i) => s + calcLineSubtotal(i.quantity, i.unit_price), 0) * 100) / 100;
}

export function calcOrderTotal(items: { quantity: number; unit_price: number }[], discount = 0) {
  const subtotal = calcOrderSubtotal(items);
  return Math.max(Math.round((subtotal - Math.min(discount, subtotal)) * 100) / 100, 0);
}

// ---------------------------------------------------------------------------
// Conversão de FormData
// ---------------------------------------------------------------------------

export function formDataToObject(fd: FormData, arrays: string[] = []) {
  const obj: Record<string, unknown> = {};
  for (const key of new Set(fd.keys())) {
    obj[key] = arrays.includes(key) ? fd.getAll(key).map(String) : fd.get(key);
  }
  for (const key of arrays) obj[key] ??= [];
  return obj;
}

export type FieldErrors = Record<string, string[] | undefined>;

export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.map(String).join('.') : '_form';
    const top = issue.path[0] !== undefined ? String(issue.path[0]) : '_form';
    (out[key] ??= []).push(issue.message);
    if (top !== key) (out[top] ??= []).push(issue.message);
  }
  return out;
}
