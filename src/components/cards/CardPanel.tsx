'use client';

import { useState, useTransition } from 'react';
import { CardFormModal } from '@/components/cards/CardFormModal';
import { archiveCard, deleteCard, payStatement, restoreCard } from '@/app/(app)/cards/actions';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Account, CardStatement, CardStatementItem, CreditCard } from '@/types/database.types';

export function CardPanel({
  card,
  accounts,
  statement,
  items,
  month,
}: {
  card: CreditCard;
  accounts: Account[];
  statement: CardStatement | null;
  items: CardStatementItem[];
  month: string;
}) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = statement ? Number(statement.total) : 0;
  const paid = statement ? Number(statement.paid) : 0;
  const open = statement ? Number(statement.open_amount) : 0;
  const usedPct = card.credit_limit > 0 ? (total / Number(card.credit_limit)) * 100 : 0;

  // Fallback quando ainda não há linha na view: mesma regra do banco — a fatura
  // fecha no closing_day deste mês, então só vence no próprio mês quando o
  // vencimento é depois do fechamento; senão, cai no mês seguinte. O dia é
  // grampeado ao último dia do mês, como day_in_month().
  const [year, monthIndex] = month.slice(0, 7).split('-').map(Number);
  const dueMonthIndex = card.due_day > card.closing_day ? monthIndex : monthIndex + 1;
  const dueMonth = new Date(year, dueMonthIndex - 1, 1);
  const lastDay = new Date(year, dueMonthIndex, 0).getDate();
  const dueDate =
    statement?.due_date ??
    `${dueMonth.getFullYear()}-${String(dueMonth.getMonth() + 1).padStart(2, '0')}-${String(
      Math.min(card.due_day, lastDay),
    ).padStart(2, '0')}`;

  const [amount, setAmount] = useState(String(open || total).replace('.', ','));
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const account = accounts.find((item) => item.id === card.account_id);

  function run(action: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else setPaying(false);
    });
  }

  return (
    <div className={`card ${card.is_archived ? 'opacity-60' : ''}`}>
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
          <p className="num text-[11px] text-textMuted">
            fecha dia {card.closing_day} · vence dia {card.due_day}
          </p>
          <p className="num text-[11px] text-textSecondary">venc. {formatDate(dueDate)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <span className="label-caps">Fatura do mês</span>
        <span className={`num text-xl ${open > 0 ? 'text-expense' : 'text-income'}`}>
          {formatCurrency(open > 0 ? open : total)}
        </span>
      </div>

      {paid > 0 ? (
        <p className="num mt-1 text-[11px] text-income">
          {formatCurrency(paid)} já pago de {formatCurrency(total)}
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
          <p className="num mt-1 text-[11px] text-textMuted">
            {formatCurrency(total)} de {formatCurrency(Number(card.credit_limit))} do limite
          </p>
        </>
      ) : null}

      {items.length ? (
        <div className="mt-3 border-t border-border pt-2">
          {items.slice(0, 4).map((item) => (
            <div key={item.transaction_id} className="flex items-center justify-between py-1">
              <span className="truncate pr-2 text-xs text-textSecondary">{item.description}</span>
              <span className="num shrink-0 text-xs text-textPrimary">
                {formatCurrency(Number(item.amount))}
              </span>
            </div>
          ))}
          {items.length > 4 ? (
            <p className="num mt-1 text-[11px] text-textMuted">
              + {items.length - 4} lançamento(s)
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 border-t border-border pt-3 text-xs text-textMuted">
          Nenhuma compra nesta fatura.
        </p>
      )}

      {paying ? (
        <div className="mt-3 space-y-2 rounded-md border border-border p-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label-caps">Valor</label>
              <input
                className="input-base num mt-1"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="label-caps">Data do pagamento</label>
              <input
                type="date"
                className="input-base num mt-1"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <p className="text-[11px] text-textMuted">
            Gera uma saída de {account?.name ?? 'conta vinculada'}. Não conta como despesa nova — as
            compras já entraram no mês em que foram feitas.
          </p>
          <div className="flex gap-2">
            <button
              disabled={pending}
              onClick={() =>
                run(() =>
                  payStatement({
                    cardId: card.id,
                    statementMonth: month,
                    amount: Number(amount.replace(',', '.') || '0'),
                    date,
                  }),
                )
              }
              className="rounded-md bg-accent px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              {pending ? 'Registrando...' : 'Confirmar pagamento'}
            </button>
            <button
              onClick={() => setPaying(false)}
              className="rounded-md border border-border px-3 py-2 text-xs text-textSecondary"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-expense">{error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-3 border-t border-border pt-3 text-xs">
        {!card.is_archived && open > 0 ? (
          <button
            onClick={() => setPaying((value) => !value)}
            className="text-accent transition-opacity hover:opacity-80"
          >
            Pagar fatura
          </button>
        ) : null}

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
  );
}
