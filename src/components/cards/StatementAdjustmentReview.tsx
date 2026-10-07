'use client';

import { useMoney } from '@/lib/currency';
import { formatDate, formatMonthLong } from '@/lib/format';
import {
  changedStatementCycles,
  statementDueTotals,
  type StatementPreview,
} from '@/lib/statement-adjustments';

export function StatementAdjustmentReview({ preview }: { preview: StatementPreview }) {
  const money = useMoney();
  const beforeDue = statementDueTotals(preview.before);
  const afterDue = statementDueTotals(preview.after);
  const months = [...new Set([...beforeDue.keys(), ...afterDue.keys()])].sort();
  const moved = preview.after.transactions.filter((tx) => {
    const previous = preview.before.transactions.find((row) => row.id === tx.id);
    return previous && previous.statement_id !== tx.statement_id;
  });
  return (
    <section
      className="mt-4 space-y-3 rounded-md border border-border p-3"
      aria-label="Prévia do ajuste"
    >
      <h3 className="text-sm font-medium">Revise antes de salvar</h3>
      {changedStatementCycles(preview).map((cycle) => {
        const before = preview.before.cycles.find(
          (row) => row.statement_month === cycle.statement_month,
        );
        return (
          <div key={cycle.statement_month} className="border-t border-border pt-2 text-xs">
            <p className="font-medium">
              {formatMonthLong(cycle.statement_month)}
              {cycle.merged_into ? ' · incorporada' : ''}
            </p>
            <p>
              Período:{' '}
              {before
                ? `${formatDate(before.period_start)} a ${formatDate(before.closing_date)} → `
                : ''}
              {formatDate(cycle.period_start)} a {formatDate(cycle.closing_date)} (fechamento
              exclusivo)
            </p>
            <p>
              Vencimento: {before ? `${formatDate(before.due_date)} → ` : ''}
              {formatDate(cycle.due_date)}
            </p>
            <p>
              Total: {money(Number(before?.total ?? 0))} → {money(Number(cycle.total))}
            </p>
            <p>
              Pago: {money(Number(before?.paid ?? 0))} → {money(Number(cycle.paid))}
            </p>
            <p>
              Saldo: {money(Number(before?.open_amount ?? 0))} → {money(Number(cycle.open_amount))}
            </p>
          </div>
        );
      })}
      <div className="border-t border-border pt-2 text-xs">
        <p className="font-medium">Impacto na previsão mensal</p>
        {months
          .filter((month) => beforeDue.get(month) !== afterDue.get(month))
          .map((month) => (
            <p key={month}>
              {formatMonthLong(`${month}-01`)}: {money(beforeDue.get(month) ?? 0)} →{' '}
              {money(afterDue.get(month) ?? 0)}
            </p>
          ))}
      </div>
      <details className="text-xs">
        <summary>Lançamentos e pagamentos transferidos ({moved.length})</summary>
        <ul className="mt-2 space-y-1">
          {moved.map((tx) => {
            const previous = preview.before.transactions.find((row) => row.id === tx.id);
            const from = preview.before.cycles.find(
              (row) => row.statement_id === previous?.statement_id,
            );
            const to = preview.after.cycles.find((row) => row.statement_id === tx.statement_id);
            return (
              <li key={tx.id}>
                {tx.is_card_payment ? 'Pagamento · ' : ''}
                {tx.description} · {formatDate(tx.date)} · {money(Number(tx.amount))} ·{' '}
                {from?.statement_month.slice(0, 7)} → {to?.statement_month.slice(0, 7)}
              </li>
            );
          })}
        </ul>
      </details>
      <p className="text-xs text-textMuted">
        As datas das compras e os valores dos pagamentos serão preservados. Saldo negativo
        representa crédito nesta fatura.
      </p>
    </section>
  );
}
