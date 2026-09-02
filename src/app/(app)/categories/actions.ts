'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { TransactionType } from '@/types/database.types';

export type CategoryInput = {
  name: string;
  color: string;
  kind: TransactionType;
  budget: number;
};

type Result = { error: string | null };

function revalidateAll() {
  revalidatePath('/dashboard');
  revalidatePath('/categories');
  revalidatePath('/transactions');
  revalidatePath('/reports');
}

function validate(input: CategoryInput): string | null {
  if (!input.name.trim()) return 'Informe um nome.';
  if (input.name.trim().length > 40) return 'Nome muito longo (máx. 40).';
  if (!/^#[0-9a-fA-F]{6}$/.test(input.color)) return 'Cor inválida.';
  if (!Number.isFinite(input.budget) || input.budget < 0) return 'Limite inválido.';
  return null;
}

export async function createCategory(input: CategoryInput): Promise<Result> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sessão expirada.' };

  const { data: last } = await supabase
    .from('categories')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('categories').insert({
    user_id: user.id,
    name: input.name.trim(),
    color: input.color,
    kind: input.kind,
    budget: input.budget,
    position: (last?.position ?? 0) + 1,
  });

  if (error) {
    return {
      error: error.code === '23505' ? 'Já existe uma categoria com esse nome.' : error.message,
    };
  }

  revalidateAll();
  return { error: null };
}

export async function updateCategory(id: string, input: CategoryInput): Promise<Result> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase
    .from('categories')
    .update({
      name: input.name.trim(),
      color: input.color,
      kind: input.kind,
      budget: input.budget,
    })
    .eq('id', id);

  if (error) {
    return {
      error: error.code === '23505' ? 'Já existe uma categoria com esse nome.' : error.message,
    };
  }

  revalidateAll();
  return { error: null };
}

/** Arquiva em vez de excluir: preserva o histórico das transações já lançadas. */
export async function archiveCategory(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('categories').update({ is_archived: true }).eq('id', id);
  if (error) return { error: error.message };

  revalidateAll();
  return { error: null };
}

export async function restoreCategory(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('categories').update({ is_archived: false }).eq('id', id);
  if (error) return { error: error.message };

  revalidateAll();
  return { error: null };
}

/** Exclui de vez — só permitido quando não há transação vinculada. */
export async function deleteCategory(id: string): Promise<Result> {
  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id);

  if (countError) return { error: countError.message };
  if ((count ?? 0) > 0) {
    return { error: `Categoria com ${count} lançamento(s). Arquive-a em vez de excluir.` };
  }

  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidateAll();
  return { error: null };
}

/**
 * Liga/desliga o rollover. Ao ligar, o acúmulo começa no mês informado — sem
 * isso, ligar hoje traria de volta todo o histórico que o usuário nunca orçou
 * com essa regra.
 */
export async function setCategoryRollover(
  id: string,
  enabled: boolean,
  sinceMonth: string,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('categories')
    .update({
      rollover_enabled: enabled,
      // A constraint exige `since` preenchido quando ligado; ao desligar,
      // manter a data preservaria a referência para quando religar.
      rollover_since: enabled ? `${sinceMonth.slice(0, 7)}-01` : null,
    })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidateAll();
  return { error: null };
}

/** Limite específico de um mês (sobrescreve categories.budget na view). */
export async function setMonthlyBudget(
  categoryId: string,
  month: string,
  amount: number,
): Promise<Result> {
  if (!Number.isFinite(amount) || amount < 0) return { error: 'Limite inválido.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sessão expirada.' };

  const { error } = await supabase.from('budgets').upsert(
    {
      user_id: user.id,
      category_id: categoryId,
      month: `${month.slice(0, 7)}-01`,
      amount,
    },
    { onConflict: 'user_id,category_id,month' },
  );

  if (error) return { error: error.message };

  revalidateAll();
  return { error: null };
}

export async function clearMonthlyBudget(categoryId: string, month: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('category_id', categoryId)
    .eq('month', `${month.slice(0, 7)}-01`);

  if (error) return { error: error.message };

  revalidateAll();
  return { error: null };
}
