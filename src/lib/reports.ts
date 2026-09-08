import { DEFAULT_REPORT_RANGE, REPORT_RANGES } from '@/lib/constants';
import type { CategorySpending, TagTotals } from '@/types/database.types';

/**
 * Formas dos relatórios por origem — conta e cartão.
 *
 * As duas views (`account_month_totals` e `card_month_totals`) respondem à
 * mesma pergunta em dimensões diferentes, então a montagem mora aqui, em
 * funções puras, em vez de duas cópias dentro da página.
 */

/** Uma linha de view normalizada: `id` no lugar de `account_id`/`card_id`. */
export type SourceMonthRow = {
  id: string;
  name: string;
  color: string;
  month: string;
  expense: number;
  /** Cartão não tem receita; conta tem. */
  income?: number;
  items: number;
};

export type SourceTotal = {
  id: string;
  name: string;
  color: string;
  expense: number;
  income: number;
  items: number;
  /** Fatia da despesa do grupo, em porcentagem. */
  share: number;
};

/**
 * Totais de um mês por origem, do maior gasto para o menor.
 *
 * Origem que só recebeu dinheiro no mês continua na lista: uma conta com
 * salário entrando e nenhum gasto some se o filtro for pela despesa, e some
 * exatamente do lugar onde se procura por ela.
 */
export function buildSourceTotals(rows: SourceMonthRow[]): SourceTotal[] {
  const totals = new Map<string, SourceTotal>();

  for (const row of rows) {
    const current = totals.get(row.id) ?? {
      id: row.id,
      name: row.name,
      color: row.color,
      expense: 0,
      income: 0,
      items: 0,
      share: 0,
    };

    current.expense += Number(row.expense);
    current.income += Number(row.income ?? 0);
    current.items += Number(row.items);
    totals.set(row.id, current);
  }

  const list = [...totals.values()].filter((item) => item.expense > 0 || item.income > 0);
  const grandTotal = list.reduce((sum, item) => sum + item.expense, 0);

  for (const item of list) {
    item.share = grandTotal > 0 ? (item.expense / grandTotal) * 100 : 0;
  }

  return list.sort((a, b) => b.expense - a.expense);
}

export type TrendRow = {
  id: string;
  name: string;
  color: string;
  /** Um valor por mês de `months`, na mesma ordem. Mês sem movimento é 0. */
  values: number[];
  total: number;
};

export type ReportCardScope = 'range' | 'month';

export function parseReportCardScope(value: string | null | undefined): ReportCardScope {
  return value === 'month' ? 'month' : 'range';
}

/** Junta a mesma categoria quando o donut mostra a janela inteira. */
export function buildCategorySpendingTotals(rows: CategorySpending[]): CategorySpending[] {
  const totals = new Map<string, CategorySpending>();

  for (const row of rows) {
    const key = `${row.kind}:${row.category_id}`;
    const current = totals.get(key) ?? { ...row, spent: 0, budget: 0, pct_used: null };
    current.spent = Number(current.spent) + Number(row.spent);
    current.budget = Number(current.budget) + Number(row.budget);
    current.pct_used = current.budget > 0 ? (current.spent / current.budget) * 100 : null;
    totals.set(key, current);
  }

  return [...totals.values()]
    .filter((item) => Number(item.spent) > 0)
    .sort((a, b) => Number(b.spent) - Number(a.spent));
}

export type TagTotalRow = {
  tag_id: string;
  name: string;
  color: string;
  expense: number;
  income: number;
  items: number;
};

/** Soma a mesma tag quando a consulta cobre mais de um mês. */
export function buildTagTotals(rows: TagTotals[]): TagTotalRow[] {
  const totals = new Map<string, TagTotalRow>();

  for (const row of rows) {
    const current = totals.get(row.tag_id) ?? {
      tag_id: row.tag_id,
      name: row.name,
      color: row.color,
      expense: 0,
      income: 0,
      items: 0,
    };

    current.expense += Number(row.expense);
    current.income += Number(row.income);
    current.items += Number(row.items);
    totals.set(row.tag_id, current);
  }

  return [...totals.values()]
    .filter((item) => item.expense > 0 || item.income > 0)
    .sort((a, b) => b.expense - a.expense);
}

/**
 * Matriz origem × mês para o comparativo. Linha sem nenhum gasto no período
 * fica de fora — seria uma faixa de trilhos ocupando altura.
 */
export function buildTrendRows(rows: SourceMonthRow[], months: string[]): TrendRow[] {
  const meta = new Map<string, { name: string; color: string }>();
  const byKey = new Map<string, number>();

  for (const row of rows) {
    meta.set(row.id, { name: row.name, color: row.color });
    const key = `${row.id}:${row.month.slice(0, 7)}`;
    byKey.set(key, (byKey.get(key) ?? 0) + Number(row.expense));
  }

  return [...meta.entries()]
    .map(([id, item]) => {
      const values = months.map((month) => byKey.get(`${id}:${month.slice(0, 7)}`) ?? 0);
      return { id, ...item, values, total: values.reduce((sum, value) => sum + value, 0) };
    })
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);
}

/**
 * Janela de meses pedida pela URL. Valor fora da lista — digitado à mão,
 * herdado de um link velho — cai no padrão em vez de quebrar a página.
 */
export function parseReportRange(
  value: string | null | undefined,
  fallback = DEFAULT_REPORT_RANGE,
): number {
  const parsed = Number(value);
  return (REPORT_RANGES as readonly number[]).includes(parsed) ? parsed : fallback;
}
