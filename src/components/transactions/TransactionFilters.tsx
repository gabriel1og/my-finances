'use client';

import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import type { Account, Category, CreditCard, Tag } from '@/types/database.types';

const FILTER_PARAM_KEYS = ['q', 'type', 'category', 'tag', 'account', 'card', 'scope'] as const;

function selectedAccountOrCard(params: URLSearchParams) {
  const accountId = params.get('account');
  if (accountId) return `acc:${accountId}`;

  const cardId = params.get('card');
  if (cardId) return `card:${cardId}`;

  return '';
}

function accountFilterLabel(account: Account) {
  return `Conta - ${account.name}`;
}

function cardFilterLabel(card: CreditCard) {
  return `Cartão - ${card.name}`;
}

function hasActiveTransactionFilter(params: URLSearchParams, search: string) {
  if (search.trim()) return true;
  return FILTER_PARAM_KEYS.some((key) => {
    if (key === 'type') return Boolean(params.get(key) && params.get(key) !== 'all');
    return Boolean(params.get(key));
  });
}

/**
 * Os filtros vivem na URL, não no estado local: assim a busca é feita no
 * servidor, o link pode ser compartilhado e o botão voltar funciona.
 */
export function TransactionFilters({
  categories,
  accounts,
  cards,
  tags,
  allMonths,
}: {
  categories: Category[];
  accounts: Account[];
  cards: CreditCard[];
  tags: Tag[];
  allMonths: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const accountOrCardValue = selectedAccountOrCard(params);
  const canClearFilters = hasActiveTransactionFilter(params, search);

  function push(next: URLSearchParams) {
    // Qualquer mudança de filtro volta para a primeira página.
    next.delete('page');
    startTransition(() => router.push(`${pathname}?${next.toString()}` as Route));
  }

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    push(next);
  }

  function clearFilters() {
    const next = new URLSearchParams(params.toString());
    for (const key of FILTER_PARAM_KEYS) next.delete(key);
    setSearch('');
    push(next);
  }

  // Debounce: digitar não pode disparar uma consulta por tecla.
  useEffect(() => {
    const current = params.get('q') ?? '';
    if (search === current) return;

    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (search.trim()) next.set('q', search.trim());
      else next.delete('q');
      push(next);
    }, 350);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <input
        className="input-base w-full sm:w-[260px]"
        placeholder="Buscar descrição, valor ou notas..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <select
        className="select-base w-full sm:w-auto sm:min-w-[168px]"
        value={params.get('type') ?? 'all'}
        onChange={(e) => setParam('type', e.target.value === 'all' ? '' : e.target.value)}
      >
        <option value="all">Todos</option>
        <option value="income">Receitas</option>
        <option value="expense">Despesas</option>
        <option value="transfer">Transferências</option>
      </select>

      <select
        className="select-base w-full sm:w-auto sm:min-w-[200px]"
        value={params.get('category') ?? ''}
        onChange={(e) => setParam('category', e.target.value)}
      >
        <option value="">Todas as categorias</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>

      <select
        className="select-base w-full sm:w-auto sm:min-w-[168px]"
        value={params.get('tag') ?? ''}
        onChange={(e) => setParam('tag', e.target.value)}
      >
        <option value="">Todas as tags</option>
        {tags.map((tag) => (
          <option key={tag.id} value={tag.id}>
            {tag.name}
          </option>
        ))}
      </select>

      <select
        className="select-base w-full sm:w-auto sm:min-w-[200px]"
        value={accountOrCardValue}
        onChange={(e) => {
          const value = e.target.value;
          const next = new URLSearchParams(params.toString());
          next.delete('account');
          next.delete('card');
          if (value.startsWith('acc:')) next.set('account', value.slice(4));
          if (value.startsWith('card:')) next.set('card', value.slice(5));
          push(next);
        }}
      >
        <option value="">Conta ou cartão</option>
        {accounts.map((account) => (
          <option key={account.id} value={`acc:${account.id}`}>
            {accountFilterLabel(account)}
          </option>
        ))}
        {cards.map((card) => (
          <option key={card.id} value={`card:${card.id}`}>
            {cardFilterLabel(card)}
          </option>
        ))}
      </select>

      <label className="flex cursor-pointer items-center gap-2 text-xs text-textSecondary">
        <input
          type="checkbox"
          checked={allMonths}
          onChange={(e) => setParam('scope', e.target.checked ? 'all' : '')}
          className="accent-accent"
        />
        Buscar em todos os meses
      </label>

      <button
        type="button"
        className="btn-secondary btn-sm ml-auto w-full sm:w-auto"
        disabled={!canClearFilters}
        onClick={clearFilters}
      >
        Limpar filtros
      </button>
    </div>
  );
}
