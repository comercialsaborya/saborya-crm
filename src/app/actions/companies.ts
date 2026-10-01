'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth';
import { actionError, actionOk, dbError, validationError, type ActionState } from '@/lib/actions';
import { companySchema, contactSchema, formDataToObject } from '@/lib/validation';
import type { Temperature } from '@/lib/constants';

export async function saveCompany(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const parsed = companySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const id = formData.get('id')?.toString() || null;
  const { owner_id, ...data } = parsed.data;
  const supabase = await createClient();

  const payload: Record<string, unknown> = { ...data };
  // Só o gestor escolhe/transfere o responsável.
  if (session.isAdmin && owner_id) payload.owner_id = owner_id;

  if (id) {
    const { error } = await supabase.from('companies').update(payload).eq('id', id);
    if (error) return dbError(error);
    revalidatePath(`/clientes/${id}`);
    revalidatePath('/clientes');
    return actionOk('Cliente atualizado.', id);
  }
  const { data: created, error } = await supabase.from('companies').insert(payload).select('id').single();
  if (error) return dbError(error);
  revalidatePath('/clientes');
  return actionOk('Cliente cadastrado.', created.id);
}

export async function setCompanyStatus(companyId: string, status: Temperature): Promise<ActionState> {
  await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.from('companies').update({ status }).eq('id', companyId);
  if (error) return dbError(error);
  revalidatePath(`/clientes/${companyId}`);
  return actionOk('Status atualizado.');
}

export async function archiveCompany(companyId: string): Promise<ActionState> {
  const session = await requireSession();
  if (!session.isAdmin) return actionError('Apenas o gestor pode arquivar clientes.');
  const supabase = await createClient();
  const { error } = await supabase.from('companies').update({ deleted_at: new Date().toISOString() }).eq('id', companyId);
  if (error) return dbError(error);
  revalidatePath('/clientes');
  return actionOk('Cliente arquivado.');
}

export async function saveContact(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const parsed = contactSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const id = formData.get('id')?.toString() || null;
  const supabase = await createClient();

  if (parsed.data.is_primary) {
    await supabase
      .from('contacts')
      .update({ is_primary: false })
      .eq('company_id', parsed.data.company_id)
      .neq('id', id ?? '00000000-0000-0000-0000-000000000000');
  }

  if (id) {
    const { error } = await supabase.from('contacts').update(parsed.data).eq('id', id);
    if (error) return dbError(error);
    revalidatePath(`/clientes/${parsed.data.company_id}`);
    revalidatePath('/contatos');
    return actionOk('Comprador atualizado.', id);
  }
  const { data, error } = await supabase.from('contacts').insert(parsed.data).select('id').single();
  if (error) return dbError(error);
  revalidatePath(`/clientes/${parsed.data.company_id}`);
  revalidatePath('/contatos');
  return actionOk('Comprador cadastrado.', data.id);
}

export async function archiveContact(contactId: string): Promise<ActionState> {
  await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.from('contacts').update({ deleted_at: new Date().toISOString() }).eq('id', contactId);
  if (error) return dbError(error);
  revalidatePath('/contatos');
  return actionOk('Comprador removido.');
}
