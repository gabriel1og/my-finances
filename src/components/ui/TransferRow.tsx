'use client';

import { useState, useTransition } from 'react';
import { deleteTransfer } from '@/app/(app)/transactions/actions';
import { TransferModal } from '@/components/accounts/TransferModal';
import { useMoney } from '@/lib/currency';
import { formatDate } from '@/lib/format';
import type { Entry } from '@/lib/transactions';
import type { Account } from '@/types/database.types';

/**
 * As duas pontas de uma transferência numa linha só. O valor fica em
 * textSecondary, sem + nem −: não é receita nem despesa, o dinheiro só mudou
 * de conta.
 */
export function TransferRow({
  entry,
  editable = false,
  accounts = [],
}: {
  entry: Extract<Entry, { kind: 'transfer' }>;
  editable?: boolean;
  accounts?: Account[];
}) {
  const money = useMoney();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteTransfer(entry.group);
      if (result.error) {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  return (
    <div className="group row-divider">
      <div className="flex items-center gap-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surfaceAlt text-sm text-textSecondary"
          aria-hidden
        >
          ⇄
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-textPrimary">{entry.description}</p>
          <p className="text-xs text-textSecondary">
            Transferência
            {entry.from && entry.to ? ` · ${entry.from} → ${entry.to}` : ''}
          </p>
        </div>

        {editable ? (
          <div className="flex items-center gap-3 text-xs opacity-100 transition-opacity focus-within:opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
            {confirming ? (
              <>
                <span className="text-textSecondary">Excluir os dois lados?</span>
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
                {entry.fromId && entry.toId ? (
                  <TransferModal
                    accounts={accounts}
                    transfer={{
                      group: entry.group,
                      fromAccountId: entry.fromId,
                      toAccountId: entry.toId,
                      amount: entry.amount,
                      date: entry.date,
                      description: entry.description,
                    }}
                    trigger={
                      <button className="text-textSecondary transition-colors hover:text-textPrimary">
                        Editar
                      </button>
                    }
                  />
                ) : null}
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

        <div className="w-24 shrink-0 text-right sm:w-32">
          <p className="num text-sm text-textSecondary">{money(entry.amount)}</p>
          <p className="num text-2xs text-textMuted">{formatDate(entry.date)}</p>
        </div>
      </div>

      {error ? <p className="mt-1 pl-11 text-xs text-expense">{error}</p> : null}
    </div>
  );
}
