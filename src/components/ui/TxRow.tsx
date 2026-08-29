'use client';

import { useState, useTransition } from 'react';
import { TransactionModal } from '@/components/ui/AddModal';
import { deleteTransaction } from '@/app/(app)/transactions/actions';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Category, TransactionWithCategory } from '@/types/database.types';

/**
 * `categories` é opcional: quando informado, a linha ganha as ações de editar
 * e excluir. O dashboard usa a versão só de leitura.
 */
export function TxRow({
  tx,
  categories,
}: {
  tx: TransactionWithCategory;
  categories?: Category[];
}) {
  const isIncome = tx.type === 'income';
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteTransaction(tx.id);
      if (result.error) {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  return (
    <div className="group border-b border-border py-3 last:border-b-0">
      <div className="flex items-center gap-3">
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
          <p className="text-xs text-textSecondary">
            <span
              className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
              style={{ backgroundColor: tx.category?.color ?? '#4A5070' }}
            />
            {tx.category?.name ?? 'Sem categoria'}
          </p>
        </div>

        {categories ? (
          <div className="flex items-center gap-3 text-xs opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            {confirming ? (
              <>
                <span className="text-textSecondary">Excluir?</span>
                <button
                  disabled={pending}
                  onClick={remove}
                  className="text-expense transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  {pending ? '...' : 'Sim'}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="text-textSecondary transition-colors hover:text-textPrimary"
                >
                  Não
                </button>
              </>
            ) : (
              <>
                <TransactionModal
                  categories={categories}
                  transaction={tx}
                  trigger={
                    <button className="text-textSecondary transition-colors hover:text-textPrimary">
                      Editar
                    </button>
                  }
                />
                <button
                  onClick={() => setConfirming(true)}
                  className="text-textMuted transition-colors hover:text-expense"
                >
                  Excluir
                </button>
              </>
            )}
          </div>
        ) : null}

        <div className="w-32 shrink-0 text-right">
          <p className={`num text-sm ${isIncome ? 'text-income' : 'text-expense'}`}>
            {isIncome ? '+' : '−'} {formatCurrency(tx.amount)}
          </p>
          <p className="num text-[11px] text-textMuted">{formatDate(tx.date)}</p>
        </div>
      </div>

      {error ? <p className="mt-1 pl-11 text-xs text-expense">{error}</p> : null}
    </div>
  );
}
