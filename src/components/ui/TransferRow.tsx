'use client';

import { useState, useTransition } from 'react';
import { deleteTransfer } from '@/app/(app)/transactions/actions';
import { TransferModal } from '@/components/accounts/TransferModal';
import { useMoney } from '@/lib/currency';
import { formatDate } from '@/lib/format';
import { RowMenu, RowMenuItem, RowMenuNote } from '@/components/ui/RowMenu';
import type { Entry } from '@/lib/transactions';
import type { Account } from '@/types/database.types';

/**
 * As duas pontas de uma transferência numa linha só. O valor fica em
 * textSecondary, sem + nem −: não é receita nem despesa, o dinheiro só mudou
 * de conta.
 *
 * Mesmo desenho de duas linhas do `TxRow` — as duas convivem na mesma lista e
 * precisam alinhar.
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
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(closeMenu: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await deleteTransfer(entry.group);
      if (result.error) {
        setError(result.error);
        setConfirming(false);
        closeMenu();
      }
    });
  }

  const canEdit = Boolean(entry.fromId && entry.toId);

  return (
    <div className="row-divider">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surfaceAlt text-sm text-textSecondary"
          aria-hidden
        >
          ⇄
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="min-w-0 flex-1 truncate text-sm text-textPrimary">{entry.description}</p>
            <p className="money shrink-0 text-sm text-textSecondary">{money(entry.amount)}</p>
          </div>

          <div className="mt-0.5 flex items-baseline gap-2">
            <p className="min-w-0 flex-1 truncate text-xs text-textSecondary">
              Transferência
              {entry.from && entry.to ? ` · ${entry.from} → ${entry.to}` : ''}
            </p>
            <p className="money shrink-0 text-2xs text-textMuted">{formatDate(entry.date)}</p>
          </div>
        </div>

        {editable ? (
          <RowMenu label={`Ações de ${entry.description}`}>
            {(close) =>
              confirming ? (
                <>
                  <RowMenuNote>Apaga as duas pontas da transferência.</RowMenuNote>
                  <RowMenuItem tone="danger" disabled={pending} onClick={() => remove(close)}>
                    {pending ? 'Excluindo...' : 'Sim'}
                  </RowMenuItem>
                  <RowMenuItem
                    onClick={() => {
                      setConfirming(false);
                      close();
                    }}
                  >
                    Não
                  </RowMenuItem>
                </>
              ) : (
                <>
                  {canEdit ? (
                    <RowMenuItem
                      onClick={() => {
                        close();
                        setEditing(true);
                      }}
                    >
                      Editar
                    </RowMenuItem>
                  ) : null}
                  <RowMenuItem tone="danger" onClick={() => setConfirming(true)}>
                    Excluir
                  </RowMenuItem>
                </>
              )
            }
          </RowMenu>
        ) : null}
      </div>

      {error ? <p className="mt-1 pl-11 text-xs text-expense">{error}</p> : null}

      {editable && canEdit ? (
        <TransferModal
          accounts={accounts}
          transfer={{
            group: entry.group,
            fromAccountId: entry.fromId!,
            toAccountId: entry.toId!,
            amount: entry.amount,
            date: entry.date,
            description: entry.description,
          }}
          open={editing}
          onOpenChange={setEditing}
        />
      ) : null}
    </div>
  );
}
