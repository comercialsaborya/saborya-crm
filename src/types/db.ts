// Tipos das tabelas e views usadas pela interface.
// (Para tipos gerados automaticamente: `npx supabase gen types typescript`.)
import type {
  ActivityType,
  ClientType,
  InterestLevel,
  OrderStatus,
  ProductCategory,
  TaskPriority,
  TaskStatus,
  Temperature,
  UserRole,
  VisitResult,
  VisitType,
} from '@/lib/constants';

type Timestamps = { created_at: string; updated_at: string };
type Num = number | string; // numeric chega como string ou number

export interface Profile extends Timestamps {
  id: string;
  organization_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  active: boolean;
  is_demo: boolean;
}

export interface Organization extends Timestamps {
  id: string;
  name: string;
  timezone: string;
  inactivity_days: number;
  stalled_opportunity_days: number;
  repurchase_alert_days: number;
  brand_color: string;
}

export interface Company extends Timestamps {
  id: string;
  organization_id: string;
  legal_name: string;
  trade_name: string | null;
  cnpj: string | null;
  segment: string | null;
  client_type: ClientType;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  owner_id: string;
  status: Temperature;
  purchase_potential: Num | null;
  last_contact_at: string | null;
  last_visit_at: string | null;
  next_contact_date: string | null;
  notes: string | null;
  is_demo: boolean;
  deleted_at: string | null;
}

export interface CompanyOverview extends Company {
  display_name: string;
  owner_name: string | null;
  revenue_total: Num;
  volume_total: Num;
  invoiced_orders: number;
  last_purchase_at: string | null;
  open_opportunities: number;
  open_value: Num;
  next_task_date: string | null;
  next_action_date: string | null;
  days_without_contact: number;
}

export interface Contact extends Timestamps {
  id: string;
  company_id: string;
  name: string;
  job_title: string | null;
  department: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  linkedin: string | null;
  best_contact_time: string | null;
  notes: string | null;
  is_primary: boolean;
  is_demo: boolean;
  deleted_at: string | null;
}

export interface ContactListRow extends Contact {
  company_name: string;
  owner_id: string;
  city: string | null;
  state: string | null;
}

export interface Product extends Timestamps {
  id: string;
  name: string;
  sku: string;
  category: ProductCategory;
  sales_unit: string;
  price: Num;
  cost: Num;
  margin_percent: Num | null;
  active: boolean;
  notes: string | null;
}

export interface PipelineStage {
  key: string;
  name: string;
  position: number;
  color: string;
  probability: number;
  is_won: boolean;
  is_lost: boolean;
  active: boolean;
}

export interface Opportunity extends Timestamps {
  id: string;
  company_id: string;
  contact_id: string | null;
  owner_id: string;
  title: string;
  stage_key: string;
  temperature: Temperature;
  estimated_value: Num;
  expected_close_date: string | null;
  stage_entered_at: string;
  last_activity_at: string | null;
  next_activity_date: string | null;
  next_activity_note: string | null;
  lost_reason: string | null;
  closed_at: string | null;
  notes: string | null;
  deleted_at: string | null;
}

export interface OpportunityBoardRow extends Opportunity {
  company_name: string | null;
  city: string | null;
  state: string | null;
  contact_name: string | null;
  contact_whatsapp: string | null;
  contact_phone: string | null;
  owner_name: string | null;
  stage_name: string;
  stage_position: number;
  is_won: boolean;
  is_lost: boolean;
  days_without_contact: number;
  days_in_stage: number;
  next_task_date: string | null;
  next_task_title: string | null;
}

export interface VisitRow extends Timestamps {
  id: string;
  company_id: string;
  contact_id: string | null;
  opportunity_id: string | null;
  owner_id: string;
  visited_at: string;
  visit_type: VisitType;
  objective: string | null;
  result: VisitResult;
  notes: string | null;
  next_step: string | null;
  next_contact_date: string | null;
  potential_value: Num | null;
  interest_level: InterestLevel | null;
  latitude: number | null;
  longitude: number | null;
  location_accuracy_m: number | null;
  location_captured_at: string | null;
  company_name: string | null;
  city: string | null;
  state: string | null;
  contact_name: string | null;
  owner_name: string | null;
  product_names: string[];
}

