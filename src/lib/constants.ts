// Rótulos e cores dos tipos do banco. Fonte única para toda a interface.

export type UserRole = 'admin' | 'vendedor';
export type ClientType =
  | 'rede_supermercado'
  | 'supermercado_independente'
  | 'distribuidor'
  | 'atacadista'
  | 'conveniencia'
  | 'restaurante'
  | 'food_service'
  | 'outro';
export type Temperature = 'frio' | 'interessado' | 'quente' | 'cliente' | 'perdido';
export type ProductCategory = 'bento' | 'onigiri' | 'tamago' | 'hot_roll' | 'food_service' | 'outros';
export type ActivityType =
  | 'visita'
  | 'ligacao'
  | 'whatsapp'
  | 'email'
  | 'reuniao'
  | 'follow_up'
  | 'pedido'
  | 'pos_venda';
export type VisitType = 'primeira_visita' | 'follow_up' | 'apresentacao' | 'negociacao' | 'pos_venda' | 'reativacao';
export type VisitResult =
  | 'sem_interesse'
  | 'interessado'
  | 'negociacao'
  | 'pedido_realizado'
  | 'retornar_depois'
  | 'perdido';
export type InterestLevel = 'baixo' | 'medio' | 'alto';
export type TaskPriority = 'alta' | 'media' | 'baixa';
export type TaskStatus = 'pendente' | 'concluida' | 'cancelada';
export type OrderStatus = 'orcamento' | 'pedido_realizado' | 'faturado' | 'em_entrega' | 'entregue' | 'cancelado';

type Options<T extends string> = { value: T; label: string }[];
const toOptions = <T extends string>(labels: Record<T, string>): Options<T> =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  rede_supermercado: 'Rede de supermercado',
  supermercado_independente: 'Supermercado independente',
  distribuidor: 'Distribuidor',
  atacadista: 'Atacadista',
  conveniencia: 'Loja de conveniência',
  restaurante: 'Restaurante',
  food_service: 'Food Service',
  outro: 'Outro',
};

export const TEMPERATURE: Record<Temperature, { label: string; emoji: string; dot: string; badge: string }> = {
  frio: { label: 'Frio', emoji: '🔵', dot: 'bg-temp-frio', badge: 'bg-blue-50 text-blue-800 ring-blue-200' },
  interessado: {
    label: 'Interessado',
    emoji: '🟡',
    dot: 'bg-temp-interessado',
    badge: 'bg-yellow-50 text-yellow-800 ring-yellow-200',
  },
  quente: { label: 'Quente', emoji: '🟠', dot: 'bg-temp-quente', badge: 'bg-orange-50 text-orange-800 ring-orange-200' },
  cliente: { label: 'Cliente', emoji: '🟢', dot: 'bg-temp-cliente', badge: 'bg-green-50 text-green-800 ring-green-200' },
  perdido: { label: 'Perdido', emoji: '🔴', dot: 'bg-temp-perdido', badge: 'bg-red-50 text-red-800 ring-red-200' },
};
export const TEMPERATURE_ORDER: Temperature[] = ['frio', 'interessado', 'quente', 'cliente', 'perdido'];

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  bento: 'Bento',
  onigiri: 'Onigiri',
  tamago: 'Tamago',
  hot_roll: 'Hot Roll',
  food_service: 'Food Service',
  outros: 'Outros',
};

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  visita: 'Visita',
  ligacao: 'Ligação',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  reuniao: 'Reunião',
  follow_up: 'Follow-up',
  pedido: 'Pedido',
  pos_venda: 'Pós-venda',
};

export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  primeira_visita: 'Primeira visita',
  follow_up: 'Follow-up',
  apresentacao: 'Apresentação de produto',
  negociacao: 'Negociação',
  pos_venda: 'Pós-venda',
  reativacao: 'Reativação',
};

export const VISIT_RESULT_LABELS: Record<VisitResult, string> = {
  sem_interesse: 'Sem interesse',
  interessado: 'Interessado',
  negociacao: 'Negociação',
  pedido_realizado: 'Pedido realizado',
  retornar_depois: 'Retornar depois',
  perdido: 'Perdido',
};

export const INTEREST_LABELS: Record<InterestLevel, string> = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto' };

export const PRIORITY: Record<TaskPriority, { label: string; emoji: string; className: string }> = {
  alta: { label: 'Alta', emoji: '🔴', className: 'bg-red-50 text-red-800 ring-red-200' },
  media: { label: 'Média', emoji: '🟡', className: 'bg-yellow-50 text-yellow-800 ring-yellow-200' },
  baixa: { label: 'Baixa', emoji: '🟢', className: 'bg-green-50 text-green-800 ring-green-200' },
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pendente: 'Pendente',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export const ORDER_STATUS: Record<OrderStatus, { label: string; className: string }> = {
  orcamento: { label: 'Orçamento', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
  pedido_realizado: { label: 'Pedido realizado', className: 'bg-blue-50 text-blue-800 ring-blue-200' },
  faturado: { label: 'Faturado', className: 'bg-green-50 text-green-800 ring-green-200' },
  em_entrega: { label: 'Em entrega', className: 'bg-violet-50 text-violet-800 ring-violet-200' },
  entregue: { label: 'Entregue', className: 'bg-emerald-100 text-emerald-900 ring-emerald-300' },
  cancelado: { label: 'Cancelado', className: 'bg-red-50 text-red-800 ring-red-200' },
};
export const BILLED_STATUSES: OrderStatus[] = ['faturado', 'em_entrega', 'entregue'];
export const EDITABLE_ORDER_STATUSES: OrderStatus[] = ['orcamento', 'pedido_realizado'];

export const UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR',
  'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export const OPTIONS = {
  clientType: toOptions(CLIENT_TYPE_LABELS),
  temperature: TEMPERATURE_ORDER.map((value) => ({ value, label: `${TEMPERATURE[value].emoji} ${TEMPERATURE[value].label}` })),
  productCategory: toOptions(PRODUCT_CATEGORY_LABELS),
  activityType: toOptions(ACTIVITY_TYPE_LABELS),
  visitType: toOptions(VISIT_TYPE_LABELS),
  visitResult: toOptions(VISIT_RESULT_LABELS),
  interest: toOptions(INTEREST_LABELS),
  priority: (Object.keys(PRIORITY) as TaskPriority[]).map((value) => ({
    value,
    label: `${PRIORITY[value].emoji} ${PRIORITY[value].label}`,
  })),
  orderStatus: (Object.keys(ORDER_STATUS) as OrderStatus[]).map((value) => ({ value, label: ORDER_STATUS[value].label })),
  uf: UF_LIST.map((value) => ({ value, label: value })),
};
