import { CardFormModal } from '@/components/cards/CardFormModal';
import { CardPanel } from '@/components/cards/CardPanel';
import { EmptyState } from '@/components/ui/EmptyState';
import { KpiCard } from '@/components/ui/KpiCard';
import { Money } from '@/lib/currency';
import { PageActions } from '@/components/ui/PageActions';
import { currentMonth } from '@/lib/format';
import { upcomingStatementsByCard } from '@/lib/forecast';
import {
  getAccounts,
  getCardStatements,
  getCards,
  getStatementItems,
  getUpcomingStatements,
} from '@/lib/queries';

/** Janela da faixa "Próximas faturas" no card. A visão longa é /forecast. */
const UPCOMING_MONTHS = 3;

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month = currentMonth() } = await searchParams;

  const [cards, accounts, statements, items, ahead] = await Promise.all([
    getCards(true),
    getAccounts(),
    getCardStatements(month),
    getStatementItems(month),
    // +1 porque a janela inclui o mês em tela, que a faixa descarta.
    getUpcomingStatements(month, UPCOMING_MONTHS + 1),
  ]);

  const statementByCard = new Map(statements.map((row) => [row.card_id, row]));
  const upcomingByCard = upcomingStatementsByCard(ahead, month, UPCOMING_MONTHS);

  const active = cards.filter((card) => !card.is_archived);
  const archived = cards.filter((card) => card.is_archived);

  // Fatura em aberto de cartão arquivado continua sendo dívida: entra no total.
  const totalOpen = cards.reduce(
    (sum, card) => sum + Number(statementByCard.get(card.id)?.open_amount ?? 0),
    0,
  );
  const totalLimit = active.reduce((sum, card) => sum + Number(card.credit_limit), 0);
  const totalUsed = active.reduce(
    (sum, card) => sum + Number(statementByCard.get(card.id)?.total ?? 0),
    0,
  );

  return (
    <>
      <PageActions>
        <CardFormModal accounts={accounts} />
      </PageActions>

      {accounts.length === 0 ? (
        <EmptyState message="Cadastre uma conta bancária primeiro — todo cartão precisa de uma conta que pague a fatura." />
      ) : (
        <>
          <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard label="Faturas em aberto" value={totalOpen} tone="expense" />
            <KpiCard label="Total das faturas" value={totalUsed} subtitle="Compras do mês" />
            <KpiCard
              label="Limite disponível"
              value={totalLimit - totalUsed}
              subtitle={
                <>
                  De <Money value={totalLimit} />
                </>
              }
            />
          </section>

          {active.length ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {active.map((card) => (
                <CardPanel
                  key={card.id}
                  card={card}
                  accounts={accounts}
                  statement={statementByCard.get(card.id) ?? null}
                  items={items.filter((item) => item.card_id === card.id)}
                  upcoming={upcomingByCard.get(card.id) ?? []}
                  month={month}
                />
              ))}
            </div>
          ) : (
            <EmptyState message="Nenhum cartão cadastrado." />
          )}

          {archived.length ? (
            <section className="mt-8">
              <span className="label-caps">Arquivados</span>
              <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {archived.map((card) => (
                  <CardPanel
                    key={card.id}
                    card={card}
                    accounts={accounts}
                    statement={statementByCard.get(card.id) ?? null}
                    items={items.filter((item) => item.card_id === card.id)}
                    upcoming={upcomingByCard.get(card.id) ?? []}
                    month={month}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
