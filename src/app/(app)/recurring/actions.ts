'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { dayInMonth } from '@/lib/statements';
import type { PaymentMethod, SettlementKind, TransactionType } from '@/types/database.types';

export type RecurringInput = {
  description: string;
  amount: number;
  type: TransactionType;
  dayOfMonth: number;
  categoryId: string | null;
  settlement: SettlementKind;
  accountId: string | null;
  cardId: string | null;
  paymentMethod: PaymentMethod | null;
  startMonth: string;
  endMonth: string | null;
  tagIds: string[];
};

type Result = { error: string | null };

function revalidateAll() {
  revalidatePath('/dashboard');
  revalidatePath('/recurring');
  revalidatePath('/transactions');
  revalidatePath('/categories');
  revalidatePath('/reports');
  revalidatePath('/accounts');
  revalidatePath('/cards');
}

function validate(input: RecurringInput): string | null {
  if (!input.description.trim()) return 'Informe uma descrição.';
  if (input.description.trim().length > 120) return 'Descrição muito longa (máx. 120).';
  if (!Number.isFinite(input.amount) || input.amount <= 0) return 'Informe um valor maior que zero.';
  if (!Number.isInteger(input.dayOfMonth) || input.dayOfMonth < 1 || input.dayOfMonth > 31) {
    return 'Dia do mês deve estar entre 1 e 31.';
  }
  if (input.settlement === 'card') {
    if (input.type === 'income') return 'Receita não entra em fatura de cartão.';
    if (!input.cardId) return 'Escolha o cartão.';
  }
  if (input.endMonth && input.endMonth < input.startMonth) {
    return 'O fim precisa ser depois do início.';
  }
  return null;
}

function toRow(input: RecurringInput) {
  const onCard = input.type === 'expense' && input.settlement === 'card';
  return {
    description: input.description.trim(),
    amount: input.amount,
    type: input.type,
    day_of_month: input.dayOfMonth,
    category_id: input.categoryId,
    settlement: onCard ? ('card' as const) : ('account' as const),
    account_id: onCard ? null : input.accountId,
    card_id: onCard ? input.cardId : null,
    payment_method: onCard ? ('credit' as const) : input.paymentMethod,
    start_month: `${input.startMonth.slice(0, 7)}-01`,
    end_month: input.endMonth ? `${input.endMonth.slice(0, 7)}-01` : null,
  };
}

async function replaceTags(recurringId: string, tagIds: string[], userId: string) {
  const supabase = await createClient();

  const { error: clearError } = await supabase
    .from('recurring_tags')
    .delete()
    .eq('recurring_id', recurringId);
  if (clearError) return clearError.message;

  if (tagIds.length === 0) return null;

  const { error } = await supabase.from('recurring_tags').insert(
    tagIds.map((tagId) => ({ recurring_id: recurringId, tag_id: tagId, user_id: userId })),
  );
  return error?.message ?? null;
}

export async function createRecurring(input: RecurringInput): Promise<Result> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sessão expirada.' };

  const { data, error } = await supabase
    .from('recurring_transactions')
    .insert({ ...toRow(input), user_id: user.id })
    .select('id')
    .single();

  if (error) return { error: error.message };

  const tagError = await replaceTags(data.id, input.tagIds, user.id);
  if (tagError) return { error: tagError };

  revalidateAll();
  return { error: null };
}

export async function updateRecurring(id: string, input: RecurringInput): Promise<Result> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sessão expirada.' };

  const { error } = await supabase
    .from('recurring_transactions')
    .update(toRow(input))
    .eq('id', id);

  if (error) return { error: error.message };

  const tagError = await replaceTags(id, input.tagIds, user.id);
  if (tagError) return { error: tagError };

  revalidateAll();
  return { error: null };
}

/** Pausar em vez de excluir: o modelo volta quando a despesa voltar. */
export async function setRecurringActive(id: string, isActive: boolean): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('recurring_transactions')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidateAll();
  return { error: null };
}

/**
 * Excluir o modelo não apaga o que ele já gerou: a FK em transactions é
 * `on delete set null`, então o histórico continua de pé, só perde o vínculo.
 */
export async function deleteRecurring(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('recurring_transactions').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidateAll();
  return { error: null };
}

/**
 * Gera o lançamento do mês a partir do modelo. Nunca é automático: só roda
 * quando o usuário confirma. O valor vem editável porque conta de luz não
 * repete o mesmo número todo mês.
 */
export async function postRecurring(input: {
  recurringId: string;
  month: string;
  amount?: number;
  date?: string;
}): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sessão expirada.' };

  const { data: model, error: modelError } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('id', input.recurringId)
    .single();

  if (modelError || !model) return { error: modelError?.message ?? 'Modelo não encontrado.' };

  const recurringMonth = `${input.month.slice(0, 7)}-01`;
  const amount = input.amount ?? Number(model.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Informe um valor maior que zero.' };

  // O dia é grampeado ao último dia do mês: dia 31 vira 28 em fevereiro.
  const date = input.date ?? dayInMonth(recurringMonth, model.day_of_month);

  const { data: tags, error: tagsError } = await supabase
    .from('recurring_tags')
    .select('tag_id')
    .eq('recurring_id', model.id);
  if (tagsError) return { error: tagsError.message };

  const { data: inserted, error } = await supabase
    .from('transactions')
    .insert({
      user_id: user.id,
      type: model.type,
      description: model.description,
      amount,
      date,
      category_id: model.category_id,
      settlement: model.settlement,
      account_id: model.account_id,
      card_id: model.card_id,
      payment_method: model.payment_method,
      recurring_id: model.id,
      recurring_month: recurringMonth,
    })
    .select('id')
    .single();

  if (error) {
    // 23505 = o unique (recurring_id, recurring_month). Clicar duas vezes não
    // duplica a despesa; a segunda tentativa só informa.
    return {
      error:
        error.code === '23505'
          ? 'Este fixo já foi lançado neste mês.'
          : error.message,
    };
  }

  if (tags?.length) {
    const { error: linkError } = await supabase.from('transaction_tags').insert(
      tags.map((row) => ({
        transaction_id: inserted.id,
        tag_id: row.tag_id,
        user_id: user.id,
      })),
    );
    if (linkError) return { error: linkError.message };
  }

  revalidateAll();
  return { error: null };
}
