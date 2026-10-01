'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin, requireSession } from '@/lib/auth';
import { actionError, actionOk, dbError, validationError, type ActionState } from '@/lib/actions';
import {
  formDataToObject,
  organizationSchema,
  productSchema,
  profileUpdateSchema,
  sellerCreateSchema,
} from '@/lib/validation';
import { z } from 'zod';

// ---------------------------------------------------------------- Produtos
export async function saveProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = productSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const id = formData.get('id')?.toString() || null;
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from('products').update(parsed.data).eq('id', id)
    : await supabase.from('products').insert(parsed.data);
  if (error) return dbError(error);
  revalidatePath('/produtos');
  return actionOk(id ? 'Produto atualizado.' : 'Produto cadastrado.');
}

// ---------------------------------------------------------------- Equipe
export async function createSeller(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdmin();
  const parsed = sellerCreateSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const d = parsed.data;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return actionError('Configure SUPABASE_SERVICE_ROLE_KEY no servidor para cadastrar usuários.');
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: d.email,
    password: d.password,
    email_confirm: true,
    user_metadata: { full_name: d.full_name, phone: d.phone ?? undefined },
    app_metadata: { role: d.role, organization_id: session.profile.organization_id },
  });
  if (error) {
    if (error.message.toLowerCase().includes('already')) return actionError('Já existe um usuário com este e-mail.', { email: ['E-mail já cadastrado.'] });
    return actionError(`Não foi possível criar o usuário: ${error.message}`);
  }
  const supabase = await createClient();
  const { error: pErr } = await supabase.from('profiles').update({ phone: d.phone ?? null }).eq('id', data.user.id);
  if (pErr) return dbError(pErr);
  revalidatePath('/equipe');
  return actionOk(`${d.full_name} cadastrado. Envie o e-mail e a senha provisória para o primeiro acesso.`);
}

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = profileUpdateSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const id = z.uuid().safeParse(formData.get('id'));
  if (!id.success) return actionError('Usuário inválido.');
  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update(parsed.data).eq('id', id.data);
  if (error) return dbError(error);

  // Bloqueia/desbloqueia o login no Auth junto com o status.
  try {
    const admin = createAdminClient();
    await admin.auth.admin.updateUserById(id.data, { ban_duration: parsed.data.active ? 'none' : '876000h' });
  } catch {
    // Sem service role: o perfil inativo já é barrado pelo app e pelo RLS.
  }
  revalidatePath('/equipe');
  return actionOk('Usuário atualizado.');
}

export async function transferClients(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z
    .object({ from: z.uuid('Selecione o vendedor de origem.'), to: z.uuid('Selecione o vendedor de destino.') })
    .refine((d) => d.from !== d.to, { message: 'Escolha vendedores diferentes.', path: ['to'] })
    .safeParse({ from: formData.get('from'), to: formData.get('to') });
  if (!parsed.success) return validationError(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('companies')
    .update({ owner_id: parsed.data.to })
    .eq('owner_id', parsed.data.from)
    .is('deleted_at', null)
    .select('id');
  if (error) return dbError(error);
  // Oportunidades e tarefas abertas acompanham o cliente.
  const ids = (data ?? []).map((c) => c.id);
  if (ids.length) {
    await supabase.from('opportunities').update({ owner_id: parsed.data.to }).in('company_id', ids).is('closed_at', null);
    await supabase.from('tasks').update({ owner_id: parsed.data.to }).in('company_id', ids).eq('status', 'pendente');
  }
  revalidatePath('/equipe');
  return actionOk(`${ids.length} cliente(s) transferido(s).`);
}

// ---------------------------------------------------------------- Configurações
export async function saveOrganization(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdmin();
  const parsed = organizationSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from('organizations').update(parsed.data).eq('id', session.profile.organization_id);
  if (error) return dbError(error);
  revalidatePath('/', 'layout');
  return actionOk('Configurações salvas.');
}

export async function saveMyProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const parsed = z
    .object({
      full_name: z.string().trim().min(1, 'Informe seu nome.').max(120),
      phone: z.string().trim().max(30).optional(),
    })
    .safeParse({ full_name: formData.get('full_name'), phone: formData.get('phone') ?? undefined });
  if (!parsed.success) return validationError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data.full_name, phone: parsed.data.phone || null })
    .eq('id', session.userId);
  if (error) return dbError(error);
  revalidatePath('/', 'layout');
  return actionOk('Perfil atualizado.');
}

export async function changeMyPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const parsed = z
    .object({ password: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres.'), confirm: z.string() })
    .refine((d) => d.password === d.confirm, { message: 'As senhas não conferem.', path: ['confirm'] })
    .safeParse({ password: formData.get('password'), confirm: formData.get('confirm') });
  if (!parsed.success) return validationError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return actionError('Não foi possível alterar a senha.');
  return actionOk('Senha alterada.');
}
