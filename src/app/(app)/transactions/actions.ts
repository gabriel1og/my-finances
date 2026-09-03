'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidateFinance } from '@/lib/cache';
import { shiftMonths, splitInstallments } from '@/lib/installments';
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
  /** Só para compra no cartão. 1 = à vista. */
  installments?: number;
  tagIds?: string[];
};

type Result = { error: string | null };

function validate(input: TransactionInput): string | null {
  if (!input.description.trim()) return 'Informe uma descrição.';
  if (input.description.trim().length > 120) return 'Descrição muito longa (máx. 120).';
  if (!Number.isFinite(input.amount) || input.amount <= 0)
    return 'Informe um valor maior que zero.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return 'Data inválida.';
  if (input.settlement === 'card') {
    if (input.type === 'income') return 'Receita não entra em fatura de cartão.';
    if (!input.cardId) return 'Escolha o cartão.';
  }

  const installments = input.installments ?? 1;
  if (!Number.isInteger(installments) || installments < 1 || installments > 72) {
    return 'Número de parcelas deve estar entre 1 e 72.';
  }
  if (installments > 1) {
    if (input.settlement !== 'card') return 'Parcelamento só existe em compra no cartão.';
    if (input.amount / installments < 0.01) {
      return 'Valor baixo demais para esse número de parcelas.';
    }
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

  const installments = input.installments ?? 1;
  const description = input.description.trim();
  const base = {
    user_id: user.id,
    type: input.type,
    category_id: input.categoryId,
    settlement: input.settlement,
    account_id: input.settlement === 'card' ? null : input.accountId,
    card_id: input.settlement === 'card' ? input.cardId : null,
    payment_method: input.paymentMethod,
  };

  // Cada parcela é uma transação com data própria, então cai sozinha na
  // fatura certa pelo statement_month().
  const groupId = crypto.randomUUID();
  const rows =
    installments > 1
      ? splitInstallments(input.amount, installments).map((amount, index) => ({
          ...base,
          description: `${description} (${index + 1}/${installments})`,
          amount,
          date: shiftMonths(input.date, index),
          installment_group: groupId,
          installment_no: index + 1,
          installment_total: installments,
        }))
      : [{ ...base, description, amount: input.amount, date: input.date }];

  const { data: inserted, error } = await supabase.from('transactions').insert(rows).select('id');

  if (error) return { error: error.message };

  // Numa compra parcelada, as tags valem para todas as parcelas: é a mesma
  // compra vista em pedaços.
  const tagIds = input.tagIds ?? [];
  if (tagIds.length > 0 && inserted?.length) {
    const { error: tagError } = await supabase.from('transaction_tags').insert(
      inserted.flatMap((row) =>
        tagIds.map((tagId) => ({
          transaction_id: row.id,
          tag_id: tagId,
          user_id: user.id,
        })),
      ),
    );
    if (tagError) return { error: tagError.message };
  }

  revalidateFinance();
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

  if (input.tagIds) {
    const { error: clearError } = await supabase
      .from('transaction_tags')
      .delete()
      .eq('transaction_id', id);
    if (clearError) return { error: clearError.message };

    if (input.tagIds.length > 0) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { error: 'Sessão expirada.' };

      const { error: tagError } = await supabase.from('transaction_tags').insert(
        input.tagIds.map((tagId) => ({
          transaction_id: id,
          tag_id: tagId,
          user_id: user.id,
        })),
      );
      if (tagError) return { error: tagError.message };
    }
  }

  revalidateFinance();
  return { error: null };
}

/** Remove todas as parcelas de uma compra de uma vez. */
export async function deleteInstallmentGroup(groupId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('transactions').delete().eq('installment_group', groupId);
  if (error) return { error: error.message };

  revalidateFinance();
  return { error: null };
}

export type TransferInput = {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  description: string;
};

/**
 * Transferência entre contas: duas linhas irmãs ligadas por transfer_group.
 * Não é receita nem despesa — as views de KPI ignoram is_transfer.
 */
