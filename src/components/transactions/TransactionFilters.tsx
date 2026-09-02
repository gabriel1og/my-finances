'use client';

import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import type { Account, Category, CreditCard, Tag } from '@/types/database.types';

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
        className="input-base max-w-xs"
        placeholder="Buscar descrição..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <select
        className="input-base max-w-[150px]"
        value={params.get('type') ?? 'all'}
        onChange={(e) => setParam('type', e.target.value === 'all' ? '' : e.target.value)}
      >
        <option value="all">Todos</option>
        <option value="income">Receitas</option>
        <option value="expense">Despesas</option>
        <option value="transfer">Transferências</option>
      </select>

      <select
        className="input-base max-w-[170px]"
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
        className="input-base max-w-[150px]"
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
        className="input-base max-w-[170px]"
        value={params.get('account') ?? params.get('card') ?? ''}
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
            {account.name}
          </option>
        ))}
        {cards.map((card) => (
          <option key={card.id} value={`card:${card.id}`}>
            {card.name}
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
    </div>
  );
}
