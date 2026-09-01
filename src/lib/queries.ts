import { createClient } from '@/lib/supabase/server';
import { monthRange } from '@/lib/format';
import type {
  AccountBalance,
  Tag,
  TagTotals,
  Account,
  CardStatement,
  CardStatementItem,
  CategorySpending,
  CreditCard,
  MonthlyFlow,
  Profile,
  TransactionWithCategory,
} from '@/types/database.types';

export async function getTransactions(month?: string, limit?: number) {
  const supabase = await createClient();
  let query = supabase
    .from('transactions')
    .select(
      // FKs explícitas: transactions aponta duas vezes para credit_cards
      // (card_id e card_payment_for), então o embed precisa dizer qual usar.
      // `tags(...)` é embed many-to-many: o PostgREST atravessa
      // transaction_tags sozinho porque a PK dela é composta pelas duas FKs.
      '*, category:categories!transactions_category_id_fkey(id,name,color)' +
        ', account:accounts!transactions_account_id_fkey(id,name,color)' +
        ', card:credit_cards!transactions_card_id_fkey(id,name,color)' +
        ', tags(id,name,color)',
    )
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (month) {
    const { start, end } = monthRange(month);
    query = query.gte('date', start).lte('date', end);
  }
  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as TransactionWithCategory[];
}

export async function getMonthlyFlow(months = 6) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('monthly_flow')
    .select('*')
    .order('month', { ascending: false })
    .limit(months);
  if (error) throw error;
  return ((data ?? []) as MonthlyFlow[]).reverse();
}

export async function getCategorySpending(month: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('category_month_spending')
    .select('*')
    .eq('month', `${month.slice(0, 7)}-01`)
    .order('spent', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CategorySpending[];
}

export async function getCategories(includeArchived = false) {
  const supabase = await createClient();
  let query = supabase.from('categories').select('*').order('position');
  if (!includeArchived) query = query.eq('is_archived', false);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getMonthBudgets(month: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('budgets')
    .select('category_id, amount')
    .eq('month', `${month.slice(0, 7)}-01`);
  if (error) throw error;
  return data ?? [];
}

export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (error) throw error;
  return data as Profile;
}

export async function getAccounts(includeArchived = false) {
  const supabase = await createClient();
  let query = supabase.from('accounts').select('*').order('position');
  if (!includeArchived) query = query.eq('is_archived', false);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Account[];
}

export async function getAccountBalances() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('account_balances').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as AccountBalance[];
}

export async function getCards(includeArchived = false) {
  const supabase = await createClient();
  let query = supabase.from('credit_cards').select('*').order('position');
  if (!includeArchived) query = query.eq('is_archived', false);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CreditCard[];
}

/** Faturas de um mês específico (o mês da fatura, não o da compra). */
export async function getCardStatements(month: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('card_statements')
    .select('*')
    .eq('statement_month', `${month.slice(0, 7)}-01`);
  if (error) throw error;
  return (data ?? []) as CardStatement[];
}

export async function getStatementItems(month: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('card_statement_items')
    .select('*')
    .eq('statement_month', `${month.slice(0, 7)}-01`)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CardStatementItem[];
}

export async function getTags() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('tags').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as Tag[];
}

export async function getTagTotals(month: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tag_month_totals')
    .select('*')
    .eq('month', `${month.slice(0, 7)}-01`)
    .order('expense', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TagTotals[];
}
