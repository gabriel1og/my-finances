import { AddModal } from '@/components/ui/AddModal';
import { PageHeader } from '@/components/ui/PageHeader';
import { TransactionsList } from '@/components/transactions/TransactionsList';
import { currentMonth } from '@/lib/format';
import { getAccounts, getCards, getCategories, getTags, getTransactions } from '@/lib/queries';

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month = currentMonth() } = await searchParams;
  const [transactions, categories, accounts, cards, tags] = await Promise.all([
    getTransactions(month),
    getCategories(),
    getAccounts(),
    getCards(),
    getTags(),
  ]);

  return (
    <>
      <PageHeader
        title="Transações"
        subtitle="Todos os lançamentos do mês"
        action={
          <AddModal categories={categories} accounts={accounts} cards={cards} tags={tags} />
        }
      />
      <TransactionsList
        transactions={transactions}
        categories={categories}
        accounts={accounts}
        cards={cards}
        tags={tags}
      />
    </>
  );
}
