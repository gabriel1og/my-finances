/**
 * Espelho em TypeScript das funções `day_in_month` e `statement_month` da
 * migration 0009. O banco continua sendo a fonte da verdade — isto existe para
 * a UI poder antecipar em qual fatura uma compra vai cair, e para a regra ser
 * testável sem subir Postgres.
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
