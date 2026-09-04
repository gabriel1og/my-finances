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
 * O desenho é de duas linhas empilhadas, e não de colunas: a coluna fixa de
 * valor mais as ações no meio não deixavam largura para a descrição no
 * celular, e "TotalP…" não identifica lançamento nenhum. Agora cada linha tem
 * um texto que trunca (`min-w-0` no container, sem o qual `truncate` nunca
 * dispara) e um dado curto à direita que não quebra. As tags ficam numa
 * terceira linha, só quando existem: elas são o único conteúdo variável que
 * não cabe na disputa por largura.
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

  function remove(scope: 'one' | 'group', closeMenu: () => void) {
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
        closeMenu();
      }
    });
  }

  const hasGroup = Boolean(tx.installment_group || tx.transfer_group);

  return (
    <div className="row-divider">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm ${
            isIncome ? 'bg-incomeDim text-income' : 'bg-expenseDim text-expense'
          }`}
          aria-hidden
        >
          {isIncome ? '↑' : '↓'}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="min-w-0 flex-1 truncate text-sm text-textPrimary">{tx.description}</p>

            {showInstallment && tx.installment_no && tx.installment_total ? (
              <span
                title={`Parcela ${tx.installment_no} de ${tx.installment_total}`}
                className="money shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-3xs leading-tight text-textSecondary"
              >
                {tx.installment_no}/{tx.installment_total}
              </span>
            ) : null}

            {/* Sinal e valor na mesma string, sem espaço quebrável entre eles. */}
            <p className={`money shrink-0 text-sm ${isIncome ? 'text-income' : 'text-expense'}`}>
              {isIncome ? '+' : '−'}&nbsp;{money(tx.amount)}
            </p>
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

            <p className="money shrink-0 text-2xs text-textMuted">{formatDate(tx.date)}</p>
          </div>

          {/* Linha própria: disputando espaço com a categoria, os chips a
              faziam encolher até "T…" nas telas de 320px — e categoria é a
              informação de que a linha não abre mão. */}
          {tx.tags?.length ? (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {tx.tags.map((tag) => (
                <TagChip key={tag.id} name={tag.name} color={tag.color} />
              ))}
            </div>
          ) : null}
        </div>

        {categories ? (
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
        ) : null}
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
