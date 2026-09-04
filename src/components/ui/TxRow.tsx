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
import { RowMenu, RowMenuItem, RowMenuNote } from '@/components/ui/RowMenu';
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
 *
 * Duas leituras, com a virada em `lg` — a mesma do resto do app:
 *
 * - A partir de `lg` o desenho é o de sempre: coluna fixa de valor à direita,
 *   tags na linha do título, ações em texto reveladas no hover. Com 1024px ou
 *   mais há largura para as três coisas, e é a coluna fixa que alinha os
 *   valores de uma linha para a outra.
 * - Abaixo dela nada disso cabia: a coluna de valor mais as ações no meio não
 *   deixavam largura para a descrição, e "TotalP…" não identifica lançamento
 *   nenhum. Ali o conteúdo empilha em duas linhas — cada uma com um texto que
 *   trunca (`min-w-0` no container, sem o qual `truncate` nunca dispara) e um
 *   dado curto à direita que não quebra — e as ações saem do fluxo, atrás de
 *   um alvo de 44px.
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
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(scope: 'one' | 'group', closeMenu?: () => void) {
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
        // O erro aparece na linha, não no painel: deixá-lo aberto esconderia
        // justamente a mensagem.
        closeMenu?.();
      }
    });
  }

  const hasGroup = Boolean(tx.installment_group || tx.transfer_group);
  const tone = isIncome ? 'text-income' : 'text-expense';
  // Sinal e valor numa string só, com espaço inquebrável entre eles: soltos, o
  // "−" caía numa linha e o valor na seguinte assim que a coluna apertava.
  const amount = `${isIncome ? '+' : '−'} ${money(tx.amount)}`;

  const chips = tx.tags?.length
    ? tx.tags.map((tag) => <TagChip key={tag.id} name={tag.name} color={tag.color} />)
    : null;

  return (
    <div className="row-divider group">
      <div className="flex items-start gap-3 lg:items-center">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm lg:mt-0 ${
            isIncome ? 'bg-incomeDim text-income' : 'bg-expenseDim text-expense'
          }`}
          aria-hidden
        >
          {isIncome ? '↑' : '↓'}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            {/* `flex-1` empurra o valor para a direita no celular; a partir de `lg` o
                valor tem coluna própria, e a descrição volta a se dimensionar pelo
                conteúdo — é o que mantém o selo e as tags colados nela. */}
            <p className="min-w-0 flex-1 truncate text-sm text-textPrimary lg:flex-initial">
              {tx.description}
            </p>

            {showInstallment && tx.installment_no && tx.installment_total ? (
              <span
                title={`Parcela ${tx.installment_no} de ${tx.installment_total}`}
                className="money shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-3xs leading-tight text-textSecondary"
              >
                {tx.installment_no}/{tx.installment_total}
              </span>
            ) : null}

            {chips ? (
              <div className="hidden shrink-0 items-center gap-1 lg:flex">{chips}</div>
            ) : null}

            <p className={`money shrink-0 text-sm lg:hidden ${tone}`}>{amount}</p>
          </div>

          <div className="mt-0.5 flex items-baseline gap-2">
            <p className="min-w-0 flex-1 truncate text-xs text-textSecondary">
              <span
                className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                style={{ backgroundColor: tx.category?.color ?? '#4A5070' }}
              />
              {tx.is_transfer ? 'Transferência' : (tx.category?.name ?? 'Sem categoria')}
              {tx.card ? ` · ${tx.card.name}` : tx.account ? ` · ${tx.account.name}` : ''}
            </p>

            <p className="money shrink-0 text-2xs text-textMuted lg:hidden">
              {formatDate(tx.date)}
            </p>
          </div>

          {/* Linha própria só no celular: disputando espaço com a categoria, os
              chips a faziam encolher até "T…" numa tela de 320px. */}
          {chips ? (
            <div className="mt-1 flex flex-wrap items-center gap-1 lg:hidden">{chips}</div>
          ) : null}
        </div>

        {categories ? (
          <>
            <div className="hidden items-center gap-3 text-xs opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 lg:flex">
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
                  <button
                    onClick={() => setEditing(true)}
                    className="text-textSecondary transition-colors hover:text-textPrimary"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setConfirming(true)}
                    className="text-textMuted transition-colors hover:text-expense"
                  >
                    Excluir
                  </button>
                </>
              )}
            </div>

            <div className="lg:hidden">
              <RowMenu label={`Ações de ${tx.description}`}>
                {(close) =>
                  confirming ? (
                    <>
                      <RowMenuNote>
                        {hasGroup
                          ? 'Este lançamento faz parte de um grupo.'
                          : 'Excluir este lançamento?'}
                      </RowMenuNote>
                      <RowMenuItem
                        tone="danger"
                        disabled={pending}
                        onClick={() => remove('one', close)}
                      >
                        {pending ? 'Excluindo...' : hasGroup ? 'Só esta' : 'Sim'}
                      </RowMenuItem>
                      {hasGroup ? (
                        <RowMenuItem
                          tone="danger"
                          disabled={pending}
                          onClick={() => remove('group', close)}
                        >
                          {tx.transfer_group ? 'Os dois lados' : 'Todas as parcelas'}
                        </RowMenuItem>
                      ) : null}
                      <RowMenuItem
                        onClick={() => {
                          setConfirming(false);
                          close();
                        }}
                      >
                        Não
                      </RowMenuItem>
                    </>
                  ) : (
                    <>
                      <RowMenuItem
                        onClick={() => {
                          close();
                          setEditing(true);
                        }}
                      >
                        Editar
                      </RowMenuItem>
                      <RowMenuItem tone="danger" onClick={() => setConfirming(true)}>
                        Excluir
                      </RowMenuItem>
                    </>
                  )
                }
              </RowMenu>
            </div>
          </>
        ) : null}

        <div className="hidden w-32 shrink-0 text-right lg:block">
          <p className={`money text-sm ${tone}`}>{amount}</p>
          <p className="money text-2xs text-textMuted">{formatDate(tx.date)}</p>
        </div>
      </div>

      {error ? <p className="mt-1 pl-11 text-xs text-expense">{error}</p> : null}

      {categories ? (
        <TransactionModal
          categories={categories}
          accounts={accounts}
          cards={cards}
          tags={tags}
          transaction={tx}
          open={editing}
          onOpenChange={setEditing}
        />
      ) : null}
    </div>
  );
}
