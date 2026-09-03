'use client';

import type { CategoryMapping, OriginMapping } from '@/app/(app)/settings/import/actions';
import { ACCOUNT_KIND_LABEL } from '@/lib/constants';
import { normalizeName } from '@/lib/import/plan';
import type { ImportPlan } from '@/lib/import/types';
import type { Account, AccountKind, Category, CreditCard, Tag } from '@/types/database.types';

/**
 * Onde cada nome do arquivo cai no flowly. Um select por nome: as entidades
 * existentes primeiro, "Criar" no fim. O que o arquivo chama de "Itaú" pode
 * ser a conta e o cartão ao mesmo tempo — por isso a chave é tipo + nome, e
 * cada um aparece na sua lista.
 */
export function MappingPanel({
  plan,
  accounts,
  cards,
  categories,
  tags,
  origins,
  onOriginChange,
  cats,
  onCategoryChange,
}: {
  plan: ImportPlan;
  accounts: Account[];
  cards: CreditCard[];
  categories: Category[];
  tags: Tag[];
  origins: Record<string, OriginMapping>;
  onOriginChange: (key: string, next: OriginMapping) => void;
  cats: Record<string, CategoryMapping>;
  onCategoryChange: (key: string, next: CategoryMapping) => void;
}) {
  const existingTags = new Set(tags.map((tag) => normalizeName(tag.name)));
  const newTags = plan.tags.filter((tag) => !existingTags.has(normalizeName(tag)));
  const newAccountOrigins = plan.origins.filter(
    (origin) => origin.kind === 'account' && origins[origin.key]?.target === 'new',
  );

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
      {/* Contas e cartões */}
      <section className="card">
        <span className="label-caps">Contas e cartões</span>
        <p className="mt-1 text-xs text-textSecondary">
          Compras no crédito procuram um cartão; o resto, uma conta.
        </p>

        {plan.origins.length === 0 ? (
          <p className="mt-4 text-xs text-textMuted">O arquivo não cita contas nem cartões.</p>
        ) : (
          <ul className="mt-3">
            {plan.origins.map((origin) => {
              const mapping = origins[origin.key];
              if (!mapping) return null;
              const list = origin.kind === 'account' ? accounts : cards;
              const selectId = `origin-${origin.key}`;

              return (
                <li key={origin.key} className="row-divider">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <label htmlFor={selectId} className="block truncate text-sm text-textPrimary">
                        {origin.name}
                      </label>
                      <p className="text-2xs text-textMuted">
                        {origin.kind === 'account' ? 'conta' : 'cartão'} ·{' '}
                        <span className="num">{origin.uses}</span>{' '}
                        {origin.uses === 1 ? 'linha' : 'linhas'}
                      </p>
                    </div>
                    <select
                      id={selectId}
                      value={mapping.target}
                      onChange={(event) =>
                        onOriginChange(origin.key, { ...mapping, target: event.target.value })
                      }
                      className="select-base w-full sm:w-56"
                    >
                      {list.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name}
                        </option>
                      ))}
                      <option value="new">Criar &ldquo;{origin.name}&rdquo;</option>
                    </select>
                  </div>

                  {mapping.target === 'new' && origin.kind === 'account' ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 pl-0 sm:pl-3">
                      <label htmlFor={`${selectId}-kind`} className="text-2xs text-textSecondary">
                        Tipo da conta nova
                      </label>
                      <select
                        id={`${selectId}-kind`}
                        value={mapping.accountKind ?? 'checking'}
                        onChange={(event) =>
                          onOriginChange(origin.key, {
                            ...mapping,
                            accountKind: event.target.value as AccountKind,
                          })
                        }
                        className="select-base w-full sm:w-44"
                      >
                        {(Object.keys(ACCOUNT_KIND_LABEL) as AccountKind[]).map((kind) => (
                          <option key={kind} value={kind}>
                            {ACCOUNT_KIND_LABEL[kind]}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {mapping.target === 'new' && origin.kind === 'card' ? (
                    <NewCardFields
                      id={selectId}
                      mapping={mapping}
                      accounts={accounts}
                      newAccounts={newAccountOrigins.map((entry) => ({
                        key: entry.key,
                        name: entry.name,
                      }))}
                      onChange={(next) => onOriginChange(origin.key, next)}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Categorias */}
      <section className="card">
        <span className="label-caps">Categorias</span>
        <p className="mt-1 text-xs text-textSecondary">
          O tipo (receita ou despesa) vem de como o arquivo usa cada uma. Transferências e
          pagamentos de fatura não têm categoria.
        </p>

        {plan.categories.length === 0 ? (
          <p className="mt-4 text-xs text-textMuted">O arquivo não cita categorias.</p>
        ) : (
          <ul className="mt-3">
            {plan.categories.map((category) => {
              const mapping = cats[category.key];
              if (!mapping) return null;
              const selectId = `category-${category.key}`;
              const sameKind = categories.filter((entry) => entry.kind === category.kind);
              const otherKind = categories.filter((entry) => entry.kind !== category.kind);

              return (
                <li key={category.key} className="row-divider">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <label htmlFor={selectId} className="block truncate text-sm text-textPrimary">
                        {category.name}
                      </label>
                      <p className="text-2xs text-textMuted">
                        <span
                          className={category.kind === 'income' ? 'text-income' : 'text-expense'}
                        >
                          {category.kind === 'income' ? 'receita' : 'despesa'}
                        </span>{' '}
                        · <span className="num">{category.uses}</span>{' '}
                        {category.uses === 1 ? 'linha' : 'linhas'}
                        {category.mixed ? (
                          <span className="text-warning"> · usada nos dois tipos no arquivo</span>
                        ) : null}
                      </p>
                    </div>
                    <select
                      id={selectId}
                      value={mapping.target}
                      onChange={(event) =>
                        onCategoryChange(category.key, { ...mapping, target: event.target.value })
                      }
                      className="select-base w-full sm:w-56"
                    >
                      {sameKind.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name}
                        </option>
                      ))}
                      {otherKind.length > 0 ? (
                        <optgroup label={category.kind === 'income' ? 'Despesa' : 'Receita'}>
                          {otherKind.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.name}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                      <option value="new">Criar &ldquo;{category.name}&rdquo;</option>
                      <option value="none">Sem categoria</option>
                    </select>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {plan.tags.length > 0 ? (
          <p className="mt-4 border-t border-border pt-3 text-2xs text-textMuted">
            Tags no arquivo: {plan.tags.join(', ')}.
            {newTags.length > 0 ? ` Serão criadas: ${newTags.join(', ')}.` : ' Todas já existem.'}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function NewCardFields({
  id,
  mapping,
  accounts,
  newAccounts,
  onChange,
}: {
  id: string;
  mapping: OriginMapping;
  accounts: Account[];
  newAccounts: { key: string; name: string }[];
  onChange: (next: OriginMapping) => void;
}) {
  const card = mapping.card ?? { accountTarget: '', closingDay: 0, dueDay: 0 };
  const set = (patch: Partial<typeof card>) =>
    onChange({ ...mapping, card: { ...card, ...patch } });
  const dayValue = (day: number) => (day > 0 ? String(day) : '');
  const parseDay = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 2);
    return digits === '' ? 0 : Number(digits);
  };

  return (
    <div className="mt-2 grid grid-cols-2 gap-2 pl-0 sm:grid-cols-[1fr_auto_auto] sm:pl-3">
      <div className="col-span-2 sm:col-span-1">
        <label htmlFor={`${id}-account`} className="text-2xs text-textSecondary">
          Conta que paga a fatura
        </label>
        <select
          id={`${id}-account`}
          value={card.accountTarget}
          onChange={(event) => set({ accountTarget: event.target.value })}
          className="select-base mt-1"
        >
          <option value="">Escolha…</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
          {newAccounts.length > 0 ? (
            <optgroup label="Contas novas deste arquivo">
              {newAccounts.map((account) => (
                <option key={account.key} value={account.key}>
                  {account.name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-closing`} className="text-2xs text-textSecondary">
          Fechamento
        </label>
        <input
          id={`${id}-closing`}
          inputMode="numeric"
          placeholder="dia"
          value={dayValue(card.closingDay)}
          onChange={(event) => set({ closingDay: parseDay(event.target.value) })}
          className="input-base num mt-1 w-full sm:w-20"
        />
      </div>
      <div>
        <label htmlFor={`${id}-due`} className="text-2xs text-textSecondary">
          Vencimento
        </label>
        <input
          id={`${id}-due`}
          inputMode="numeric"
          placeholder="dia"
          value={dayValue(card.dueDay)}
          onChange={(event) => set({ dueDay: parseDay(event.target.value) })}
          className="input-base num mt-1 w-full sm:w-20"
        />
      </div>
    </div>
  );
}
