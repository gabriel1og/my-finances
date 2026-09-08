'use client';

import { EmptyState } from '@/components/ui/EmptyState';
import { TransferRow } from '@/components/ui/TransferRow';
import { TxRow } from '@/components/ui/TxRow';
import { useMoney } from '@/lib/currency';
import { groupTransfers, totalTransactionEntries } from '@/lib/transactions';
import type {
  Account,
  Category,
  CreditCard,
  Tag,
  TransactionWithCategory,
} from '@/types/database.types';

/**
 * Só renderiza: filtro e paginação acontecem no servidor, via URL. O
 * agrupamento de transferências continua aqui porque depende do par carregado.
 */
export function TransactionsList({
  transactions,
  categories,
  accounts,
  cards,
  tags,
}: {
  transactions: TransactionWithCategory[];
  categories: Category[];
  accounts: Account[];
  cards: CreditCard[];
  tags: Tag[];
}) {
  const money = useMoney();
  const entries = groupTransfers(transactions);
  const total = totalTransactionEntries(entries);
  const totalTone =
    total > 0 ? 'text-income' : total < 0 ? 'text-expense' : 'text-textSecondary';

  return (
    <div className="card">
      {entries.length ? (
        <>
          {entries.map((entry) =>
            entry.kind === 'transfer' ? (
              <TransferRow
                key={`${entry.key}-${entry.tx.updated_at}`}
                entry={entry}
                editable
                accounts={accounts}
              />
            ) : (
              <TxRow
                key={`${entry.key}-${entry.tx.updated_at}`}
                tx={entry.tx}
                categories={categories}
                accounts={accounts}
                cards={cards}
                tags={tags}
              />
            ),
          )}

          <div className="flex items-center justify-end gap-3 pt-3 text-right">
            <span className="text-xs text-textMuted">Total</span>
            <span className={`money text-sm font-medium ${totalTone}`}>{money(total)}</span>
          </div>
        </>
      ) : (
        <EmptyState message="Nenhuma transação encontrada com esses filtros." />
      )}
    </div>
  );
}
