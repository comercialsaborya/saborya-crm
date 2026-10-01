'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { actionError, actionOk, dbError, validationError, type ActionState } from '@/lib/actions';
import { activitySchema, formDataToObject, opportunitySchema, taskSchema, visitSchema } from '@/lib/validation';
import { localDateTimeToISO } from '@/lib/format';
import type { VisitResult } from '@/lib/constants';

type Supa = Awaited<ReturnType<typeof createClient>>;

const RESULT_TO_STAGE: Partial<Record<VisitResult, string>> = {
  interessado: 'interessado',
  negociacao: 'negociacao',
  pedido_realizado: 'pedido',
  perdido: 'perdido',
};

/** Avança a oportunidade conforme o resultado da visita (nunca retrocede). */
async function advanceOpportunity(supabase: Supa, opportunityId: string, result: VisitResult) {
  const target = RESULT_TO_STAGE[result] ?? 'visita_realizada';
  const { data: stages } = await supabase.from('pipeline_stages').select('key, position, is_won, is_lost');
  const { data: opp } = await supabase.from('opportunities').select('stage_key').eq('id', opportunityId).maybeSingle();
  if (!stages || !opp) return;
  const cur = stages.find((s) => s.key === opp.stage_key);
  const tgt = stages.find((s) => s.key === target);
  if (!cur || !tgt || cur.is_won || cur.is_lost) return;
  if (tgt.is_lost || tgt.position > cur.position) {
    await supabase.from('opportunities').update({ stage_key: target }).eq('id', opportunityId);
  }
}

// ------------------------------------------------------------------ Visitas
export async function saveVisit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const parsed = visitSchema.safeParse(formDataToObject(formData, ['product_ids']));
  if (!parsed.success) return validationError(parsed.error);
  const d = parsed.data;
  const supabase = await createClient();

  const hasLocation = d.latitude != null && d.longitude != null;
  const { data: visit, error } = await supabase
    .from('visits')
    .insert({
      company_id: d.company_id,
      contact_id: d.contact_id ?? null,
      opportunity_id: d.opportunity_id ?? null,
      visited_at: localDateTimeToISO(d.visit_date, d.visit_time),
      visit_type: d.visit_type,
      objective: d.objective ?? null,
      result: d.result,
      notes: d.notes ?? null,
      next_step: d.next_step ?? null,
      next_contact_date: d.next_contact_date ?? null,
      potential_value: d.potential_value ?? null,
      interest_level: d.interest_level ?? null,
      latitude: hasLocation ? d.latitude : null,
      longitude: hasLocation ? d.longitude : null,
      location_accuracy_m: hasLocation ? (d.location_accuracy_m ?? null) : null,
      location_captured_at: hasLocation ? (d.location_captured_at ?? new Date().toISOString()) : null,
    })
    .select('id')
    .single();
  if (error) return dbError(error);

  if (d.product_ids.length) {
    await supabase.from('visit_products').insert(d.product_ids.map((product_id) => ({ visit_id: visit.id, product_id })));
  }

  let opportunityId = d.opportunity_id ?? null;
  const positive = ['interessado', 'negociacao', 'pedido_realizado'].includes(d.result);
  if (!opportunityId && d.create_opportunity && positive) {
    const { data: company } = await supabase.from('companies').select('trade_name, legal_name').eq('id', d.company_id).single();
    const { data: opp, error: oErr } = await supabase
      .from('opportunities')
      .insert({
        company_id: d.company_id,
        contact_id: d.contact_id ?? null,
        title: `${company?.trade_name || company?.legal_name || 'Cliente'} — ${d.objective || 'nova oportunidade'}`.slice(0, 200),
        stage_key: RESULT_TO_STAGE[d.result] ?? 'visita_realizada',
        temperature: d.result === 'interessado' ? 'interessado' : 'quente',
        estimated_value: d.potential_value ?? 0,
        next_activity_date: d.next_contact_date ?? null,
        next_activity_note: d.next_step ?? null,
      })
      .select('id')
      .single();
    if (oErr) return dbError(oErr);
    opportunityId = opp.id;
    await supabase.from('visits').update({ opportunity_id: opp.id }).eq('id', visit.id);
  } else if (opportunityId) {
    await advanceOpportunity(supabase, opportunityId, d.result);
    if (d.next_contact_date) {
      await supabase
        .from('opportunities')
        .update({ next_activity_date: d.next_contact_date, next_activity_note: d.next_step ?? null })
        .eq('id', opportunityId);
    }
  }

  if (d.create_follow_up && d.next_contact_date) {
    await supabase.from('tasks').insert({
      company_id: d.company_id,
      contact_id: d.contact_id ?? null,
      opportunity_id: opportunityId,
      visit_id: visit.id,
      title: d.next_step || 'Retornar contato após visita',
      due_date: d.next_contact_date,
      priority: d.result === 'negociacao' || d.result === 'pedido_realizado' ? 'alta' : 'media',
      owner_id: session.userId,
    });
  }

  revalidatePath('/visitas');
  revalidatePath(`/clientes/${d.company_id}`);
  const next =
    d.result === 'pedido_realizado'
      ? `/pedidos/novo?cliente=${d.company_id}${opportunityId ? `&oportunidade=${opportunityId}` : ''}${d.contact_id ? `&comprador=${d.contact_id}` : ''}`
      : `/clientes/${d.company_id}`;
  return actionOk('Visita registrada.', next);
}

