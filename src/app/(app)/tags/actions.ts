'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type TagInput = { name: string; color: string };

type Result = { error: string | null };

function revalidateAll() {
  revalidatePath('/dashboard');
  revalidatePath('/transactions');
  revalidatePath('/reports');
  revalidatePath('/settings');
}

function validate(input: TagInput): string | null {
  if (!input.name.trim()) return 'Informe um nome.';
  if (input.name.trim().length > 30) return 'Nome muito longo (máx. 30).';
  if (!/^#[0-9a-fA-F]{6}$/.test(input.color)) return 'Cor inválida.';
  return null;
}

export async function createTag(input: TagInput): Promise<{ error: string | null; id?: string }> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sessão expirada.' };

  const { data, error } = await supabase
    .from('tags')
    .insert({ user_id: user.id, name: input.name.trim(), color: input.color })
    .select('id')
    .single();

  if (error) {
    return { error: error.code === '23505' ? 'Já existe uma tag com esse nome.' : error.message };
  }

  revalidateAll();
  return { error: null, id: data.id };
}

export async function updateTag(id: string, input: TagInput): Promise<Result> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase
    .from('tags')
    .update({ name: input.name.trim(), color: input.color })
    .eq('id', id);

  if (error) {
    return { error: error.code === '23505' ? 'Já existe uma tag com esse nome.' : error.message };
  }

  revalidateAll();
  return { error: null };
}

/**
 * Tag não tem arquivamento: diferente de categoria, ela não carrega histórico
 * de orçamento. Excluir remove os vínculos por cascade e as transações ficam
 * intactas — só perdem o rótulo.
 */
export async function deleteTag(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('tags').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidateAll();
  return { error: null };
}

/** Substitui o conjunto de tags de uma transação. */
export async function setTransactionTags(
  transactionId: string,
  tagIds: string[],
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sessão expirada.' };

  const { error: clearError } = await supabase
    .from('transaction_tags')
    .delete()
    .eq('transaction_id', transactionId);
  if (clearError) return { error: clearError.message };

  if (tagIds.length > 0) {
    const { error } = await supabase.from('transaction_tags').insert(
      tagIds.map((tagId) => ({
        transaction_id: transactionId,
        tag_id: tagId,
        user_id: user.id,
      })),
    );
    if (error) return { error: error.message };
  }

  revalidateAll();
  return { error: null };
}
