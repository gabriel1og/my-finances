'use client';

import { EmptyState } from '@/components/ui/EmptyState';
import { TransferRow } from '@/components/ui/TransferRow';
import { TxRow } from '@/components/ui/TxRow';
import { groupTransfers } from '@/lib/transactions';
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
  const entries = groupTransfers(transactions);

  return (
    <div className="card">
      {entries.length ? (
        entries.map((entry) =>
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
        )
      ) : (
        <EmptyState message="Nenhuma transação encontrada com esses filtros." />
      )}
    </div>
  );
}
