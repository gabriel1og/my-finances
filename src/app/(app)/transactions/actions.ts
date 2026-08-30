'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { PaymentMethod, SettlementKind, TransactionType } from '@/types/database.types';

export type TransactionInput = {
  type: TransactionType;
  description: string;
  amount: number;
  date: string;
  categoryId: string | null;
  settlement: SettlementKind;
  accountId: string | null;
  cardId: string | null;
  paymentMethod: PaymentMethod | null;
};

type Result = { error: string | null };

function revalidateAll() {
  revalidatePath('/dashboard');
  revalidatePath('/transactions');
  revalidatePath('/categories');
  revalidatePath('/reports');
  revalidatePath('/accounts');
  revalidatePath('/cards');
}

function validate(input: TransactionInput): string | null {
  if (!input.description.trim()) return 'Informe uma descrição.';
  if (input.description.trim().length > 120) return 'Descrição muito longa (máx. 120).';
  if (!Number.isFinite(input.amount) || input.amount <= 0) return 'Informe um valor maior que zero.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return 'Data inválida.';
  if (input.settlement === 'card') {
    if (input.type === 'income') return 'Receita não entra em fatura de cartão.';
    if (!input.cardId) return 'Escolha o cartão.';
  }
  return null;
}

export async function createTransaction(input: TransactionInput): Promise<Result> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sessão expirada.' };

  const { error } = await supabase.from('transactions').insert({
    user_id: user.id,
    type: input.type,
    description: input.description.trim(),
    amount: input.amount,
    date: input.date,
    category_id: input.categoryId,
    settlement: input.settlement,
    account_id: input.settlement === 'card' ? null : input.accountId,
    card_id: input.settlement === 'card' ? input.cardId : null,
    payment_method: input.paymentMethod,
  });

  if (error) return { error: error.message };

  revalidateAll();
  return { error: null };
}

export async function updateTransaction(id: string, input: TransactionInput): Promise<Result> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase
    .from('transactions')
    .update({
      type: input.type,
      description: input.description.trim(),
      amount: input.amount,
      date: input.date,
      category_id: input.categoryId,
      settlement: input.settlement,
      account_id: input.settlement === 'card' ? null : input.accountId,
      card_id: input.settlement === 'card' ? input.cardId : null,
      payment_method: input.paymentMethod,
    })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidateAll();
  return { error: null };
}

export async function deleteTransaction(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidateAll();
  return { error: null };
}
