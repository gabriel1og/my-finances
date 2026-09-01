'use client';

import { useState, useTransition } from 'react';
import { RecurringFormModal } from '@/components/recurring/RecurringFormModal';
import { TagChip } from '@/components/ui/TagChip';
import {
  deleteRecurring,
  postRecurring,
  setRecurringActive,
} from '@/app/(app)/recurring/actions';
import { useMoney } from '@/lib/currency';
import { dayInMonth } from '@/lib/statements';
import { formatDate } from '@/lib/format';
import type {
  Account,
  Category,
  CreditCard,
  RecurringWithRelations,
  Tag,
} from '@/types/database.types';

export function RecurringRow({
  recurring,
  month,
  posted,
  categories,
  accounts,
  cards,
  tags,
}: {
  recurring: RecurringWithRelations;
  month: string;
  posted: boolean;
  categories: Category[];
  accounts: Account[];
  cards: CreditCard[];
  tags: Tag[];
}) {
  const money = useMoney();
  const isIncome = recurring.type === 'income';
  const [posting, setPosting] = useState(false);
  const [amount, setAmount] = useState(String(recurring.amount).replace('.', ','));
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dueDate = dayInMonth(`${month.slice(0, 7)}-01`, recurring.day_of_month);

  function run(action: () => Promise<{ error: string | null }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) return setError(result.error);
      after?.();
    });
  }

  return (
    <div className={`card ${recurring.is_active ? '' : 'opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm text-textPrimary">{recurring.description}</p>
            {recurring.tags?.map((tag) => (
              <TagChip key={tag.id} name={tag.name} color={tag.color} />
            ))}
          </div>

          <p className="mt-0.5 text-xs text-textSecondary">
            {recurring.category?.name ?? 'Sem categoria'}
            {recurring.card
              ? ` · ${recurring.card.name}`
              : recurring.account
                ? ` · ${recurring.account.name}`
                : ''}
            {recurring.is_active ? '' : ' · pausado'}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className={`num text-sm ${isIncome ? 'text-income' : 'text-expense'}`}>
            {money(Number(recurring.amount))}
          </p>
          <p className="num text-[11px] text-textMuted">todo dia {recurring.day_of_month}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        {posted ? (
          <span className="num text-xs text-income">Lançado neste mês</span>
        ) : recurring.is_active ? (
          <span className="num text-xs text-warning">Pendente · {formatDate(dueDate)}</span>
        ) : (
          <span className="text-xs text-textMuted">Pausado</span>
        )}

        <div className="flex items-center gap-3 text-xs">
          {!posted && recurring.is_active ? (
            <button
              onClick={() => setPosting((value) => !value)}
              className="text-accent transition-opacity hover:opacity-80"
            >
              Lançar
            </button>
          ) : null}

          <RecurringFormModal
            categories={categories}
            accounts={accounts}
            cards={cards}
            tags={tags}
            recurring={recurring}
            trigger={
              <button className="text-textSecondary transition-colors hover:text-textPrimary">
                Editar
              </button>
            }
          />

          <button
            disabled={pending}
            onClick={() => run(() => setRecurringActive(recurring.id, !recurring.is_active))}
            className="text-textSecondary transition-colors hover:text-textPrimary"
          >
            {recurring.is_active ? 'Pausar' : 'Retomar'}
          </button>

          {confirming ? (
            <>
              <span className="text-textSecondary">Excluir?</span>
              <button
                disabled={pending}
                onClick={() => run(() => deleteRecurring(recurring.id), () => setConfirming(false))}
                className="text-expense transition-opacity hover:opacity-80"
              >
                Sim
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="text-textSecondary transition-colors hover:text-textPrimary"
              >
                Não
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="text-textMuted transition-colors hover:text-expense"
            >
              Excluir
            </button>
          )}
        </div>
      </div>

      {posting ? (
        <div className="mt-3 flex items-end gap-2 rounded-md border border-border p-3">
          <div className="flex-1">
            <label className="label-caps">Valor deste mês</label>
            <input
              className="input-base num mt-1"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <button
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  postRecurring({
                    recurringId: recurring.id,
                    month,
                    amount: Number(amount.replace(',', '.') || '0'),
                  }),
                () => setPosting(false),
              )
            }
            className="rounded-md bg-accent px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {pending ? 'Lançando...' : `Lançar em ${formatDate(dueDate)}`}
          </button>
          <button
            onClick={() => setPosting(false)}
            className="rounded-md border border-border px-3 py-2 text-xs text-textSecondary"
          >
            Cancelar
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-expense">{error}</p> : null}
    </div>
  );
}
