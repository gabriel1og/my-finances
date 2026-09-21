'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidateFinance } from '@/lib/cache';
import type { AccountBalanceHistory, AccountKind } from '@/types/database.types';

export type AccountInput = {
  name: string;
  kind: AccountKind;
  institution: string | null;
  color: string;
  openingBalance: number;
};

type Result = { error: string | null };

const HISTORY_PAGE_SIZE = 30;

export type AccountBalanceHistoryResult = {
  entries: AccountBalanceHistory[];
  hasMore: boolean;
  error: string | null;
};

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

/**
 * Carrega uma página estável do histórico, da mudança mais recente para a mais antiga.
 * Exemplo: `getAccountBalanceHistory(accountId, lastSequenceNo)` busca a próxima página.
 */
export async function getAccountBalanceHistory(
  accountId: string,
  beforeSequence?: number,
): Promise<AccountBalanceHistoryResult> {
  if (!accountId) return { entries: [], hasMore: false, error: 'Conta inválida.' };
  if (
    beforeSequence !== undefined &&
    (!Number.isSafeInteger(beforeSequence) || beforeSequence < 1)
  ) {
    return { entries: [], hasMore: false, error: 'Página de histórico inválida.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { entries: [], hasMore: false, error: 'Sessão expirada.' };

  let query = supabase
    .from('account_balance_history')
    .select('*')
    .eq('account_id', accountId)
    .order('sequence_no', { ascending: false })
    .limit(HISTORY_PAGE_SIZE + 1);
  if (beforeSequence !== undefined) query = query.lt('sequence_no', beforeSequence);

  const { data, error } = await query;
  if (error) {
    console.error(
      JSON.stringify({ event: 'account_balance_history_load_failed', accountId, code: error.code }),
    );
    return {
      entries: [],
      hasMore: false,
      error: 'Não foi possível carregar o histórico agora.',
    };
  }

  const rows = (data ?? []) as AccountBalanceHistory[];
  return {
    entries: rows.slice(0, HISTORY_PAGE_SIZE),
    hasMore: rows.length > HISTORY_PAGE_SIZE,
    error: null,
  };
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
