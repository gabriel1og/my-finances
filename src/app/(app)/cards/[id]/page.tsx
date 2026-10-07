import Link from 'next/link';
import type { Route } from 'next';
import { notFound } from 'next/navigation';
import { KpiCard } from '@/components/ui/KpiCard';
import { Money } from '@/lib/currency';
import { StatementCategories } from '@/components/cards/StatementCategories';
import { StatementItems } from '@/components/cards/StatementItems';
import { StatementPayPanel } from '@/components/cards/StatementPayPanel';
import { StatementAdjustmentModal } from '@/components/cards/StatementAdjustmentModal';
import { getStatementAdjustments } from '@/lib/statement-queries';
import { currentMonth, formatDate, formatMonthLong } from '@/lib/format';
import {
  getAccounts,
  getCard,
  getCardStatement,
  getCards,
  getCategories,
  getStatementPayments,
  getStatementTransactions,
  getTags,
} from '@/lib/queries';

/**
 * A fatura inteira de um cartão num mês.
 *
 * O card em /cards mostra os quatro primeiros lançamentos e o total — o que
 * faltava era o lugar onde a fatura se abre por completo: cada compra, com
 * editar e excluir, o peso de cada categoria e os pagamentos já registrados.
 *
 * O mês vem da URL, como no resto do app: o seletor do cabeçalho troca a
 * fatura em tela sem sair da página.
 */
export default async function CardStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { id } = await params;
  const { month = currentMonth() } = await searchParams;

  const card = await getCard(id);
  if (!card) notFound();

  const [accounts, statement, transactions, payments, categories, cards, tags, adjustments] =
    await Promise.all([
      getAccounts(true),
      getCardStatement(card.id, month),
      getStatementTransactions(card.id, month),
      getStatementPayments(card, month),
      getCategories(),
      getCards(true),
      getTags(),
      getStatementAdjustments(card.id),
    ]);
  if (!statement) notFound();

  if (statement?.merged_into_month)
    return (
      <section className="card space-y-3">
        <h1 className="text-lg">Fatura de {formatMonthLong(month)} incorporada</h1>
        <p className="text-sm text-textSecondary">
          As compras e os pagamentos deste ciclo foram reunidos na fatura de{' '}
          {formatMonthLong(statement.merged_into_month)}.
        </p>
        <Link
          className="btn-primary inline-block"
          href={`/cards/${card.id}?month=${statement.merged_into_month}` as Route}
        >
          Ver fatura resultante
        </Link>
      </section>
    );

  const account = accounts.find((item) => item.id === card.account_id);

  const total = statement ? Number(statement.total) : 0;
  const paid = statement ? Number(statement.paid) : 0;
  const open = statement ? Number(statement.open_amount) : total - paid;

  const dueDate = statement.due_date;
  const closingDate = statement.closing_date;
  const overdue = open > 0 && dueDate < new Date().toISOString().slice(0, 10);

  const status =
    total === 0 && paid === 0
      ? { label: 'Sem lançamentos', className: 'border-border text-textMuted' }
      : open > 0
        ? overdue
          ? { label: 'Vencida', className: 'border-expense/40 bg-expenseDim text-expense' }
          : { label: 'Em aberto', className: 'border-warning/40 bg-warningDim text-warning' }
        : {
            label: open < 0 ? 'Com crédito' : 'Paga',
            className: 'border-income/40 bg-incomeDim text-income',
          };

  const backHref = `/cards?month=${month.slice(0, 7)}-01` as Route;

  return (
    <>
      <Link
        href={backHref}
        className="mb-3 inline-flex items-center gap-1.5 text-xs text-textSecondary transition-colors hover:text-textPrimary"
      >
        <span aria-hidden>←</span> Cartões
      </Link>

      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex items-center gap-2 text-base font-medium tracking-tight">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: card.color }}
                aria-hidden
              />
              {card.name}
            </span>
            <span
              className={`rounded-sm border px-2 py-0.5 text-3xs font-medium uppercase tracking-[0.08em] ${status.className}`}
            >
              {status.label}
            </span>
          </div>

          <p className="mt-1 text-xs text-textSecondary">
            Fatura de {formatMonthLong(month)}
            {card.brand ? ` · ${card.brand}` : ''} · paga por {account?.name ?? '—'}
          </p>
          <p className="num mt-0.5 text-2xs text-textMuted">
            fecha em {formatDate(closingDate)} · vence em {formatDate(dueDate)}
          </p>
          {statement && (
            <p className="mt-1 text-xs text-textSecondary">
              Período: {formatDate(statement.period_start)} até {formatDate(closingDate)}{' '}
              (fechamento exclusivo){statement.is_adjusted ? ' · Ajustada' : ''}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {statement && (
            <StatementAdjustmentModal
              card={card}
              statement={statement}
              transactions={transactions}
            />
          )}
          {open > 0 && (
            <StatementPayPanel
              card={card}
              account={account}
              month={month}
              statementId={statement?.statement_id}
              suggested={open}
            />
          )}
        </div>
      </header>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Total da fatura"
          value={total}
          subtitle={`${transactions.length} lançamento${transactions.length === 1 ? '' : 's'}`}
        />
        <KpiCard
          label="Pago"
          value={paid}
          tone={paid > 0 ? 'income' : 'neutral'}
          subtitle={
            payments.length
              ? `${payments.length} pagamento${payments.length === 1 ? '' : 's'} registrado${
                  payments.length === 1 ? '' : 's'
                }`
              : 'Nenhum pagamento registrado'
          }
        />
        <KpiCard
          label={open < 0 ? 'Crédito nesta fatura' : 'Em aberto'}
          value={Math.abs(open)}
          tone={open > 0 ? 'expense' : 'income'}
          subtitle={
            open > 0
              ? `Vence em ${formatDate(dueDate)}`
              : open < 0
                ? 'Sem transferência automática para outra fatura'
                : 'Fatura quitada'
          }
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <StatementItems
            transactions={transactions}
            categories={categories}
            accounts={accounts}
            cards={cards}
            tags={tags}
          />
        </div>

        <aside className="space-y-4">
          <StatementCategories transactions={transactions} />
          {adjustments.length > 0 && (
            <section className="card">
              <h2 className="label-caps">Histórico de ajustes do cartão</h2>
              <ul className="mt-2 space-y-2 text-xs">
                {adjustments.map((entry) => (
                  <li key={entry.id}>
                    <time dateTime={entry.created_at}>
                      {new Date(entry.created_at).toLocaleString('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                      })}
                    </time>
                    <p className="text-textSecondary">{entry.reason}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card">
            <h2 className="label-caps">Pagamentos</h2>

            {payments.length ? (
              <>
                <div className="mt-1">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="num text-xs text-textPrimary">{formatDate(payment.date)}</p>
                        <p className="truncate text-2xs text-textSecondary">
                          {payment.account?.name ?? 'Conta removida'}
                        </p>
                      </div>
                      <span className="num shrink-0 text-xs text-income">
                        <Money value={Number(payment.amount)} />
                      </span>
                    </div>
                  ))}
                </div>

                <p className="num mt-2 text-2xs text-textMuted">
                  Total pago: <Money value={paid} />
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs text-textMuted">
                Nenhum pagamento registrado para esta fatura.
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
