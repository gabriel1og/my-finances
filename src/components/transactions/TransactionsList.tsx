'use client';

import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { TxRow } from '@/components/ui/TxRow';
import type { Category, TransactionType, TransactionWithCategory } from '@/types/database.types';

type Filter = TransactionType | 'all';

export function TransactionsList({
  transactions,
  categories,
}: {
  transactions: TransactionWithCategory[];
  categories: Category[];
}) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<Filter>('all');
  const [categoryId, setCategoryId] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (type !== 'all' && tx.type !== type) return false;
      if (categoryId && tx.category_id !== categoryId) return false;
      if (term && !tx.description.toLowerCase().includes(term)) return false;
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
          filtered.map((tx) => (
            // updated_at na key remonta a linha após uma edição, descartando o
            // estado local do modal.
            <TxRow key={`${tx.id}-${tx.updated_at}`} tx={tx} categories={categories} />
          ))
        ) : (
          <EmptyState message="Nenhuma transação encontrada." />
        )}
      </div>
    </>
  );
}
