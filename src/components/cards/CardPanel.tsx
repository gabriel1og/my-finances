'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useState, useTransition } from 'react';
import { CardFormModal } from '@/components/cards/CardFormModal';
import { PayStatementForm } from '@/components/cards/PayStatementForm';
import { UpcomingStatements } from '@/components/cards/UpcomingStatements';
import { archiveCard, deleteCard, restoreCard } from '@/app/(app)/cards/actions';
import { formatDate } from '@/lib/format';
import { dueDateFor } from '@/lib/statements';
import { useMoney } from '@/lib/currency';
import type { Account, CardStatement, CardStatementItem, CreditCard } from '@/types/database.types';

export function CardPanel({
  card,
  accounts,
  statement,
  items,
  upcoming = [],
  month,
}: {
  card: CreditCard;
  accounts: Account[];
  statement: CardStatement | null;
  items: CardStatementItem[];
  /** Faturas dos próximos meses que já têm valor. Vazio: a faixa não aparece. */
  upcoming?: CardStatement[];
  month: string;
}) {
  const money = useMoney();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = statement ? Number(statement.total) : 0;
  const paid = statement ? Number(statement.paid) : 0;
  const open = statement ? Number(statement.open_amount) : 0;
  const usedPct = card.credit_limit > 0 ? (total / Number(card.credit_limit)) * 100 : 0;

  // Sem linha na view ainda: a regra mora em lib/statements, espelhando a
  // migration 0017. Não recalcular aqui.
  const dueDate = statement?.due_date ?? dueDateFor(month, card.due_day);

  const account = accounts.find((item) => item.id === card.account_id);
  const statementHref = `/cards/${card.id}?month=${month.slice(0, 7)}-01` as Route;

  function run(action: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className={`card flex h-full flex-col ${card.is_archived ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <span className="flex items-center gap-2 text-sm text-textPrimary">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: card.color }} />
            {card.name}
            {card.is_archived ? <span className="label-caps text-textMuted">arquivado</span> : null}
          </span>
          <p className="mt-0.5 text-xs text-textSecondary">
            {card.brand ? `${card.brand} · ` : ''}paga por {account?.name ?? '—'}
          </p>
        </div>

        <div className="text-right">
          <p className="num text-2xs text-textMuted">
            fecha dia {card.closing_day} · vence dia {card.due_day}
          </p>
          <p className="num text-2xs text-textSecondary">venc. {formatDate(dueDate)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <span className="label-caps">Fatura do mês</span>
        <span className={`num text-xl tracking-tight ${open > 0 ? 'text-expense' : 'text-income'}`}>
          {money(open > 0 ? open : total)}
        </span>
      </div>

      {card.is_archived && open > 0 ? (
        <p className="mt-2 text-2xs text-warning">
          Cartão arquivado com fatura em aberto. Você ainda pode registrar o pagamento.
        </p>
      ) : null}

      {paid > 0 ? (
        <p className="num mt-1 text-2xs text-income">
          {money(paid)} já pago de {money(total)}
        </p>
      ) : null}

      {Number(card.credit_limit) > 0 ? (
        <>
          <div className="mt-3 h-1 w-full overflow-hidden rounded-sm bg-surfaceAlt">
            <div
              className="h-1 origin-left animate-barGrow rounded-sm"
              style={{
                width: `${Math.min(usedPct, 100)}%`,
                backgroundColor: usedPct >= 85 ? '#F5A623' : card.color,
              }}
            />
          </div>
          <p className="num mt-1 text-2xs text-textMuted">
            {money(total)} de {money(Number(card.credit_limit))} do limite
          </p>
        </>
      ) : null}

      {items.length ? (
        <div className="mt-3 border-t border-border pt-2">
          {items.slice(0, 4).map((item) => (
            <div key={item.transaction_id} className="flex items-center justify-between py-1">
              <span className="truncate pr-2 text-xs text-textSecondary">{item.description}</span>
              <span className="num shrink-0 text-xs text-textPrimary">
                {money(Number(item.amount))}
              </span>
            </div>
          ))}
          {/* O card mostra os quatro primeiros; o resto da fatura tem página
              própria, em vez de ficar só como um contador sem saída. */}
          <Link
            href={statementHref}
            className="mt-1 inline-block text-2xs text-accent transition-opacity hover:opacity-80"
          >
            {items.length > 4
              ? `Ver os ${items.length} lançamentos da fatura`
              : 'Ver fatura completa'}
          </Link>
        </div>
      ) : (
        <p className="mt-3 border-t border-border pt-3 text-xs text-textMuted">
          Nenhuma compra nesta fatura.
        </p>
      )}

      {/* Rodapé preso à base do card: as prévias de lançamentos e a faixa
          de próximas faturas têm alturas diferentes de um cartão para
          outro, e sem isto a linha de ações de cada card parava numa
          altura, desalinhando a grade. */}
      <div className="mt-auto">
        <UpcomingStatements cardId={card.id} statements={upcoming} />

        {paying ? (
          <PayStatementForm
            card={card}
            account={account}
            month={month}
            suggested={open > 0 ? open : total}
            onDone={() => setPaying(false)}
            onCancel={() => setPaying(false)}
          />
        ) : null}

        {error ? <p className="mt-2 text-xs text-expense">{error}</p> : null}

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs">
          {open > 0 ? (
            <button
              onClick={() => setPaying((value) => !value)}
              className="text-accent transition-opacity hover:opacity-80"
            >
              Pagar fatura
            </button>
          ) : null}

          <Link
            href={statementHref}
            className="text-textSecondary transition-colors hover:text-textPrimary"
          >
            Ver fatura
          </Link>

          <CardFormModal
            accounts={accounts}
            card={card}
            trigger={
              <button className="text-textSecondary transition-colors hover:text-textPrimary">
                Editar
              </button>
            }
          />

          {card.is_archived ? (
            <>
              <button
                disabled={pending}
                onClick={() => run(() => restoreCard(card.id))}
                className="text-textSecondary transition-colors hover:text-income"
              >
                Restaurar
              </button>
              <button
                disabled={pending}
                onClick={() => run(() => deleteCard(card.id))}
                className="ml-auto text-textMuted transition-colors hover:text-expense"
              >
                Excluir
              </button>
            </>
          ) : (
            <button
              disabled={pending}
              onClick={() => run(() => archiveCard(card.id))}
              className="ml-auto text-textMuted transition-colors hover:text-warning"
            >
              Arquivar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
