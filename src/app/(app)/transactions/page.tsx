import { Suspense } from 'react';
import { AddModal } from '@/components/ui/AddModal';
import { PageActions } from '@/components/ui/PageActions';
import { ExportButton } from '@/components/transactions/ExportButton';
import { TransactionFilters } from '@/components/transactions/TransactionFilters';
import { TransactionsList } from '@/components/transactions/TransactionsList';
import { TransactionsPagination } from '@/components/transactions/TransactionsPagination';
import { currentMonth } from '@/lib/format';
import { getAccounts, getCards, getCategories, getTags, getTransactionsPage } from '@/lib/queries';

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    q?: string;
    type?: string;
    category?: string;
    tag?: string;
    account?: string;
    card?: string;
    page?: string;
    scope?: string;
  }>;
}) {
  const params = await searchParams;
  const month = params.month ?? currentMonth();
  const allMonths = params.scope === 'all';

  const [result, categories, accounts, cards, tags] = await Promise.all([
    getTransactionsPage({
      month: allMonths ? null : month,
      search: params.q,
      type: (params.type as 'income' | 'expense' | 'transfer' | undefined) ?? 'all',
      categoryId: params.category,
      tagId: params.tag,
      accountId: params.account,
      cardId: params.card,
      page: Number(params.page ?? '1') || 1,
    }),
    getCategories(),
    getAccounts(),
    getCards(),
    getTags(),
  ]);

  return (
    <>
      <PageActions>
        <Suspense fallback={null}>
          <ExportButton month={month} />
        </Suspense>
        <AddModal categories={categories} accounts={accounts} cards={cards} tags={tags} />
      </PageActions>

      {/* useSearchParams exige Suspense no App Router. */}
      <Suspense fallback={<div className="mb-4 h-9" />}>
        <TransactionFilters
          categories={categories}
          accounts={accounts}
          cards={cards}
          tags={tags}
          allMonths={allMonths}
        />
      </Suspense>

      <TransactionsList
        transactions={result.transactions}
        categories={categories}
        accounts={accounts}
        cards={cards}
        tags={tags}
      />

      <Suspense fallback={null}>
        <TransactionsPagination
          page={result.page}
          pageCount={result.pageCount}
          total={result.total}
          shown={result.transactions.length}
        />
      </Suspense>
    </>
  );
}
