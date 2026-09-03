import { FlowChart } from '@/components/charts/FlowChart';
import { AddModal } from '@/components/ui/AddModal';
import { CategoryBar } from '@/components/ui/CategoryBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageActions } from '@/components/ui/PageActions';
import { GoalProgress } from '@/components/ui/GoalProgress';
import { PendingBanner } from '@/components/recurring/PendingBanner';
import { TransferRow } from '@/components/ui/TransferRow';
import { TxRow } from '@/components/ui/TxRow';
import { buildRolloverRows } from '@/lib/rollover';
import { Money } from '@/lib/currency';
import { groupTransfers } from '@/lib/transactions';
import { currentMonth } from '@/lib/format';
import {
  getAccountBalances,
  getAccounts,
  getCards,
  getCategories,
  getCategoryHistory,
  getCategorySpending,
  getMonthFlow,
  getMonthlyFlow,
  getPostedRecurringIds,
  getProfile,
  getRecurring,
  getTags,
  getTransactions,
} from '@/lib/queries';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month = currentMonth() } = await searchParams;

  const [flow, current, spending, transactions, categories, profile] = await Promise.all([
    getMonthlyFlow(6, month),
    getMonthFlow(month),
    getCategorySpending(month),
    getTransactions(month, 6),
    getCategories(),
    getProfile(),
  ]);

  const [accounts, cards, balances, tags, recurring, postedRecurring, history] = await Promise.all([
    getAccounts(),
    getCards(),
    getAccountBalances(),
    getTags(),
    getRecurring(),
    getPostedRecurringIds(month),
    getCategoryHistory(month),
  ]);

  const monthStart = `${month.slice(0, 7)}-01`;
  const pendingRecurring = recurring.filter(
    (item) =>
      item.is_active &&
      item.start_month <= monthStart &&
      (!item.end_month || item.end_month >= monthStart) &&
      !postedRecurring.has(item.id),
  ).length;

  // Saldo consolidado: só contas ativas.
  const consolidated = balances
    .filter((row) => !row.is_archived)
    .reduce((sum, row) => sum + Number(row.balance), 0);

  // O disponível já inclui o acumulado das categorias com rollover ligado —
  // sem isso o dashboard leria o orçamento como se cada mês fosse isolado.
  const budgetRows = buildRolloverRows({ spending, history, categories, month });
  const totalCarry = budgetRows.reduce((sum, row) => sum + row.carry, 0);

  // Os KPIs vêm da view, consultada pelo próprio mês. Mês sem linha é mês sem
  // lançamento — zero, não uma soma parcial. (Antes havia um fallback somando
  // a lista de "últimas transações", limitada a 6 linhas: quando o mês saía da
  // janela do gráfico, o KPI mostrava a soma de seis lançamentos como se fosse
  // o mês inteiro.)
  const totalIncome = current ? Number(current.income) : 0;
  const totalExpense = current ? Number(current.expense) : 0;

  return (
    <>
      <PageActions>
        <AddModal categories={categories} accounts={accounts} cards={cards} tags={tags} />
      </PageActions>

      <PendingBanner count={pendingRecurring} month={month} />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Saldo em contas"
          value={consolidated}
          subtitle={`${balances.filter((row) => !row.is_archived).length} conta(s) ativa(s)`}
        />
        <KpiCard
          label="Saldo do mês"
          value={totalIncome - totalExpense}
          subtitle="Receitas − despesas"
        />
        <KpiCard label="Receitas" value={totalIncome} tone="income" />
        <KpiCard label="Despesas" value={totalExpense} tone="expense" />
      </section>

      {profile?.monthly_goal || profile?.monthly_spending_cap ? (
        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
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

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="card xl:col-span-2">
          <span className="label-caps">Fluxo mensal</span>
          <div className="mt-4">
            {flow.length ? <FlowChart data={flow} /> : <EmptyState message="Sem dados ainda." />}
          </div>
        </div>

        <div className="card">
          <div className="flex items-baseline justify-between gap-2">
            <span className="label-caps">Orçamento por categoria</span>
            {totalCarry !== 0 ? (
              <span
                className={`num text-2xs ${totalCarry > 0 ? 'text-income' : 'text-warning'}`}
                title="Soma do acumulado das categorias com rollover ligado"
              >
                {totalCarry > 0 ? '+' : '−'}
                <Money value={Math.abs(totalCarry)} /> acumulado
              </span>
            ) : null}
          </div>
          <div className="mt-2">
            {budgetRows.length ? (
              budgetRows.map((row) => (
                <CategoryBar
                  key={row.categoryId}
                  name={row.name}
                  color={row.color}
                  spent={row.spent}
                  budget={row.available}
                  carry={row.carry}
                />
              ))
            ) : (
              <EmptyState message="Nenhum gasto registrado neste mês." />
            )}
          </div>
        </div>
      </section>

      <section className="card mt-6">
        <span className="label-caps">Últimas transações</span>
        <div className="mt-2">
          {transactions.length ? (
            groupTransfers(transactions).map((entry) =>
              entry.kind === 'transfer' ? (
                <TransferRow key={entry.key} entry={entry} />
              ) : (
                <TxRow key={entry.key} tx={entry.tx} />
              ),
            )
          ) : (
            <EmptyState message="Nenhum lançamento neste mês." />
          )}
        </div>
      </section>
    </>
  );
}
