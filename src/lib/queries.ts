import { createClient } from '@/lib/supabase/server';
import { monthRange } from '@/lib/format';
import type {
  AccountBalance,
  AccountMonthTotals,
  CardMonthTotals,
  NetWorthPoint,
  Tag,
  TagTotals,
  Account,
  CardStatement,
  CardStatementItem,
  CategorySpending,
  CreditCard,
  MonthlyFlow,
  Profile,
  RecurringWithRelations,
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

/**
 * Os últimos `months` meses com movimento **até o mês selecionado**, em ordem
 * cronológica. Sem o `uptoMonth`, a janela era "os N meses mais recentes do
 * banco" — e bastava haver parcelas lançadas em meses futuros para o mês em
 * tela cair fora dela.
 */
export async function getMonthlyFlow(months = 6, uptoMonth?: string) {
  const supabase = await createClient();
  let query = supabase
    .from('monthly_flow')
    .select('*')
    .order('month', { ascending: false })
    .limit(months);
  if (uptoMonth) query = query.lte('month', `${uptoMonth.slice(0, 7)}-01`);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as MonthlyFlow[]).reverse();
}

/** Totais de um único mês; null quando não há nenhum lançamento nele. */
export async function getMonthFlow(month: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('monthly_flow')
    .select('*')
    .eq('month', `${month.slice(0, 7)}-01`)
    .maybeSingle();
  if (error) throw error;
  return (data as MonthlyFlow | null) ?? null;
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

/** E-mail da sessão: não vive em `profiles`, só no usuário do Auth. */
export async function getAuthEmail() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? null;
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

export async function getRecurring() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('recurring_transactions')
    .select(
      '*, category:categories(id,name,color)' +
        ', account:accounts(id,name,color)' +
        ', card:credit_cards(id,name,color)' +
        ', tags(id,name,color)',
    )
    .order('day_of_month');

  if (error) throw error;
  return (data ?? []) as unknown as RecurringWithRelations[];
}

/** Ids dos modelos que já viraram lançamento no mês. */
export async function getPostedRecurringIds(month: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('transactions')
    .select('recurring_id')
    .eq('recurring_month', `${month.slice(0, 7)}-01`)
    .not('recurring_id', 'is', null);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.recurring_id as string));
}

/**
 * Faturas do mês informado em diante. As parcelas futuras já existem como
 * transações com data futura, então a view `card_statements` produz esses
 * meses sozinha — não há previsão inventada aqui, só o que já foi comprado.
 */
export async function getUpcomingStatements(fromMonth: string, monthsAhead = 6) {
  const supabase = await createClient();

  const start = `${fromMonth.slice(0, 7)}-01`;
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + monthsAhead, 1);
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('card_statements')
    .select('*')
    .gte('statement_month', start)
    .lt('statement_month', end)
    .order('statement_month');

  if (error) throw error;
  return (data ?? []) as CardStatement[];
}

/** Faixa de meses para o comparativo por categoria. */
export async function getCategorySpendingRange(fromMonth: string, months: number) {
  const supabase = await createClient();
  const [year, month] = fromMonth.slice(0, 7).split('-').map(Number);
  const start = new Date(year, month - months, 1);
  const startISO = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('category_month_spending')
    .select('*')
    .gte('month', startISO)
    .lte('month', `${fromMonth.slice(0, 7)}-01`)
    .order('month');

  if (error) throw error;
  return (data ?? []) as CategorySpending[];
}

export async function getAccountMonthTotals(month: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('account_month_totals')
    .select('*')
    .eq('month', `${month.slice(0, 7)}-01`)
    .order('expense', { ascending: false });

  if (error) throw error;
  return (data ?? []) as AccountMonthTotals[];
}

export async function getCardMonthTotals(month: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('card_month_totals')
    .select('*')
    .eq('month', `${month.slice(0, 7)}-01`)
    .order('expense', { ascending: false });

  if (error) throw error;
  return (data ?? []) as CardMonthTotals[];
}

export async function getNetWorthSeries(months = 12) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('net_worth_by_month')
    .select('*')
    .order('month', { ascending: false })
    .limit(months);

  if (error) throw error;
  return ((data ?? []) as NetWorthPoint[]).reverse();
}

export const TRANSACTIONS_PAGE_SIZE = 50;

export type TransactionQuery = {
  /** null = todos os meses (usado pela busca global). */
  month: string | null;
  search?: string;
  type?: 'income' | 'expense' | 'transfer' | 'all';
  categoryId?: string;
  tagId?: string;
  accountId?: string;
  cardId?: string;
  page?: number;
};

/**
 * Busca paginada no servidor. Antes a página trazia o mês inteiro e filtrava
 * no cliente — o que impedia procurar fora do mês e ficaria pesado com anos de
 * histórico.
 */
export async function getTransactionsPage(params: TransactionQuery) {
  const supabase = await createClient();
  const page = Math.max(params.page ?? 1, 1);
  const from = (page - 1) * TRANSACTIONS_PAGE_SIZE;

  // `!inner` no embed de tags transforma o filtro por tag em INNER JOIN —
  // sem isso o .eq() não restringiria as linhas, só o conteúdo do embed.
  const tagEmbed = params.tagId ? 'tags!inner(id,name,color)' : 'tags(id,name,color)';

  let query = supabase
    .from('transactions')
    .select(
      '*, category:categories!transactions_category_id_fkey(id,name,color)' +
        ', account:accounts!transactions_account_id_fkey(id,name,color)' +
        ', card:credit_cards!transactions_card_id_fkey(id,name,color)' +
        `, ${tagEmbed}`,
      { count: 'exact' },
    )
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, from + TRANSACTIONS_PAGE_SIZE - 1);

  if (params.month) {
    const { start, end } = monthRange(params.month);
    query = query.gte('date', start).lte('date', end);
  }

  const search = params.search?.trim();
  if (search) query = query.ilike('description', `%${search}%`);

  if (params.type === 'transfer') query = query.eq('is_transfer', true);
  else if (params.type === 'income' || params.type === 'expense') {
    query = query.eq('type', params.type).eq('is_transfer', false);
  }

  if (params.categoryId) query = query.eq('category_id', params.categoryId);
  if (params.accountId) query = query.eq('account_id', params.accountId);
  if (params.cardId) query = query.eq('card_id', params.cardId);
  if (params.tagId) query = query.eq('tags.id', params.tagId);

  const { data, error, count } = await query;
  if (error) throw error;

  const total = count ?? 0;
  return {
    transactions: (data ?? []) as unknown as TransactionWithCategory[],
    total,
    page,
    pageCount: Math.max(Math.ceil(total / TRANSACTIONS_PAGE_SIZE), 1),
  };
}

/** Histórico completo por categoria até o mês informado — base do rollover. */
export async function getCategoryHistory(uptoMonth: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('category_month_spending')
    .select('*')
    .lte('month', `${uptoMonth.slice(0, 7)}-01`)
    .order('month');

  if (error) throw error;
  return (data ?? []) as CategorySpending[];
}
