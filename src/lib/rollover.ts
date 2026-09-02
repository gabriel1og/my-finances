import type { CategorySpending } from '@/types/database.types';

/**
 * Rollover de orçamento: o que sobrou (ou faltou) nos meses anteriores entra
 * no mês atual.
 *
 * O acumulado é sempre derivado do histórico — nunca guardado. Uma coluna com
 * o saldo acumulado viraria uma segunda fonte da verdade e sairia de sincronia
 * assim que uma transação antiga fosse editada.
 */
export type RolloverResult = {
  /** Soma de (limite − gasto) dos meses anteriores, a partir de rollover_since. */
  carry: number;
  /** Limite do mês + carry. Pode ser menor que o limite, se houve estouro. */
  available: number;
  monthsCounted: number;
};

export function computeRollover({
  rows,
  categoryId,
  month,
  since,
  monthBudget,
}: {
  rows: CategorySpending[];
  categoryId: string;
  month: string;
  /** Primeiro mês que conta para o acúmulo (null = rollover desligado). */
  since: string | null;
  monthBudget: number;
}): RolloverResult {
  if (!since) return { carry: 0, available: monthBudget, monthsCounted: 0 };

  const currentKey = month.slice(0, 7);
  const sinceKey = since.slice(0, 7);

  const previous = rows.filter(
    (row) =>
      row.category_id === categoryId &&
      row.month.slice(0, 7) >= sinceKey &&
      row.month.slice(0, 7) < currentKey,
  );

  // Mês sem limite definido não gera sobra: orçamento zero significa "não
  // orçado", não "orçado em zero". Sem essa regra, todo mês anterior à
  // definição do limite viraria estouro.
  const counted = previous.filter((row) => Number(row.budget) > 0);

  const carry = counted.reduce((sum, row) => sum + (Number(row.budget) - Number(row.spent)), 0);

  return {
    carry: Number(carry.toFixed(2)),
    available: Number((monthBudget + carry).toFixed(2)),
    monthsCounted: counted.length,
  };
}

/** Categoria com rollover, no mínimo que o cálculo precisa. */
export type RolloverCategory = {
  id: string;
  kind: string;
  rollover_enabled: boolean;
  rollover_since: string | null;
};

export type RolloverRow = {
  categoryId: string;
  name: string;
  color: string;
  spent: number;
  /** Limite definido para o mês, sem o acumulado. */
  budget: number;
  carry: number;
  /** budget + carry. É contra ele que a barra é lida. */
  available: number;
};

/**
 * Junta o gasto do mês com o acumulado dos meses anteriores, para as telas que
 * mostram orçamento sem serem `/categories`. Categoria sem rollover ligado sai
 * com carry 0 — a leitura continua sendo mês a mês.
 */
export function buildRolloverRows({
  spending,
  history,
  categories,
  month,
}: {
  spending: CategorySpending[];
  history: CategorySpending[];
  categories: RolloverCategory[];
  month: string;
}): RolloverRow[] {
  const byId = new Map(categories.map((category) => [category.id, category]));

  return spending
    .filter((row) => row.kind === 'expense')
    .map((row) => {
      const category = byId.get(row.category_id ?? '');
      const budget = Number(row.budget);
      const { carry, available } = computeRollover({
        rows: history,
        categoryId: row.category_id ?? '',
        month,
        since: category?.rollover_enabled ? category.rollover_since : null,
        monthBudget: budget,
      });

      return {
        categoryId: row.category_id ?? '',
        name: row.name ?? '',
        color: row.color ?? '#5B6EF5',
        spent: Number(row.spent),
        budget,
        carry,
        available,
      };
    });
}