export async function createTransfer(input: TransferInput): Promise<Result> {
  if (!input.fromAccountId || !input.toAccountId) return { error: 'Escolha as duas contas.' };
  if (input.fromAccountId === input.toAccountId) {
    return { error: 'Origem e destino precisam ser contas diferentes.' };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { error: 'Informe um valor maior que zero.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: 'Data inválida.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sessão expirada.' };

  const { data: accounts, error: accountsError } = await supabase
    .from('accounts')
    .select('id, name')
    .in('id', [input.fromAccountId, input.toAccountId]);

  if (accountsError) return { error: accountsError.message };
  if ((accounts ?? []).length !== 2) return { error: 'Conta não encontrada.' };

  const from = accounts!.find((account) => account.id === input.fromAccountId)!;
  const to = accounts!.find((account) => account.id === input.toAccountId)!;
  const label = input.description.trim() || `Transferência ${from.name} → ${to.name}`;
  const groupId = crypto.randomUUID();

  const shared = {
    user_id: user.id,
    amount: input.amount,
    date: input.date,
    description: label,
    settlement: 'account' as const,
    payment_method: 'transfer' as const,
    category_id: null,
    is_transfer: true,
    transfer_group: groupId,
  };

  const { error } = await supabase.from('transactions').insert([
    { ...shared, type: 'expense' as const, account_id: input.fromAccountId },
    { ...shared, type: 'income' as const, account_id: input.toAccountId },
  ]);

  if (error) return { error: error.message };

  revalidateFinance();
  return { error: null };
}

/**
 * Edita as duas pontas de uma vez. A ponta de despesa carrega a conta de
 * origem e a de receita, a de destino — trocar as contas é reescrever esses
 * dois account_id, não criar linhas novas.
 */
export async function updateTransfer(groupId: string, input: TransferInput): Promise<Result> {
  if (!input.fromAccountId || !input.toAccountId) return { error: 'Escolha as duas contas.' };
  if (input.fromAccountId === input.toAccountId) {
    return { error: 'Origem e destino precisam ser contas diferentes.' };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { error: 'Informe um valor maior que zero.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: 'Data inválida.' };

  const supabase = await createClient();

  const { data: rows, error: rowsError } = await supabase
    .from('transactions')
    .select('id, type')
    .eq('transfer_group', groupId);

  if (rowsError) return { error: rowsError.message };

  const outgoing = (rows ?? []).find((row) => row.type === 'expense');
  const incoming = (rows ?? []).find((row) => row.type === 'income');
  if (!outgoing || !incoming) {
    return { error: 'Transferência incompleta. Exclua e registre de novo.' };
  }

  const { data: accounts, error: accountsError } = await supabase
    .from('accounts')
    .select('id, name')
    .in('id', [input.fromAccountId, input.toAccountId]);

  if (accountsError) return { error: accountsError.message };
  if ((accounts ?? []).length !== 2) return { error: 'Conta não encontrada.' };

  const from = accounts!.find((account) => account.id === input.fromAccountId)!;
  const to = accounts!.find((account) => account.id === input.toAccountId)!;
  const label = input.description.trim() || `Transferência ${from.name} → ${to.name}`;

  const shared = { amount: input.amount, date: input.date, description: label };

  const { error: outError } = await supabase
    .from('transactions')
    .update({ ...shared, account_id: input.fromAccountId })
    .eq('id', outgoing.id);
  if (outError) return { error: outError.message };

  const { error: inError } = await supabase
    .from('transactions')
    .update({ ...shared, account_id: input.toAccountId })
    .eq('id', incoming.id);
  if (inError) return { error: inError.message };

  revalidateFinance();
  return { error: null };
}

/** Apaga os dois lados da transferência. */
export async function deleteTransfer(groupId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('transactions').delete().eq('transfer_group', groupId);
  if (error) return { error: error.message };

  revalidateFinance();
  return { error: null };
}

export async function deleteTransaction(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidateFinance();
  return { error: null };
}
