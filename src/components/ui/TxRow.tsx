'use client';

import { useState, useTransition } from 'react';
import { TransactionModal } from '@/components/ui/AddModal';
import {
  deleteInstallmentGroup,
  deleteTransaction,
  deleteTransfer,
} from '@/app/(app)/transactions/actions';
import { formatDate } from '@/lib/format';
import { useMoney } from '@/lib/currency';
import type {
  Account,
  Category,
  CreditCard,
  TransactionWithCategory,
} from '@/types/database.types';

/**
 * `categories` é opcional: quando informado, a linha ganha as ações de editar
 * e excluir. O dashboard usa a versão só de leitura.
 */
export function TxRow({
  tx,
  categories,
  accounts = [],
  cards = [],
}: {
  tx: TransactionWithCategory;
  categories?: Category[];
  accounts?: Account[];
  cards?: CreditCard[];
}) {
  const money = useMoney();
  const isIncome = tx.type === 'income';
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(scope: 'one' | 'group' = 'one') {
    setError(null);
    startTransition(async () => {
      const result =
        scope === 'group'
          ? tx.transfer_group
            ? await deleteTransfer(tx.transfer_group)
            : await deleteInstallmentGroup(tx.installment_group!)
          : await deleteTransaction(tx.id);

      if (result.error) {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  const hasGroup = Boolean(tx.installment_group || tx.transfer_group);

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
            {tx.is_transfer ? 'Transferência' : (tx.category?.name ?? 'Sem categoria')}
            {tx.card ? ` · ${tx.card.name}` : tx.account ? ` · ${tx.account.name}` : ''}
          </p>
        </div>

        {categories ? (
          <div className="flex items-center gap-3 text-xs opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            {confirming ? (
              <>
                <span className="text-textSecondary">Excluir?</span>
                <button
                  disabled={pending}
                  onClick={() => remove('one')}
                  className="text-expense transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  {pending ? '...' : hasGroup ? 'Só esta' : 'Sim'}
                </button>
                {hasGroup ? (
                  <button
                    disabled={pending}
                    onClick={() => remove('group')}
                    className="text-expense transition-opacity hover:opacity-80 disabled:opacity-50"
                  >
                    {tx.transfer_group ? 'Os dois lados' : 'Todas as parcelas'}
                  </button>
                ) : null}
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
                  accounts={accounts}
                  cards={cards}
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
            {isIncome ? '+' : '−'} {money(tx.amount)}
          </p>
          <p className="num text-[11px] text-textMuted">{formatDate(tx.date)}</p>
        </div>
      </div>

      {error ? <p className="mt-1 pl-11 text-xs text-expense">{error}</p> : null}
    </div>
  );
}
