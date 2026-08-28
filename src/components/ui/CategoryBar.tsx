import { BUDGET_ALERT_THRESHOLD } from '@/lib/constants';
import { formatCurrency, formatPercent } from '@/lib/format';

export function CategoryBar({
  name,
  color,
  spent,
  budget,
}: {
  name: string;
  color: string;
  spent: number;
  budget: number;
}) {
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
          {formatCurrency(spent)}
          {budget > 0 ? ` / ${formatCurrency(budget)}` : ''}
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
        <p className={`num mt-1 text-[11px] ${alert ? 'text-warning' : 'text-textMuted'}`}>
          {formatPercent(pct)} do limite
        </p>
      ) : null}
    </div>
  );
}
