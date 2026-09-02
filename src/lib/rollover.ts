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
