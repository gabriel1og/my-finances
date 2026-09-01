'use client';

import { useMoney } from '@/lib/currency';
import { formatDate } from '@/lib/format';
import type { ForecastMonth } from '@/lib/forecast';

function monthLabel(month: string): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    new Date(`${month.slice(0, 7)}-01T12:00:00`),
  );
}

export function ForecastMonthCard({
  data,
  isCurrent,
  maxCommitted,
}: {
  data: ForecastMonth;
  isCurrent: boolean;
  maxCommitted: number;
}) {
  const money = useMoney();
  const share = maxCommitted > 0 ? (data.committed / maxCommitted) * 100 : 0;
  const net = data.recurringIncome - data.committed;

  return (
    <div className="card">
      <div className="flex items-baseline justify-between">
        <span className="label-caps">
          {monthLabel(data.month)}
          {isCurrent ? ' · atual' : ''}
        </span>
        <span className="num text-lg text-expense">{money(data.committed)}</span>
      </div>

      {/* Barra comparativa entre os meses: mostra onde o peso se concentra. */}
      <div className="mt-3 h-1 w-full overflow-hidden rounded-sm bg-surfaceAlt">
        <div
          className="h-1 origin-left animate-barGrow rounded-sm bg-expense"
          style={{ width: `${Math.min(share, 100)}%` }}
        />
      </div>

      <div className="mt-3 space-y-1.5">
        {data.statements.length ? (
          data.statements.map((statement) => (
            <div key={statement.card_id} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs text-textSecondary">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: statement.color }}
                />
                {statement.name}
                <span className="num text-[11px] text-textMuted">
                  venc. {formatDate(statement.due_date)}
                </span>
              </span>
              <span className="num text-xs text-textPrimary">{money(Number(statement.total))}</span>
            </div>
          ))
        ) : (
          <p className="text-xs text-textMuted">Nenhuma fatura neste mês.</p>
        )}

        {data.recurringExpense > 0 ? (
          <div className="flex items-center justify-between border-t border-border pt-1.5">
            <span className="text-xs text-textSecondary">Fixos previstos</span>
            <span className="num text-xs text-textPrimary">{money(data.recurringExpense)}</span>
          </div>
        ) : null}

        {data.recurringIncome > 0 ? (
          <div className="flex items-center justify-between">
            <span className="text-xs text-textSecondary">Receitas fixas</span>
            <span className="num text-xs text-income">{money(data.recurringIncome)}</span>
          </div>
        ) : null}
      </div>

      {data.recurringIncome > 0 ? (
        <p className={`num mt-3 text-[11px] ${net < 0 ? 'text-warning' : 'text-textMuted'}`}>
          {net < 0
            ? `${money(Math.abs(net))} além das receitas fixas`
            : `sobra prevista ${money(net)}`}
        </p>
      ) : null}
    </div>
  );
}
