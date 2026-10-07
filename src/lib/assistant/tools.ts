import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database.types';
import { budgets, forecast } from './projections';
import { readAll } from './database';
export { readAll } from './database';
import {
  AssistantError,
  dateValue,
  objectValue,
  uuidValue,
  type AssistantSource,
} from './contracts';

export type AssistantDatabase = SupabaseClient<Database>;
const DOMAINS = [
  'catalog',
  'totals',
  'transactions',
  'budgets',
  'statements',
  'balance_history',
  'forecast',
  'recurring',
  'goals',
  'tags',
] as const;
type Domain = (typeof DOMAINS)[number];
export type FinancialQuery = {
  domain: Domain;
  start: string;
  end: string;
  categoryId: string | null;
  accountId: string | null;
  cardId: string | null;
  tagId: string | null;
  search: string | null;
  page: number;
};
export type FinancialResult = { result: unknown; source: AssistantSource };

export const financialTool = {
  type: 'function' as const,
  name: 'query_finances',
  strict: true,
  description:
    'Consulta dados atuais do usuário. catalog resolve nomes e IDs (inclui arquivados); totals agrega TODOS os registros e compara meses, excluindo transferências/pagamentos de fatura; transactions lista 50 registros por página e inclui parcelas/transferências/pagamentos; budgets calcula rollover; statements usa mês da fatura; balance_history exige accountId; forecast estima compromissos. Período explícito prevalece sobre mês selecionado; use chamadas separadas para comparar períodos. Filtros de entidades e search só se aplicam a totals/transactions; accountId também a balance_history. Outros domínios retornam todos os registros do usuário no período, para identificação explícita.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      domain: { type: 'string', enum: [...DOMAINS] },
      start: { type: 'string', description: 'Primeiro dia consultado AAAA-MM-DD' },
      end: { type: 'string', description: 'Último dia consultado AAAA-MM-DD' },
      categoryId: { type: ['string', 'null'] },
      accountId: { type: ['string', 'null'] },
      cardId: { type: ['string', 'null'] },
      tagId: { type: ['string', 'null'] },
      search: {
        type: ['string', 'null'],
        description: 'Texto literal em descrição/notas, não filtro SQL',
      },
      page: { type: 'integer', minimum: 1, description: 'Página da listagem; 1 por padrão' },
    },
    required: [
      'domain',
      'start',
      'end',
      'categoryId',
      'accountId',
      'cardId',
      'tagId',
      'search',
      'page',
    ],
  },
};

/** Validates model arguments independently of strict mode. Example: parseFinancialQuery(args). */
export function parseFinancialQuery(value: unknown): FinancialQuery {
  const query = objectValue(value);
  if (
    Object.keys(query).some(
      (key) => !Object.keys(financialTool.parameters.properties).includes(key),
    ) ||
    !DOMAINS.includes(query.domain as Domain)
  )
    throw new AssistantError('invalid_tool', 'Domínio de consulta inválido.');
  const start = dateValue(query.start),
    end = dateValue(query.end);
  if (start > end)
    throw new AssistantError('invalid_tool', `Intervalo inválido: ${start} > ${end}.`);
  const ids = {
    categoryId: nullableId(query.categoryId),
    accountId: nullableId(query.accountId),
    cardId: nullableId(query.cardId),
    tagId: nullableId(query.tagId),
  };
  if (!Number.isInteger(query.page) || Number(query.page) < 1 || Number(query.page) > 100000)
    throw new AssistantError('invalid_tool', 'Esperada página inteira positiva.');
  if (query.search !== null && (typeof query.search !== 'string' || query.search.length > 200))
    throw new AssistantError('invalid_tool', 'Esperado texto de busca com até 200 caracteres.');
  return {
    domain: query.domain as Domain,
    start,
    end,
    ...ids,
    search: query.search as string | null,
    page: Number(query.page),
  };
}

function nullableId(value: unknown) {
  return value === null ? null : uuidValue(value);
}

