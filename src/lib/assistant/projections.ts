import type { CategorySpending, RecurringWithRelations } from '@/types/database.types';
import { buildForecast, monthSequence } from '@/lib/forecast';
import { computeRollover } from '@/lib/rollover';
import { AssistantError } from './contracts';
import type { AssistantDatabase, FinancialQuery } from './tools';
import { readAll } from './database';
export async function budgets(db: AssistantDatabase, q: FinancialQuery, signal: AbortSignal) {
  const [categories, history, overrides] = await Promise.all([
    readAll(
      (a, b) =>
        db
          .from('categories')
          .select('*')
          .eq('is_archived', false)
          .order('id')
          .range(a, b)
          .abortSignal(signal),
      signal,
    ),
    readAll(
      (a, b) =>
        db
          .from('category_month_spending')
          .select('*')
          .lte('month', q.end)
          .order('month')
          .order('category_id')
          .range(a, b)
          .abortSignal(signal),
      signal,
    ),
    readAll(
      (a, b) =>
        db
          .from('budgets')
          .select('category_id,month,amount')
          .gte('month', `${q.start.slice(0, 7)}-01`)
          .lte('month', q.end)
          .order('month')
          .order('category_id')
          .range(a, b)
          .abortSignal(signal),
      signal,
    ),
  ]);
  const months = requestedMonths(q);
  return months.flatMap((month) =>
    categories
      .filter((c) => c.kind === 'expense')
      .map((c) => {
        const spending = history.find((r) => r.category_id === c.id && r.month === month);
        const budget = Number(
          overrides.find((b) => b.category_id === c.id && b.month === month)?.amount ?? c.budget,
        );
        const rollover = computeRollover({
          rows: history as CategorySpending[],
          categoryId: c.id,
          month,
          since: c.rollover_enabled ? c.rollover_since : null,
          monthBudget: budget,
        });
        return {
          month,
          categoryId: c.id,
          name: c.name,
          spent: Number(spending?.spent ?? 0),
          budget,
          ...rollover,
        };
      }),
  );
}

function requestedMonths(q: FinancialQuery) {
  const count =
    (Number(q.end.slice(0, 4)) - Number(q.start.slice(0, 4))) * 12 +
    Number(q.end.slice(5, 7)) -
    Number(q.start.slice(5, 7)) +
    1;
  if (count > 120)
    throw new AssistantError(
      'query_too_large',
      'Para orçamento/previsão, consulte até 120 meses por vez.',
    );
  return monthSequence(q.start, count);
}

export async function forecast(db: AssistantDatabase, q: FinancialQuery, signal: AbortSignal) {
  const months = requestedMonths(q);
  const [statements, recurring, posted] = await Promise.all([
    readAll(
      (a, b) =>
        db
          .from('card_statements')
          .select('*')
          .gte('due_date', months[0])
          .lte('due_date', q.end)
          .is('merged_into', null)
          .order('due_date')
          .order('card_id')
          .range(a, b)
          .abortSignal(signal),
      signal,
    ),
    readAll(
      (a, b) =>
        db
          .from('recurring_transactions')
          .select(
            '*,category:categories(id,name,color),account:accounts(id,name,color),card:credit_cards(id,name,color),tags(id,name,color)',
          )
          .order('id')
          .range(a, b)
          .abortSignal(signal),
      signal,
    ),
    readAll(
      (a, b) =>
        db
          .from('transactions')
          .select('id,recurring_id,recurring_month')
          .not('recurring_id', 'is', null)
          .gte('recurring_month', months[0])
          .lte('recurring_month', q.end)
          .order('id')
          .range(a, b)
          .abortSignal(signal),
      signal,
    ),
  ]);
  return {
    estimate: true,
    months: months.map((month) => {
      const rows = buildForecast({
        months: [month],
        statements,
        recurring: recurring as unknown as RecurringWithRelations[],
        postedRecurringIds: new Set(
          posted.filter((r) => r.recurring_month === month).map((r) => r.recurring_id!),
        ),
      });
      const row = rows[0];
      return {
        month: row.month,
        cardTotal: row.cardTotal,
        recurringExpense: row.recurringExpense,
        recurringIncome: row.recurringIncome,
        committed: row.committed,
      };
    }),
    note: 'Faturas = saldo ainda a pagar, por vencimento real, descontando pagamentos. Fixos = estimativas ainda não lançadas; não é previsão de saldo disponível.',
  };
}
