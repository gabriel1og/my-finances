import { FlowChart } from '@/components/charts/FlowChart';
import { AddModal } from '@/components/ui/AddModal';
import { CategoryBar } from '@/components/ui/CategoryBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { GoalProgress } from '@/components/ui/GoalProgress';
import { TxRow } from '@/components/ui/TxRow';
import { currentMonth } from '@/lib/format';
import {
  getCategories,
  getCategorySpending,
  getMonthlyFlow,
  getProfile,
  getTransactions,
} from '@/lib/queries';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month = currentMonth() } = await searchParams;

  const [flow, spending, transactions, categories, profile] = await Promise.all([
    getMonthlyFlow(6),
    getCategorySpending(month),
    getTransactions(month, 6),
    getCategories(),
    getProfile(),
  ]);

  const income = transactions.reduce((sum, tx) => (tx.type === 'income' ? sum + Number(tx.amount) : sum), 0);
  const expense = transactions.reduce((sum, tx) => (tx.type === 'expense' ? sum + Number(tx.amount) : sum), 0);

  const current = flow.find((row) => row.month.slice(0, 7) === month.slice(0, 7));
  const totalIncome = current ? Number(current.income) : income;
  const totalExpense = current ? Number(current.expense) : expense;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral do mês"
        action={<AddModal categories={categories} />}
      />

      <section className="grid grid-cols-3 gap-4">
        <KpiCard label="Saldo do mês" value={totalIncome - totalExpense} subtitle="Receitas − despesas" />
        <KpiCard label="Receitas" value={totalIncome} tone="income" />
        <KpiCard label="Despesas" value={totalExpense} tone="expense" />
      </section>

      {profile?.monthly_goal || profile?.monthly_spending_cap ? (
        <section className="mt-4 grid grid-cols-2 gap-4">
          <GoalProgress
            variant="saving"
            current={totalIncome - totalExpense}
            target={profile.monthly_goal}
            currency={profile.currency}
          />
          <GoalProgress
            variant="cap"
            current={totalExpense}
            target={profile.monthly_spending_cap}
            currency={profile.currency}
          />
        </section>
      ) : null}

      <section className="mt-4 grid grid-cols-3 gap-4">
        <div className="card col-span-2">
          <span className="label-caps">Fluxo mensal</span>
          <div className="mt-4">
            {flow.length ? <FlowChart data={flow} /> : <EmptyState message="Sem dados ainda." />}
          </div>
        </div>

        <div className="card">
          <span className="label-caps">Orçamento por categoria</span>
          <div className="mt-2">
            {spending.length ? (
              spending.map((row) => (
                <CategoryBar
                  key={row.category_id}
                  name={row.name}
                  color={row.color}
                  spent={Number(row.spent)}
                  budget={Number(row.budget)}
                />
              ))
            ) : (
              <EmptyState message="Nenhum gasto registrado neste mês." />
            )}
          </div>
        </div>
      </section>

      <section className="card mt-4">
        <span className="label-caps">Últimas transações</span>
        <div className="mt-2">
          {transactions.length ? (
            transactions.map((tx) => <TxRow key={tx.id} tx={tx} />)
          ) : (
            <EmptyState message="Nenhum lançamento neste mês." />
          )}
        </div>
      </section>
    </>
  );
}
