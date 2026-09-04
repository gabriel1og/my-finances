'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { formatDate, formatMonthLabel, formatMonthLong } from '@/lib/format';
import { useMoney } from '@/lib/currency';
import type { CardStatement } from '@/types/database.types';

/**
 * O que as faturas dos próximos meses já carregam deste cartão.
 *
 * Não é estimativa: parcela futura é transação real com data futura, então a
 * view já produz esses meses. Cada mês leva para a fatura dele — é a mesma
 * página de /cards/[id], só que com outro mês na URL.
 *
 * Some quando não há nada à frente, em vez de ocupar espaço com zeros.
 */
export function UpcomingStatements({
  cardId,
  statements,
}: {
  cardId: string;
  statements: CardStatement[];
}) {
  const money = useMoney();
  if (statements.length === 0) return null;

  return (
    <div className="mt-3 border-t border-border pt-2">
      <span className="label-caps">Próximas faturas</span>

      <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1.5">
        {statements.map((statement) => {
          const month = `${statement.statement_month.slice(0, 7)}-01`;
          return (
            <Link
              key={month}
              href={`/cards/${cardId}?month=${month}` as Route}
              title={`Fatura de ${formatMonthLong(month)} · vence ${formatDate(statement.due_date)}`}
              className="group flex items-baseline gap-1.5"
            >
              <span className="num text-2xs uppercase text-textMuted">
                {formatMonthLabel(month)}/{month.slice(2, 4)}
              </span>
              <span className="num text-xs text-textSecondary transition-colors group-hover:text-textPrimary">
                {money(Number(statement.total))}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
