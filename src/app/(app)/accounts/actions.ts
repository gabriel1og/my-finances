'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidateFinance } from '@/lib/cache';
import type { AccountKind } from '@/types/database.types';

export type AccountInput = {
  name: string;
  kind: AccountKind;
  institution: string | null;
  color: string;
  openingBalance: number;
};

type Result = { error: string | null };

function validate(input: AccountInput): string | null {
  if (!input.name.trim()) return 'Informe um nome.';
  if (input.name.trim().length > 40) return 'Nome muito longo (máx. 40).';
  if (!/^#[0-9a-fA-F]{6}$/.test(input.color)) return 'Cor inválida.';
  if (!Number.isFinite(input.openingBalance)) return 'Saldo inicial inválido.';
  return null;
}

export async function createAccount(input: AccountInput): Promise<Result> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sessão expirada.' };

  const { data: last } = await supabase
    .from('accounts')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('accounts').insert({
    user_id: user.id,
    name: input.name.trim(),
    kind: input.kind,
    institution: input.institution?.trim() || null,
    color: input.color,
    opening_balance: input.openingBalance,
    position: (last?.position ?? 0) + 1,
  });

  if (error) {
    return { error: error.code === '23505' ? 'Já existe uma conta com esse nome.' : error.message };
  }

  revalidateFinance();
  return { error: null };
}

export async function updateAccount(id: string, input: AccountInput): Promise<Result> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase
    .from('accounts')
    .update({
      name: input.name.trim(),
      kind: input.kind,
      institution: input.institution?.trim() || null,
      color: input.color,
      opening_balance: input.openingBalance,
    })
    .eq('id', id);

  if (error) {
    return { error: error.code === '23505' ? 'Já existe uma conta com esse nome.' : error.message };
  }

  revalidateFinance();
  return { error: null };
}

export async function archiveAccount(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('accounts').update({ is_archived: true }).eq('id', id);
  if (error) return { error: error.message };

  revalidateFinance();
  return { error: null };
}

export async function restoreAccount(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('accounts').update({ is_archived: false }).eq('id', id);
  if (error) return { error: error.message };

  revalidateFinance();
  return { error: null };
}

/** Só exclui conta sem transações e sem cartão vinculado. */
export async function deleteAccount(id: string): Promise<Result> {
  const supabase = await createClient();

  const { count: txCount, error: txError } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', id);
  if (txError) return { error: txError.message };
  if ((txCount ?? 0) > 0) {
    return { error: `Conta com ${txCount} lançamento(s). Arquive-a em vez de excluir.` };
  }

  const { count: cardCount, error: cardError } = await supabase
    .from('credit_cards')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', id);
  if (cardError) return { error: cardError.message };
  if ((cardCount ?? 0) > 0) {
    return { error: 'Existe cartão vinculado a esta conta.' };
  }

  const { error } = await supabase.from('accounts').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidateFinance();
  return { error: null };
}
