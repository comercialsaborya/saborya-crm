import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { PickerOption } from '@/components/ui/picker';
import type { PipelineStage, Product } from '@/types/db';

/** Listas de apoio para formulários e filtros (RLS aplica o escopo). */
export const getCompanyOptions = cache(async (): Promise<PickerOption[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('companies')
    .select('id, legal_name, trade_name, city, state')
    .is('deleted_at', null)
    .order('trade_name', { ascending: true, nullsFirst: false })
    .limit(2000);
  return (data ?? []).map((c) => ({
    value: c.id,
    label: c.trade_name || c.legal_name,
    description: [c.trade_name ? c.legal_name : null, c.city && `${c.city}${c.state ? `/${c.state}` : ''}`]
      .filter(Boolean)
      .join(' · '),
  }));
});

export type ContactOption = PickerOption & { company_id: string; whatsapp: string | null; phone: string | null };

export const getContactOptions = cache(async (): Promise<ContactOption[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('contacts')
    .select('id, name, job_title, company_id, whatsapp, phone')
    .is('deleted_at', null)
    .order('name')
    .limit(5000);
  return (data ?? []).map((c) => ({
    value: c.id,
    label: c.name,
    description: c.job_title,
    company_id: c.company_id,
    whatsapp: c.whatsapp,
    phone: c.phone,
  }));
});

export type OpportunityOption = PickerOption & { company_id: string };

export const getOpenOpportunityOptions = cache(async (): Promise<OpportunityOption[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('opportunity_board')
    .select('id, title, company_id, stage_name, is_won, is_lost')
    .is('deleted_at', null)
    .eq('is_won', false)
    .eq('is_lost', false)
    .order('updated_at', { ascending: false })
    .limit(1000);
  return (data ?? []).map((o) => ({ value: o.id, label: o.title, description: o.stage_name, company_id: o.company_id }));
});

export const getProducts = cache(async (onlyActive = true): Promise<Product[]> => {
  const supabase = await createClient();
  let q = supabase.from('products').select('*').order('category').order('name');
  if (onlyActive) q = q.eq('active', true);
  const { data } = await q;
  return (data as Product[]) ?? [];
});

export const getStages = cache(async (): Promise<PipelineStage[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from('pipeline_stages').select('*').eq('active', true).order('position');
  return (data as PipelineStage[]) ?? [];
});

/** Vendedores (somente para o gestor; para vendedor retorna apenas ele mesmo). */
export const getSellerOptions = cache(async (): Promise<PickerOption[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('id, full_name, role, active').order('full_name');
  return (data ?? []).map((p) => ({
    value: p.id,
    label: p.full_name || '—',
    description: `${p.role === 'admin' ? 'Gestor' : 'Vendedor'}${p.active ? '' : ' · inativo'}`,
  }));
});

export function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Termo seguro para filtros .or() do PostgREST (remove caracteres de sintaxe). */
export function searchTerm(q: string | undefined): string | null {
  const t = (q ?? '').replace(/[,()*%\\:"']/g, ' ').trim();
  return t.length >= 1 ? t : null;
}
