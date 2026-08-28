'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { TransactionType } from '@/types/database.types';

export type TransactionInput = {
  type: TransactionType;
  description: string;
  amount: number;
  date: string;
  categoryId: string | null;
};

export async function createTransaction(input: TransactionInput) {
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
  });

  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  revalidatePath('/transactions');
  revalidatePath('/categories');
  return { error: null };
}

export async function deleteTransaction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/dashboard');
  revalidatePath('/transactions');
  revalidatePath('/categories');
  return { error: null };
}