const sourceRoutes: Record<Domain, [string, string]> = {
  catalog: ['Cadastros e saldos atuais', '/accounts'],
  totals: ['Transações e totais', '/transactions'],
  transactions: ['Transações', '/transactions'],
  budgets: ['Orçamentos e rollover', '/categories'],
  statements: ['Faturas', '/cards'],
  balance_history: ['Histórico de saldo', '/accounts'],
  forecast: ['Previsão de compromissos', '/forecast'],
  recurring: ['Lançamentos fixos', '/recurring'],
  goals: ['Metas e preferências', '/settings'],
  tags: ['Totais por tag', '/reports'],
};

/** Executes only the allowlisted financial read operations. Example: executeFinancialQuery(db,args,signal). */
export async function executeFinancialQuery(
  db: AssistantDatabase,
  query: FinancialQuery,
  signal: AbortSignal,
): Promise<FinancialResult> {
  const result = await runFinancialQuery(db, query, signal);
  const [label, route] = sourceRoutes[query.domain];
  const params = new URLSearchParams({ month: `${query.start.slice(0, 7)}-01` });
  if (query.domain === 'transactions' || query.domain === 'totals') {
    if (query.start.slice(0, 7) !== query.end.slice(0, 7)) params.set('scope', 'all');
    for (const key of ['categoryId', 'accountId', 'cardId', 'tagId', 'search'] as const)
      if (query[key]) params.set(key === 'search' ? 'q' : key.replace('Id', ''), query[key]);
  }
  return {
    result,
    source: {
      label,
      href: route === '/settings' ? route : `${route}?${params}`,
      period:
        query.domain === 'catalog' || query.domain === 'goals' || query.domain === 'recurring'
          ? 'Cadastro atual'
          : ['budgets', 'statements', 'forecast', 'tags'].includes(query.domain)
            ? `Meses ${query.start.slice(0, 7)} a ${query.end.slice(0, 7)}`
            : `${query.start} a ${query.end}`,
    },
  };
}

async function runFinancialQuery(
  db: AssistantDatabase,
  q: FinancialQuery,
  signal: AbortSignal,
): Promise<unknown> {
  if (q.domain === 'totals') return transactionTotals(db, q, signal);
  if (q.domain === 'transactions') return transactionPage(db, q, signal);
  if (q.domain === 'catalog') return catalog(db, signal);
  if (q.domain === 'budgets') return budgets(db, q, signal);
  if (q.domain === 'forecast') return forecast(db, q, signal);
  if (q.domain === 'balance_history') return balanceHistory(db, q, signal);
  if (q.domain === 'goals') {
    const { data, error } = await db
      .from('profiles')
      .select('currency,locale,monthly_goal,monthly_spending_cap')
      .abortSignal(signal)
      .single();
    if (error) throw error;
    return data;
  }
  if (q.domain === 'recurring')
    return readAll(
      (a, b) =>
        db
          .from('recurring_transactions')
          .select(
            'id,description,type,amount,day_of_month,start_month,end_month,is_active,category_id,account_id,card_id',
          )
          .order('id')
          .range(a, b)
          .abortSignal(signal),
      signal,
    );
  if (q.domain === 'tags')
    return readAll(
      (a, b) =>
        db
          .from('tag_month_totals')
          .select('tag_id,name,month,income,expense,items')
          .gte('month', `${q.start.slice(0, 7)}-01`)
          .lte('month', q.end)
          .order('month')
          .order('tag_id')
          .range(a, b)
          .abortSignal(signal),
      signal,
    );
  return readAll(
    (a, b) =>
      db
        .from('card_statements')
        .select(
          'card_id,name,statement_id,statement_month,period_start,total,paid,open_amount,due_date,closing_date,is_archived,is_adjusted,merged_into,merged_into_month',
        )
        .gte('statement_month', `${q.start.slice(0, 7)}-01`)
        .lte('statement_month', q.end)
        .order('statement_month')
        .order('card_id')
        .range(a, b)
        .abortSignal(signal),
    signal,
  );
}

async function transactionTotals(db: AssistantDatabase, q: FinancialQuery, signal: AbortSignal) {
  const { data, error } = await db
    .rpc('assistant_transaction_totals', {
      p_start: q.start,
      p_end: q.end,
      p_category_id: q.categoryId,
      p_account_id: q.accountId,
      p_card_id: q.cardId,
      p_tag_id: q.tagId,
      p_search: q.search,
    })
    .abortSignal(signal);
  if (error) throw error;
  return { ...objectValue(data), monthlyChanges: monthlyChanges(data) };
}

