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
  /** Só para compra no cartão. 1 = à vista. */
  installments?: number;
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

/**
 * Divide o total em parcelas de centavos inteiros; a sobra vai para a
 * primeira, como fazem as operadoras. Garante que a soma das parcelas seja
 * exatamente o valor da compra.
 */
function splitInstallments(total: number, count: number): number[] {
  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, index) =>
    index === 0 ? (base + remainder) / 100 : base / 100,
  );
}

/** Mesmo dia nos meses seguintes, grampeado ao último dia do mês. */
function shiftMonths(iso: string, months: number): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  const target = new Date(year, month - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(
    Math.min(day, lastDay),
  ).padStart(2, '0')}`;
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

  const { error } = await supabase.from('transactions').insert(rows);

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

/** Remove todas as parcelas de uma compra de uma vez. */
export async function deleteInstallmentGroup(groupId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('transactions').delete().eq('installment_group', groupId);
  if (error) return { error: error.message };

  revalidateAll();
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

  revalidateAll();
  return { error: null };
}

/** Apaga os dois lados da transferência. */
export async function deleteTransfer(groupId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('transactions').delete().eq('transfer_group', groupId);
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
