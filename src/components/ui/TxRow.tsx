import { formatCurrency, formatDate } from '@/lib/format';
import type { TransactionWithCategory } from '@/types/database.types';

export function TxRow({ tx }: { tx: TransactionWithCategory }) {
  const isIncome = tx.type === 'income';

  return (
    <div className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm ${
          isIncome ? 'bg-incomeDim text-income' : 'bg-expenseDim text-expense'
        }`}
        aria-hidden
      >
        {isIncome ? '↑' : '↓'}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-textPrimary">{tx.description}</p>
        <p className="text-xs text-textSecondary">{tx.category?.name ?? 'Sem categoria'}</p>
      </div>

      <div className="text-right">
        <p className={`num text-sm ${isIncome ? 'text-income' : 'text-expense'}`}>
          {isIncome ? '+' : '−'} {formatCurrency(tx.amount)}
        </p>
        <p className="num text-[11px] text-textMuted">{formatDate(tx.date)}</p>
      </div>
    </div>
  );
}
