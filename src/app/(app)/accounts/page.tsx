import { AccountCard } from '@/components/accounts/AccountCard';
import { AccountFormModal } from '@/components/accounts/AccountFormModal';
import { TransferModal } from '@/components/accounts/TransferModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { currentMonth } from '@/lib/format';
import { getAccountBalances, getAccounts, getCardStatements, getCards } from '@/lib/queries';

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month = currentMonth() } = await searchParams;

  const [accounts, balances, cards, statements] = await Promise.all([
    getAccounts(true),
    getAccountBalances(),
    getCards(true),
    getCardStatements(month),
  ]);

  const balanceById = new Map(balances.map((row) => [row.account_id, Number(row.balance)]));
  const openByCard = new Map(statements.map((row) => [row.card_id, Number(row.open_amount)]));

  const active = accounts.filter((account) => !account.is_archived);
  const archived = accounts.filter((account) => account.is_archived);

  const total = active.reduce((sum, account) => sum + (balanceById.get(account.id) ?? 0), 0);
  // Arquivado com fatura em aberto continua comprometendo o saldo.
  const totalOpen = cards.reduce((sum, card) => sum + (openByCard.get(card.id) ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Contas bancárias"
        subtitle="Saldo atual e faturas vinculadas"
        action={
          <div className="flex gap-2">
            <TransferModal accounts={active} />
            <AccountFormModal />
          </div>
        }
      />

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Saldo total" value={total} subtitle="Soma das contas ativas" />
        <KpiCard
          label="Faturas em aberto"
          value={totalOpen}
          tone="expense"
          subtitle="No mês selecionado"
        />
        <KpiCard
          label="Saldo previsto"
          value={total - totalOpen}
          subtitle="Depois de pagar as faturas"
        />
      </section>

      {active.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((account) => {
            const accountCards = cards.filter((card) => card.account_id === account.id);
            const openTotal = accountCards.reduce(
              (sum, card) => sum + (openByCard.get(card.id) ?? 0),
              0,
            );
            return (
              <AccountCard
                key={account.id}
                account={account}
                balance={balanceById.get(account.id) ?? Number(account.opening_balance)}
                cards={accountCards}
                openCardTotal={openTotal}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState message="Nenhuma conta cadastrada. Crie a primeira para começar a acompanhar saldo." />
      )}

      {archived.length ? (
        <section className="mt-8">
          <span className="label-caps">Arquivadas</span>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {archived.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                balance={balanceById.get(account.id) ?? Number(account.opening_balance)}
                cards={[]}
                openCardTotal={0}
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