// ------------------------------------------------------------------ Atividades
export async function saveActivity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const parsed = activitySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from('activities').insert({
    type: d.type,
    company_id: d.company_id,
    contact_id: d.contact_id ?? null,
    opportunity_id: d.opportunity_id ?? null,
    occurred_at: localDateTimeToISO(d.activity_date, d.activity_time),
    description: d.description,
    result: d.result ?? null,
    next_action: d.next_action ?? null,
    next_action_date: d.next_action_date ?? null,
  });
  if (error) return dbError(error);
  if (d.create_follow_up && d.next_action_date) {
    await supabase.from('tasks').insert({
      company_id: d.company_id,
      contact_id: d.contact_id ?? null,
      opportunity_id: d.opportunity_id ?? null,
      title: d.next_action || 'Follow-up',
      due_date: d.next_action_date,
      priority: 'media',
      owner_id: session.userId,
    });
  }
  revalidatePath('/atividades');
  revalidatePath(`/clientes/${d.company_id}`);
  return actionOk('Atividade registrada.', `/clientes/${d.company_id}`);
}

// ------------------------------------------------------------------ Tarefas
export async function saveTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const parsed = taskSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { owner_id, ...d } = parsed.data;
  const id = formData.get('id')?.toString() || null;
  const supabase = await createClient();
  const payload: Record<string, unknown> = { ...d };
  if (session.isAdmin && owner_id) payload.owner_id = owner_id;
  const { error } = id
    ? await supabase.from('tasks').update(payload).eq('id', id)
    : await supabase.from('tasks').insert(payload);
  if (error) return dbError(error);
  revalidatePath('/tarefas');
  if (d.company_id) revalidatePath(`/clientes/${d.company_id}`);
  return actionOk(id ? 'Tarefa atualizada.' : 'Tarefa criada.');
}

export async function setTaskStatus(id: string, status: 'pendente' | 'concluida' | 'cancelada'): Promise<ActionState> {
  await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.from('tasks').update({ status }).eq('id', id);
  if (error) return dbError(error);
  revalidatePath('/tarefas');
  revalidatePath('/');
  return actionOk(status === 'concluida' ? 'Tarefa concluída.' : status === 'cancelada' ? 'Tarefa cancelada.' : 'Tarefa reaberta.');
}

export async function postponeTask(id: string, dueDate: string): Promise<ActionState> {
  await requireSession();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return actionError('Data inválida.');
  const supabase = await createClient();
  const { error } = await supabase.from('tasks').update({ due_date: dueDate }).eq('id', id);
  if (error) return dbError(error);
  revalidatePath('/tarefas');
  return actionOk('Tarefa reagendada.');
}

// ------------------------------------------------------------------ Oportunidades
export async function saveOpportunity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const parsed = opportunitySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { owner_id, ...d } = parsed.data;
  const id = formData.get('id')?.toString() || null;
  const supabase = await createClient();
  const payload: Record<string, unknown> = { ...d };
  if (session.isAdmin && owner_id) payload.owner_id = owner_id;
  if (id) {
    const { error } = await supabase.from('opportunities').update(payload).eq('id', id);
    if (error) return dbError(error);
    revalidatePath('/pipeline');
    revalidatePath(`/oportunidades/${id}`);
    return actionOk('Oportunidade atualizada.', id);
  }
  const { data, error } = await supabase.from('opportunities').insert(payload).select('id').single();
  if (error) return dbError(error);
  revalidatePath('/pipeline');
  revalidatePath(`/clientes/${d.company_id}`);
  return actionOk('Oportunidade criada.', data.id);
}

export async function moveOpportunity(id: string, stageKey: string, lostReason?: string): Promise<ActionState> {
  await requireSession();
  const parsed = z.object({ id: z.uuid(), stageKey: z.string().regex(/^[a-z_]+$/) }).safeParse({ id, stageKey });
  if (!parsed.success) return actionError('Etapa inválida.');
  const supabase = await createClient();
  const update: Record<string, unknown> = { stage_key: stageKey };
  if (lostReason) update.lost_reason = lostReason.slice(0, 500);
  const { error } = await supabase.from('opportunities').update(update).eq('id', id);
  if (error) return dbError(error);
  revalidatePath('/pipeline');
  return actionOk('Etapa atualizada.');
}

export async function archiveOpportunity(id: string): Promise<ActionState> {
  await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.from('opportunities').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) return dbError(error);
  revalidatePath('/pipeline');
  return actionOk('Oportunidade arquivada.');
}
