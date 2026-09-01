import type { CardStatement, RecurringWithRelations } from '@/types/database.types';

export type ForecastMonth = {
  month: string;
  statements: CardStatement[];
  cardTotal: number;
  recurringExpense: number;
  recurringIncome: number;
  /** Faturas + fixos de despesa: o que já está comprometido no mês. */
  committed: number;
};

/** Lista de meses a partir de `from`, inclusive. */
export function monthSequence(from: string, count: number): string[] {
  const [year, month] = from.slice(0, 7).split('-').map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(year, month - 1 + index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
  });
}

/** Um modelo vale para o mês se já começou, não terminou e está ativo. */
export function recurringAppliesTo(item: RecurringWithRelations, month: string): boolean {
  return (
    item.is_active && item.start_month <= month && (!item.end_month || item.end_month >= month)
  );
}

/**
 * Junta o que já está comprometido em cada mês: faturas de cartão (que já
 * contêm as parcelas futuras) e os lançamentos fixos previstos.
 *
 * `postedRecurringIds` evita contar duas vezes um fixo já lançado — só faz
 * sentido no mês corrente, já que nos futuros nada foi lançado ainda.
 */
export function buildForecast({
  months,
  statements,
  recurring,
  postedRecurringIds,
}: {
  months: string[];
  statements: CardStatement[];
  recurring: RecurringWithRelations[];
  postedRecurringIds: Set<string>;
}): ForecastMonth[] {
  return months.map((month) => {
    const monthStatements = statements.filter(
      (row) => row.statement_month.slice(0, 7) === month.slice(0, 7),
    );
    const cardTotal = monthStatements.reduce((sum, row) => sum + Number(row.total), 0);

    const applicable = recurring.filter(
      (item) => recurringAppliesTo(item, month) && !postedRecurringIds.has(item.id),
    );

    // Fixo pago no cartão já aparece na fatura depois de lançado — mas
    // enquanto não é lançado, ele não está em lugar nenhum. Some aqui.
    const recurringExpense = applicable
      .filter((item) => item.type === 'expense')
      .reduce((sum, item) => sum + Number(item.amount), 0);

    const recurringIncome = applicable
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + Number(item.amount), 0);

    return {
      month,
      statements: monthStatements,
      cardTotal,
      recurringExpense,
      recurringIncome,
      committed: cardTotal + recurringExpense,
    };
  });
}
