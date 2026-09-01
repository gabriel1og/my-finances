'use client';

import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { TransferRow } from '@/components/ui/TransferRow';
import { TxRow } from '@/components/ui/TxRow';
import { groupTransfers } from '@/lib/transactions';
import type {
  Account,
  Category,
  CreditCard,
  TransactionType,
  TransactionWithCategory,
} from '@/types/database.types';

type Filter = TransactionType | 'all' | 'transfer';

export function TransactionsList({
  transactions,
  categories,
  accounts,
  cards,
}: {
  transactions: TransactionWithCategory[];
  categories: Category[];
  accounts: Account[];
  cards: CreditCard[];
}) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<Filter>('all');
  const [categoryId, setCategoryId] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return groupTransfers(transactions).filter((entry) => {
      if (term && !entry.tx.description.toLowerCase().includes(term)) return false;

      if (entry.kind === 'transfer') {
        // Transferência não é receita nem despesa: só aparece em "Todos" ou no
        // filtro próprio, e nunca quando se filtra por categoria.
        if (type !== 'all' && type !== 'transfer') return false;
        if (categoryId) return false;
        return true;
      }

      if (type === 'transfer') return false;
      if (type !== 'all' && entry.tx.type !== type) return false;
      if (categoryId && entry.tx.category_id !== categoryId) return false;
      return true;
    });
  }, [transactions, search, type, categoryId]);

  return (
    <>
      <div className="mb-4 flex gap-3">
        <input
          className="input-base max-w-xs"
          placeholder="Buscar descrição..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input-base max-w-[150px]"
          value={type}
          onChange={(e) => setType(e.target.value as Filter)}
        >
          <option value="all">Todos</option>
          <option value="income">Receitas</option>
          <option value="expense">Despesas</option>
          <option value="transfer">Transferências</option>
        </select>
        <select
          className="input-base max-w-[180px]"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">Todas as categorias</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        {filtered.length ? (
          filtered.map((entry) =>
            entry.kind === 'transfer' ? (
              // updated_at na key remonta a linha após uma edição, como no TxRow.
              <TransferRow
                key={`${entry.key}-${entry.tx.updated_at}`}
                entry={entry}
                editable
                accounts={accounts}
              />
            ) : (
              // updated_at na key remonta a linha após uma edição, descartando
              // o estado local do modal.
              <TxRow
                key={`${entry.key}-${entry.tx.updated_at}`}
                tx={entry.tx}
                categories={categories}
                accounts={accounts}
                cards={cards}
              />
            ),
          )
        ) : (
          <EmptyState message="Nenhuma transação encontrada." />
        )}
      </div>
    </>
  );
}
