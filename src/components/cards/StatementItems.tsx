'use client';

import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { TxRow } from '@/components/ui/TxRow';
import { useMoney } from '@/lib/currency';
import type {
  Account,
  Category,
  CreditCard,
  Tag,
  TransactionWithCategory,
} from '@/types/database.types';

/**
 * A lista completa da fatura, com busca e filtro por categoria.
 *
 * Aqui o filtro é local, e não na URL como em /transactions: a fatura já vem
 * inteira do servidor (dezenas de linhas, não milhares), então filtrar é uma
 * volta de render — não vale uma ida ao banco por tecla digitada. O mês, esse
 * sim, continua na URL: é ele que define qual fatura está na tela.
 */
export function StatementItems({
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
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');

  // Só as categorias que aparecem nesta fatura: oferecer as 12 do cadastro
  // faria o filtro devolver lista vazia na maioria das escolhas.
  const present = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>();
    for (const tx of transactions) {
      if (tx.category) seen.set(tx.category.id, { id: tx.category.id, name: tx.category.name });
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [transactions]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (categoryId === 'none' && tx.category) return false;
      if (categoryId && categoryId !== 'none' && tx.category?.id !== categoryId) return false;

      if (!term) return true;
      return (
        tx.description.toLowerCase().includes(term) ||
        (tx.notes ?? '').toLowerCase().includes(term) ||
        (tx.category?.name ?? '').toLowerCase().includes(term)
      );
    });
  }, [transactions, search, categoryId]);

  const subtotal = filtered.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const filtering = Boolean(search.trim() || categoryId);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-sm font-medium tracking-tight">Lançamentos da fatura</h2>

        <label className="sr-only" htmlFor="statement-search">
          Buscar na fatura
        </label>
        <input
          id="statement-search"
          type="search"
          className="input-base w-full sm:w-[240px]"
          placeholder="Buscar por descrição ou categoria..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <label className="sr-only" htmlFor="statement-category">
          Filtrar por categoria
        </label>
        <select
          id="statement-category"
          className="select-base w-full sm:w-auto sm:min-w-[188px]"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="">Todas as categorias</option>
          {present.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
          <option value="none">Sem categoria</option>
        </select>
      </div>

      {/* O subtotal do que está em tela: com filtro ligado, o total da fatura
          no topo deixa de responder "quanto é isso que estou vendo". */}
      <p className="num mb-2 text-2xs text-textSecondary">
        {filtered.length} de {transactions.length} lançamento
        {transactions.length === 1 ? '' : 's'} · subtotal {money(subtotal)}
        {filtering ? (
          <button
            onClick={() => {
              setSearch('');
              setCategoryId('');
            }}
            className="ml-2 text-accent transition-opacity hover:opacity-80"
          >
            Limpar filtros
          </button>
        ) : null}
      </p>

      <div className="card">
        {filtered.length ? (
          filtered.map((tx) => (
            <TxRow
              key={`${tx.id}-${tx.updated_at}`}
              tx={tx}
              categories={categories}
              accounts={accounts}
              cards={cards}
              tags={tags}
              showInstallment
            />
          ))
        ) : (
          <EmptyState
            message={
              transactions.length
                ? 'Nenhum lançamento com esses filtros.'
                : 'Nenhuma compra nesta fatura.'
            }
          />
        )}
      </div>
    </section>
  );
}
