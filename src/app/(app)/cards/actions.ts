'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type CardInput = {
  name: string;
  accountId: string;
  brand: string | null;
  color: string;
  creditLimit: number;
  closingDay: number;
  dueDay: number;
};

type Result = { error: string | null };

function revalidateAll() {
  revalidatePath('/dashboard');
  revalidatePath('/accounts');
  revalidatePath('/cards');
  revalidatePath('/transactions');
}

function validate(input: CardInput): string | null {
  if (!input.name.trim()) return 'Informe um nome.';
  if (input.name.trim().length > 40) return 'Nome muito longo (máx. 40).';
  if (!input.accountId) return 'Escolha a conta que paga a fatura.';
  if (!/^#[0-9a-fA-F]{6}$/.test(input.color)) return 'Cor inválida.';
  if (!Number.isFinite(input.creditLimit) || input.creditLimit < 0) return 'Limite inválido.';
  if (!Number.isInteger(input.closingDay) || input.closingDay < 1 || input.closingDay > 31) {
    return 'Dia de fechamento deve estar entre 1 e 31.';
  }
  if (!Number.isInteger(input.dueDay) || input.dueDay < 1 || input.dueDay > 31) {
    return 'Dia de vencimento deve estar entre 1 e 31.';
  }
  return null;
}

export async function createCard(input: CardInput): Promise<Result> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sessão expirada.' };

  const { data: last } = await supabase
    .from('credit_cards')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('credit_cards').insert({
    user_id: user.id,
    account_id: input.accountId,
    name: input.name.trim(),
    brand: input.brand?.trim() || null,
    color: input.color,
    credit_limit: input.creditLimit,
    closing_day: input.closingDay,
    due_day: input.dueDay,
    position: (last?.position ?? 0) + 1,
  });

  if (error) {
    return { error: error.code === '23505' ? 'Já existe um cartão com esse nome.' : error.message };
  }

  revalidateAll();
  return { error: null };
}

export async function updateCard(id: string, input: CardInput): Promise<Result> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase
    .from('credit_cards')
    .update({
      account_id: input.accountId,
      name: input.name.trim(),
      brand: input.brand?.trim() || null,
      color: input.color,
      credit_limit: input.creditLimit,
      closing_day: input.closingDay,
      due_day: input.dueDay,
    })
    .eq('id', id);

  if (error) {
    return { error: error.code === '23505' ? 'Já existe um cartão com esse nome.' : error.message };
  }

  revalidateAll();
  return { error: null };
}

export async function archiveCard(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('credit_cards').update({ is_archived: true }).eq('id', id);
  if (error) return { error: error.message };

  revalidateAll();
  return { error: null };
}

export async function restoreCard(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from('credit_cards').update({ is_archived: false }).eq('id', id);
  if (error) return { error: error.message };

  revalidateAll();
  return { error: null };
}

export async function deleteCard(id: string): Promise<Result> {
  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('card_id', id);

  if (countError) return { error: countError.message };
  if ((count ?? 0) > 0) {
    return { error: `Cartão com ${count} lançamento(s). Arquive-o em vez de excluir.` };
  }

  const { error } = await supabase.from('credit_cards').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidateAll();
  return { error: null };
}

/**
 * Pagamento de fatura: gera uma despesa na conta vinculada ao cartão,
 * marcada com is_card_payment para não contar como gasto de novo nos KPIs
 * (as compras já contaram no mês em que foram feitas).
 */
export async function payStatement(input: {
  cardId: string;
  statementMonth: string;
  amount: number;
  date: string;
}): Promise<Result> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { error: 'Informe um valor maior que zero.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: 'Data inválida.' };
  if (!/^\d{4}-\d{2}/.test(input.statementMonth)) return { error: 'Mês da fatura inválido.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sessão expirada.' };

  const { data: card, error: cardError } = await supabase
    .from('credit_cards')
    .select('id, name, account_id')
    .eq('id', input.cardId)
    .single();

  if (cardError || !card) return { error: cardError?.message ?? 'Cartão não encontrado.' };

  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    new Date(`${input.statementMonth.slice(0, 7)}-01T12:00:00`),
  );

  const { error } = await supabase.from('transactions').insert({
    user_id: user.id,
    type: 'expense',
    description: `Fatura ${card.name} — ${label}`,
    amount: input.amount,
    date: input.date,
    settlement: 'account',
    account_id: card.account_id,
    payment_method: 'transfer',
    is_card_payment: true,
    card_payment_for: card.id,
    // Qual fatura está sendo paga — a data do pagamento não diz isso, já que
    // a fatura vence no mês seguinte.
    card_payment_month: `${input.statementMonth.slice(0, 7)}-01`,
    category_id: null,
  });

  if (error) return { error: error.message };

  revalidateAll();
  return { error: null };
}
