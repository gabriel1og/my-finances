'use client';

import { useState, useTransition } from 'react';
import { AccountFormModal } from '@/components/accounts/AccountFormModal';
import { archiveAccount, deleteAccount, restoreAccount } from '@/app/(app)/accounts/actions';
import { ACCOUNT_KIND_LABEL } from '@/lib/constants';
import { useMoney } from '@/lib/currency';
import type { Account, CreditCard } from '@/types/database.types';

export function AccountCard({
  account,
  balance,
  cards,
  openCardTotal,
}: {
  account: Account;
  balance: number;
  cards: CreditCard[];
  openCardTotal: number;
}) {
  const money = useMoney();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className={`card ${account.is_archived ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <span className="flex items-center gap-2 text-sm text-textPrimary">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: account.color }} />
            {account.name}
          </span>
          <p className="mt-0.5 text-xs text-textSecondary">
            {ACCOUNT_KIND_LABEL[account.kind]}
            {account.institution ? ` · ${account.institution}` : ''}
          </p>
        </div>
        {account.is_archived ? <span className="label-caps text-textMuted">arquivada</span> : null}
      </div>

      <p className={`num mt-4 text-xl tracking-tight ${balance < 0 ? 'text-expense' : 'text-textPrimary'}`}>
        {money(balance)}
      </p>

      {openCardTotal > 0 ? (
        <p className="num mt-1 text-2xs text-warning">
          {money(openCardTotal)} em faturas em aberto ·{' '}
          <span className="text-textSecondary">
            saldo previsto {money(balance - openCardTotal)}
          </span>
        </p>
      ) : null}

      {cards.length ? (
        <p className="mt-2 text-2xs text-textMuted">
          Cartões:{' '}
          {cards
            .map((card) => (card.is_archived ? `${card.name} (arquivado)` : card.name))
            .join(', ')}
        </p>
      ) : null}

      {error ? <p className="mt-2 text-xs text-expense">{error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-3 border-t border-border pt-3 text-xs">
        <AccountFormModal
          account={account}
          trigger={
            <button className="text-textSecondary transition-colors hover:text-textPrimary">
              Editar
            </button>
          }
        />

        {account.is_archived ? (
          <>
            <button
              disabled={pending}
              onClick={() => run(() => restoreAccount(account.id))}
              className="text-textSecondary transition-colors hover:text-income"
            >
              Restaurar
            </button>
            <button
              disabled={pending}
              onClick={() => run(() => deleteAccount(account.id))}
              className="ml-auto text-textMuted transition-colors hover:text-expense"
            >
              Excluir
            </button>
          </>
        ) : (
          <button
            disabled={pending}
            onClick={() => run(() => archiveAccount(account.id))}
            className="ml-auto text-textMuted transition-colors hover:text-warning"
          >
            Arquivar
          </button>
        )}
      </div>
    </div>
  );
}
