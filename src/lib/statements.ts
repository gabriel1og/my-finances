/**
 * Espelho em TypeScript das funções `day_in_month` e `statement_month` da
 * migration 0009, e da regra de vencimento da view `card_statements` (0017).
 * O banco continua sendo a fonte da verdade — isto existe para a UI poder
 * antecipar em qual fatura uma compra vai cair e quando ela vence, e para a
 * regra ser testável sem subir Postgres.
 *
 * Se a regra mudar no SQL, mude aqui também: os testes cobrem os dois lados do
 * limite (véspera do fechamento e dia do fechamento).
 */

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Dia `wanted` dentro do mês de `reference`, limitado ao último dia do mês. */
export function dayInMonth(reference: string, wanted: number): string {
  const [year, month] = reference.slice(0, 10).split('-').map(Number);
  const day = Math.min(wanted, lastDayOfMonth(year, month - 1));
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Mês da fatura em que a compra cai. Dia da compra MENOR que o fechamento
 * (já grampeado ao mês) entra na fatura do próprio mês; do dia do fechamento
 * em diante, na do mês seguinte.
 */
export function statementMonth(purchaseDate: string, closingDay: number): string {
  const [year, month, day] = purchaseDate.slice(0, 10).split('-').map(Number);
  const effectiveClosing = Math.min(closingDay, lastDayOfMonth(year, month - 1));

  if (day < effectiveClosing) {
    return `${year}-${String(month).padStart(2, '0')}-01`;
  }

  const next = new Date(year, month, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Data de vencimento da fatura do mês informado. Espelha a coluna
 * `due_date` da view `card_statements` (migration 0017): a fatura de M fecha
 * no closing_day de M e vence no due_day de **M+1** — sempre, mesmo quando o
 * due_day é menor que o closing_day. O dia é grampeado ao último dia do mês
 * de vencimento, como faz `day_in_month()`.
 *
 * Serve de fallback para a UI quando o cartão ainda não tem linha na view.
 * Antes esse cálculo estava escrito à mão dentro do CardPanel — uma terceira
 * cópia da regra, sem teste e sem ninguém saber que existia.
 */
export function dueDateFor(month: string, dueDay: number): string {
  const [year, monthNumber] = month.slice(0, 7).split('-').map(Number);
  // `monthNumber` é 1-based e o Date é 0-based, então este índice já é M+1.
  const due = new Date(year, monthNumber, 1);
  const reference = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-01`;
  return dayInMonth(reference, dueDay);
}

/**
 * Mês da fatura que um pagamento quita quando a transação não traz
 * `card_payment_month` (importações anteriores à migration 0018). Espelha o
 * `coalesce` da view `card_statements`: sem o mês explícito, o pagamento vale
 * para a última fatura já fechada na data em que foi feito — ou seja, o mês
 * anterior ao que `statementMonth()` devolve.
 */
export function paymentStatementMonth(paymentDate: string, closingDay: number): string {
  const open = statementMonth(paymentDate, closingDay);
  const [year, month] = open.slice(0, 7).split('-').map(Number);
  const previous = new Date(year, month - 2, 1);
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}-01`;
}
