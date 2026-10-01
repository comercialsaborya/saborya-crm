import 'server-only';
import type { PostgrestError } from '@supabase/supabase-js';
import type { ZodError } from 'zod';
import { zodFieldErrors, type FieldErrors } from './validation';

export type ActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: FieldErrors;
  id?: string;
  /** Incrementa a cada envio para que a UI possa reagir mesmo com o mesmo resultado. */
  at?: number;
};

export const actionOk = (message?: string, id?: string): ActionState => ({ ok: true, message, id, at: Date.now() });

export const actionError = (error: string, fieldErrors?: FieldErrors): ActionState => ({
  ok: false,
  error,
  fieldErrors,
  at: Date.now(),
});

export const validationError = (e: ZodError): ActionState =>
  actionError('Revise os campos destacados.', zodFieldErrors(e));

/** Traduz erros do Postgres/Supabase para mensagens claras. */
export function dbError(error: PostgrestError | { message: string; code?: string } | null): ActionState {
  if (!error) return actionError('Erro desconhecido.');
  const msg = error.message ?? '';
  const code = 'code' in error ? error.code : undefined;
  if (code === '23505') {
    if (msg.includes('cnpj')) return actionError('Já existe um cliente com este CNPJ.', { cnpj: ['CNPJ já cadastrado.'] });
    if (msg.includes('sku')) return actionError('Já existe um produto com este SKU.', { sku: ['SKU já cadastrado.'] });
    return actionError('Registro duplicado.');
  }
  if (code === '42501' || msg.includes('row-level security')) {
    // Mensagens de regra de negócio vêm em português dos triggers.
    if (/[áéíóúãçê]/i.test(msg) || msg.startsWith('Apenas') || msg.startsWith('Vendedor')) return actionError(msg);
    return actionError('Você não tem permissão para esta ação.');
  }
  if (code === '23503') return actionError('Registro relacionado não encontrado.');
  if (code === '23514') return actionError('Algum valor está fora do permitido.');
  if (code === 'P0001') return actionError(msg);
  console.error('[db]', code, msg);
  return actionError('Não foi possível salvar. Tente novamente.');
}