/** Computes comparable monthly differences on the server. Example: monthlyChanges(rpcResult). */
export function monthlyChanges(
  value: Json,
): { month: string; expenseChange: number; percentChange: number | null }[] {
  const monthly = objectValue(value).monthly;
  if (!Array.isArray(monthly)) return [];
  return monthly.slice(1).map((row, index) => {
    const current = objectValue(row),
      previous = objectValue(monthly[index]);
    const delta = Number(current.expense) - Number(previous.expense);
    return {
      month: String(current.month),
      expenseChange: Number(delta.toFixed(2)),
      percentChange: Number(previous.expense)
        ? Number(((delta / Number(previous.expense)) * 100).toFixed(2))
        : null,
    };
  });
}

async function transactionPage(db: AssistantDatabase, q: FinancialQuery, signal: AbortSignal) {
  const tags = q.tagId ? ',tags!inner(id,name)' : ',tags(id,name)';
  let query = db
    .from('transactions')
    .select(
      'id,date,description,notes,amount,type,category_id,account_id,card_id,payment_method,is_transfer,transfer_group,is_card_payment,installment_no,installment_total' +
        tags,
      { count: 'exact' },
    )
    .gte('date', q.start)
    .lte('date', q.end)
    .order('date')
    .order('id');
  if (q.categoryId) query = query.eq('category_id', q.categoryId);
  if (q.accountId) query = query.eq('account_id', q.accountId);
  if (q.cardId) query = query.eq('card_id', q.cardId);
  if (q.tagId) query = query.eq('tags.id', q.tagId);
  if (q.search) {
    const search = q.search.replace(/[(),"\\%_]/g, ' ').trim();
    query = query.or(`description.ilike.%${search}%,notes.ilike.%${search}%`);
  }
  const { data, error, count } = await query
    .range((q.page - 1) * 50, q.page * 50 - 1)
    .abortSignal(signal);
  if (error) throw error;
  return {
    rows: data,
    total: count,
    page: q.page,
    pageSize: 50,
    warning: 'Lista paginada; para totais use totals. Transferências aparecem em duas pontas.',
  };
}

async function catalog(db: AssistantDatabase, signal: AbortSignal) {
  const [accounts, cards, categories, tags] = await Promise.all([
    readAll(
      (a, b) =>
        db
          .from('account_balances')
          .select('account_id,name,kind,balance,opening_balance,is_archived')
          .order('account_id')
          .range(a, b)
          .abortSignal(signal),
      signal,
    ),
    readAll(
      (a, b) =>
        db
          .from('credit_cards')
          .select('id,name,credit_limit,closing_day,due_day,is_archived')
          .order('id')
          .range(a, b)
          .abortSignal(signal),
      signal,
    ),
    readAll(
      (a, b) =>
        db
          .from('categories')
          .select('id,name,kind,budget,is_archived,rollover_enabled,rollover_since')
          .order('id')
          .range(a, b)
          .abortSignal(signal),
      signal,
    ),
    readAll(
      (a, b) => db.from('tags').select('id,name').order('id').range(a, b).abortSignal(signal),
      signal,
    ),
  ]);
  return {
    accounts,
    cards,
    categories,
    tags,
    note: 'Saldo atual, independente do período solicitado. Arquivados incluídos.',
  };
}

async function balanceHistory(db: AssistantDatabase, q: FinancialQuery, signal: AbortSignal) {
  if (!q.accountId)
    throw new AssistantError(
      'invalid_tool',
      'Identifique a conta no catalog antes de consultar seu histórico.',
    );
  const { data, error, count } = await db
    .from('account_balance_history')
    .select('sequence_no,change_kind,delta,balance,description,changed_at', { count: 'exact' })
    .eq('account_id', q.accountId)
    .gte('changed_at', `${q.start}T00:00:00-03:00`)
    .lte('changed_at', `${q.end}T23:59:59.999-03:00`)
    .order('sequence_no', { ascending: false })
    .range((q.page - 1) * 50, q.page * 50 - 1)
    .abortSignal(signal);
  if (error) throw error;
  return {
    rows: data,
    total: count,
    page: q.page,
    warning:
      'Histórico disponível desde a implantação/backfill; não constitui auditoria anterior completa.',
  };
}
