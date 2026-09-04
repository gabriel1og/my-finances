'use client';

import { useState, useTransition } from 'react';
import { TransactionModal } from '@/components/ui/AddModal';
import {
  deleteInstallmentGroup,
  deleteTransaction,
  deleteTransfer,
} from '@/app/(app)/transactions/actions';
import { formatDate } from '@/lib/format';
import { useMoney } from '@/lib/currency';
import { TagChip } from '@/components/ui/TagChip';
import type {
  Account,
  Category,
  CreditCard,
  Tag,
  TransactionWithCategory,
} from '@/types/database.types';

/**
 * `categories` é opcional: quando informado, a linha ganha as ações de editar
 * e excluir. O dashboard usa a versão só de leitura.
 *
 * `showInstallment` liga o selo de parcela. Fica desligado por padrão porque a
 * descrição já costuma trazer o sufixo "(n/total)" — o selo existe para a
 * fatura, onde saber o que ainda vai se repetir nos próximos meses é o ponto,
 * e onde ele também cobre a parcela importada sem sufixo na descrição.
 */
export function TxRow({
  tx,
  categories,
  accounts = [],
  cards = [],
  tags = [],
  showInstallment = false,
}: {
  tx: TransactionWithCategory;
  categories?: Category[];
  accounts?: Account[];
  cards?: CreditCard[];
  tags?: Tag[];
  showInstallment?: boolean;
}) {
  const money = useMoney();
  const isIncome = tx.type === 'income';
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(scope: 'one' | 'group' = 'one') {
    setError(null);
    startTransition(async () => {
      const result =
        scope === 'group'
          ? tx.transfer_group
            ? await deleteTransfer(tx.transfer_group)
            : await deleteInstallmentGroup(tx.installment_group!)
          : await deleteTransaction(tx.id);

      if (result.error) {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  const hasGroup = Boolean(tx.installment_group || tx.transfer_group);

  return (
    <div className="row-divider group">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm ${
            isIncome ? 'bg-incomeDim text-income' : 'bg-expenseDim text-expense'
          }`}
          aria-hidden
        >
          {isIncome ? '↑' : '↓'}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm text-textPrimary">{tx.description}</p>

            {showInstallment && tx.installment_no && tx.installment_total ? (
              <span
                title={`Parcela ${tx.installment_no} de ${tx.installment_total}`}
                className="num shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-3xs leading-tight text-textSecondary"
              >
                {tx.installment_no}/{tx.installment_total}
              </span>
            ) : null}

            {tx.tags?.length ? (
              <div className="flex shrink-0 items-center gap-1">
                {tx.tags.map((tag) => (
                  <TagChip key={tag.id} name={tag.name} color={tag.color} />
                ))}
              </div>
            ) : null}
          </div>
          <p className="text-xs text-textSecondary">
            <span
              className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
              style={{ backgroundColor: tx.category?.color ?? '#4A5070' }}
            />
            {tx.is_transfer ? 'Transferência' : (tx.category?.name ?? 'Sem categoria')}
            {tx.card ? ` · ${tx.card.name}` : tx.account ? ` · ${tx.account.name}` : ''}
          </p>
        </div>

        {categories ? (
          <div className="flex items-center gap-3 text-xs opacity-100 transition-opacity focus-within:opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
            {confirming ? (
              <>
                <span className="text-textSecondary">Excluir?</span>
                <button
                  disabled={pending}
                  onClick={() => remove('one')}
                  className="text-expense transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  {pending ? '...' : hasGroup ? 'Só esta' : 'Sim'}
                </button>
                {hasGroup ? (
                  <button
                    disabled={pending}
                    onClick={() => remove('group')}
                    className="text-expense transition-opacity hover:opacity-80 disabled:opacity-50"
                  >
                    {tx.transfer_group ? 'Os dois lados' : 'Todas as parcelas'}
                  </button>
                ) : null}
                <button
                  onClick={() => setConfirming(false)}
                  className="text-textSecondary transition-colors hover:text-textPrimary"
                >
                  Não
                </button>
              </>
            ) : (
              <>
                <TransactionModal
                  categories={categories}
                  accounts={accounts}
                  cards={cards}
                  tags={tags}
                  transaction={tx}
                  trigger={
                    <button className="text-textSecondary transition-colors hover:text-textPrimary">
                      Editar
                    </button>
                  }
                />
                <button
                  onClick={() => setConfirming(true)}
                  className="text-textMuted transition-colors hover:text-expense"
                >
                  Excluir
                </button>
              </>
            )}
          </div>
        ) : null}

        <div className="w-24 shrink-0 text-right sm:w-32">
          <p className={`num text-sm ${isIncome ? 'text-income' : 'text-expense'}`}>
            {isIncome ? '+' : '−'} {money(tx.amount)}
          </p>
          <p className="num text-2xs text-textMuted">{formatDate(tx.date)}</p>
        </div>
      </div>

      {error ? <p className="mt-1 pl-11 text-xs text-expense">{error}</p> : null}
    </div>
  );
}