export interface ActivityRow extends Timestamps {
  id: string;
  type: ActivityType;
  company_id: string;
  contact_id: string | null;
  opportunity_id: string | null;
  visit_id: string | null;
  order_id: string | null;
  owner_id: string;
  occurred_at: string;
  description: string;
  result: string | null;
  next_action: string | null;
  next_action_date: string | null;
  company_name: string | null;
  contact_name: string | null;
  owner_name: string | null;
}

export interface TaskRow extends Timestamps {
  id: string;
  company_id: string | null;
  contact_id: string | null;
  opportunity_id: string | null;
  owner_id: string;
  title: string;
  description: string | null;
  due_date: string;
  due_time: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  completed_at: string | null;
  company_name: string | null;
  contact_name: string | null;
  contact_whatsapp: string | null;
  contact_phone: string | null;
  opportunity_title: string | null;
  owner_name: string | null;
}

export interface OrderRow extends Timestamps {
  id: string;
  order_number: number;
  company_id: string;
  contact_id: string | null;
  opportunity_id: string | null;
  owner_id: string;
  order_date: string;
  status: OrderStatus;
  subtotal: Num;
  discount: Num;
  total: Num;
  invoice_number: string | null;
  invoiced_at: string | null;
  delivered_at: string | null;
  canceled_at: string | null;
  notes: string | null;
  company_name: string | null;
  city: string | null;
  state: string | null;
  contact_name: string | null;
  owner_name: string | null;
  total_quantity: Num;
  item_count: number;
  product_ids: string[];
  product_names: string[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: Num;
  unit_price: Num;
  subtotal: Num;
  products?: { name: string; sku: string; sales_unit: string; category: ProductCategory } | null;
}

export interface InvoicedSaleRow extends Timestamps {
  id: string;
  order_id: string;
  company_id: string;
  seller_id: string;
  invoice_number: string | null;
  invoiced_at: string;
  amount: Num;
  status: 'ativa' | 'cancelada';
  order_number: number;
  order_date: string;
  order_status: OrderStatus;
  company_name: string | null;
  city: string | null;
  state: string | null;
  seller_name: string | null;
  total_quantity: Num;
  product_ids: string[];
  categories: ProductCategory[];
  product_summary: string;
}

export interface AuditRow {
  id: number;
  table_name: string;
  record_id: string | null;
  action: string;
  actor_id: string | null;
  actor_name: string | null;
  company_id: string | null;
  company_label: string | null;
  changed_fields: string[] | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface DashboardKpis {
  revenue_period: number;
  revenue_previous_period: number;
  revenue_month: number;
  invoiced_orders: number;
  avg_ticket: number;
  volume_period: number;
  orders_period: number;
  active_clients: number;
  new_clients: number;
  total_clients: number;
  open_opportunities: number;
  open_value: number;
  hot_opportunities: number;
  visits_period: number;
  visits_month: number;
  overdue_tasks: number;
  today_tasks: number;
}

export interface BreakdownRow {
  key: string;
  label: string | null;
  revenue: Num;
  volume: Num;
  orders: number;
}

export interface MonthRow {
  month: string;
  revenue: Num;
  volume: Num;
  orders: number;
}

export interface FunnelRow {
  stage_key: string;
  name: string;
  stage_position: number;
  color: string;
  is_won: boolean;
  is_lost: boolean;
  opportunities: number;
  value: Num;
}

export interface FunnelHealth {
  total_open: number;
  potential_value: number;
  negotiation_value: number;
  hot_value: number;
  won_count: number;
  won_value: number;
  lost_count: number;
  lost_value: number;
  conversion_rate: number | null;
  stalled_count: number;
  stalled_value: number;
  without_next_action: number;
  stalled_days: number;
  avg_days_by_stage: Record<string, number>;
  avg_cycle_days: number | null;
}

export interface AlertRow {
  kind: string;
  severity: 'alta' | 'media';
  message: string;
  href: string;
  ref_id: string | null;
  total: number;
}

export interface SellerPerformanceRow {
  seller_id: string;
  seller_name: string;
  active: boolean;
  revenue: Num;
  previous_revenue: Num;
  growth_percent: Num | null;
  orders: number;
  avg_ticket: Num;
  volume: Num;
  visits: number;
  new_clients: number;
  active_clients: number;
  open_opportunities: number;
  open_value: Num;
  won: number;
  lost: number;
  conversion_rate: Num | null;
}

export interface SearchResult {
  kind: 'cliente' | 'comprador' | 'pedido' | 'produto' | 'vendedor';
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}
