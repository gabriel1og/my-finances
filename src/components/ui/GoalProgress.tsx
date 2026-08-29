import { formatCurrency, formatPercent } from '@/lib/format';

/**
 * Duas leituras de meta, com direções opostas:
 * - 'saving' : quanto sobrou vs. meta de economia  -> barra cheia é bom (income)
 * - 'cap'    : quanto gastou vs. teto de gastos    -> barra cheia é alerta (expense)
 */
type Variant = 'saving' | 'cap';

const ALERT_AT = 85;

export function GoalProgress({
  variant,
  current,
  target,
  currency = 'BRL',
}: {
  variant: Variant;
  current: number;
  target: number | null;
  currency?: string;
}) {
  if (target === null || target <= 0) return null;

  const isSaving = variant === 'saving';
  const value = isSaving ? current : Math.max(current, 0);
  const pct = (value / target) * 100;
  const reached = isSaving ? pct >= 100 : pct >= 100;
  const nearLimit = !isSaving && pct >= ALERT_AT && pct < 100;
  const negative = isSaving && current < 0;

  const barColor = isSaving
    ? negative
      ? '#F05C5C'
      : '#2ECC9A'
    : reached
      ? '#F05C5C'
      : nearLimit
        ? '#F5A623'
        : '#5B6EF5';

  const width = negative ? 0 : Math.min(Math.abs(pct), 100);

  const label = isSaving ? 'Meta de economia' : 'Teto de gastos';
  const remaining = isSaving ? target - current : target - current;

  let caption: string;
  if (negative) {
    caption = `Mês no vermelho em ${formatCurrency(Math.abs(current), currency)}`;
  } else if (isSaving) {
    caption = reached
      ? `Meta batida — ${formatCurrency(current - target, currency)} acima`
      : `Faltam ${formatCurrency(remaining, currency)}`;
  } else {
    caption = reached
      ? `Teto estourado em ${formatCurrency(current - target, currency)}`
      : `Restam ${formatCurrency(remaining, currency)} para gastar`;
  }

  const captionTone = negative || (!isSaving && reached)
    ? 'text-expense'
    : nearLimit
      ? 'text-warning'
      : isSaving && reached
        ? 'text-income'
        : 'text-textSecondary';

  return (
    <div className="card">
      <div className="flex items-baseline justify-between">
        <span className="label-caps">{label}</span>
        <span className="num text-xs text-textSecondary">
          {formatCurrency(Math.max(current, 0), currency)} / {formatCurrency(target, currency)}
        </span>
      </div>

      <div className="mt-3 h-1 w-full overflow-hidden rounded-sm bg-surfaceAlt">
        <div
          className="h-1 origin-left animate-barGrow rounded-sm"
          style={{ width: `${width}%`, backgroundColor: barColor }}
        />
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <span className={`text-xs ${captionTone}`}>{caption}</span>
        <span className={`num text-[11px] ${captionTone}`}>
          {negative ? '—' : formatPercent(pct)}
        </span>
      </div>
    </div>
  );
}
