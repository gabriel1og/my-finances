'use client';

import { BUDGET_ALERT_THRESHOLD } from '@/lib/constants';
import { formatPercent } from '@/lib/format';
import { useMoney } from '@/lib/currency';

export function CategoryBar({
  name,
  color,
  spent,
  budget,
  carry = 0,
}: {
  name: string;
  color: string;
  spent: number;
  /** Já é o disponível: limite do mês + acumulado, quando há rollover. */
  budget: number;
  /** Sobra (ou estouro) herdada dos meses anteriores. 0 = sem rollover. */
  carry?: number;
}) {
  const money = useMoney();
  const pct = budget > 0 ? (spent / budget) * 100 : 0;
  const alert = pct >= BUDGET_ALERT_THRESHOLD;

  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-textPrimary">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          {name}
        </span>
        <span className={`num text-xs ${alert ? 'text-warning' : 'text-textSecondary'}`}>
          {money(spent)}
          {budget > 0 ? ` / ${money(budget)}` : ''}
        </span>
      </div>

      <div className="mt-2 h-1 w-full overflow-hidden rounded-sm bg-surfaceAlt">
        <div
          className="h-1 origin-left animate-barGrow rounded-sm"
          style={{
            width: `${Math.min(pct, 100)}%`,
            backgroundColor: alert ? '#F5A623' : color,
          }}
        />
      </div>

      {budget > 0 ? (
        <p className={`num mt-1 text-2xs ${alert ? 'text-warning' : 'text-textMuted'}`}>
          {formatPercent(pct)} do limite
        </p>
      ) : null}

      {carry !== 0 ? (
        <p className={`num mt-1 text-2xs ${carry > 0 ? 'text-income' : 'text-warning'}`}>
          {carry > 0 ? '+' : '−'}
          {money(Math.abs(carry))} acumulado de meses anteriores
          <span className="text-textMuted"> · limite do mês {money(budget - carry)}</span>
        </p>
      ) : null}
    </div>
  );
}
