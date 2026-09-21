'use client';

import { useState } from 'react';
import { getAccountBalanceHistory } from '@/app/(app)/accounts/actions';
import { useMoney } from '@/lib/currency';
import { formatTimestampDateTime } from '@/lib/format';
import { Modal } from '@/components/ui/Modal';
import type {
  Account,
  AccountBalanceHistory,
  AccountBalanceHistoryKind,
} from '@/types/database.types';

const HISTORY_KIND_LABELS: Record<AccountBalanceHistoryKind, string> = {
  account_created: 'Conta criada',
  opening_balance_updated: 'Saldo inicial ajustado',
  transaction_created: 'Lançamento adicionado',
  transaction_updated: 'Lançamento alterado',
  transaction_deleted: 'Lançamento excluído',
  transaction_moved_out: 'Lançamento removido da conta',
  transaction_moved_in: 'Lançamento movido para a conta',
};

function HistoryEntry({ entry }: { entry: AccountBalanceHistory }) {
  const money = useMoney();
  const deltaTone = entry.delta < 0 ? 'text-expense' : 'text-income';

  return (
    <li className="relative border-l border-border pb-5 pl-5 last:pb-0">
      <span className="absolute -left-1 top-1.5 h-2 w-2 rounded-full bg-accent" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <time dateTime={entry.changed_at} className="num text-2xs text-textMuted">
            {formatTimestampDateTime(entry.changed_at)}
          </time>
          <p className="mt-1 text-xs text-textPrimary">{HISTORY_KIND_LABELS[entry.change_kind]}</p>
          <p className="mt-0.5 truncate text-2xs text-textSecondary" title={entry.description}>
            {entry.description}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="money text-xs font-medium text-textPrimary">{money(entry.balance)}</p>
          <p className={`money mt-0.5 text-2xs ${deltaTone}`}>
            {entry.delta > 0 ? '+' : ''}
            {money(entry.delta)}
          </p>
        </div>
      </div>
    </li>
  );
}

export function AccountHistoryDrawer({ account, balance }: { account: Account; balance: number }) {
  const money = useMoney();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<AccountBalanceHistory[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPage(beforeSequence?: number, replace = false) {
    setLoading(true);
    setError(null);
    const result = await getAccountBalanceHistory(account.id, beforeSequence);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setEntries((current) => (replace ? result.entries : [...(current ?? []), ...result.entries]));
    setHasMore(result.hasMore);
  }

  function openHistory() {
    setOpen(true);
    setEntries(null);
    setHasMore(false);
    void loadPage(undefined, true);
  }

  function loadMore() {
    const lastSequence = entries?.at(-1)?.sequence_no;
    if (lastSequence !== undefined) void loadPage(lastSequence);
  }

  return (
    <>
      <button
        type="button"
        onClick={openHistory}
        className="text-textSecondary transition-colors hover:text-textPrimary"
      >
        Ver histórico
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Histórico · ${account.name}`}
        placement="drawer"
      >
        <div className="mt-5 rounded-md border border-border bg-surfaceAlt p-4">
          <p className="label-caps-tight">Saldo atual</p>
          <p className="money mt-1 text-xl tracking-tight">{money(balance)}</p>
          <p className="mt-1 text-2xs text-textMuted">
            Valores abaixo representam o saldo depois de cada alteração.
          </p>
        </div>

        {entries === null && loading ? (
          <p className="mt-6 text-xs text-textSecondary" role="status">
            Carregando histórico...
          </p>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-md border border-expense/40 bg-expenseDim p-3">
            <p className="text-xs text-expense">{error}</p>
            <button
              type="button"
              onClick={() => void loadPage(undefined, true)}
              className="mt-2 text-xs text-textPrimary underline underline-offset-4"
            >
              Tentar novamente
            </button>
          </div>
        ) : null}

        {entries?.length === 0 && !loading && !error ? (
          <p className="mt-6 text-xs text-textSecondary">Nenhuma alteração registrada.</p>
        ) : null}

        {entries?.length ? (
          <ol className="mt-6">
            {entries.map((entry) => (
              <HistoryEntry key={entry.sequence_no} entry={entry} />
            ))}
          </ol>
        ) : null}

        {hasMore ? (
          <button
            type="button"
            disabled={loading}
            onClick={loadMore}
            className="btn-secondary mt-6 w-full"
          >
            {loading ? 'Carregando...' : 'Carregar alterações anteriores'}
          </button>
        ) : null}
      </Modal>
    </>
  );
}
