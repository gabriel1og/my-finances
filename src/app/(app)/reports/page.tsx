import { ExpensePie } from '@/components/charts/ExpensePie';
import { FlowChart } from '@/components/charts/FlowChart';
import { NetWorthChart } from '@/components/charts/NetWorthChart';
import { CategoryTrend } from '@/components/reports/CategoryTrend';
import { EmptyState } from '@/components/ui/EmptyState';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Money } from '@/lib/currency';
import { monthSequence } from '@/lib/forecast';
import { buildRolloverRows } from '@/lib/rollover';
import { currentMonth } from '@/lib/format';
import {
  getAccountMonthTotals,
  getCardMonthTotals,
  getCategories,
  getCategoryHistory,
  getCategorySpending,
  getCategorySpendingRange,
  getMonthlyFlow,
  getNetWorthSeries,
  getTagTotals,
} from '@/lib/queries';

const TREND_MONTHS = 6;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month = currentMonth() } = await searchParams;

  const [flow, spending, tagTotals, trend, accounts, cards, netWorth, categories, history] =
    await Promise.all([
      getMonthlyFlow(TREND_MONTHS),
      getCategorySpending(month),
      getTagTotals(month),
      getCategorySpendingRange(month, TREND_MONTHS - 1),
      getAccountMonthTotals(month),
      getCardMonthTotals(month),
      getNetWorthSeries(12),
      getCategories(),
      getCategoryHistory(month),
    ]);

  const income = flow.reduce((sum, row) => sum + Number(row.income), 0);
  const expense = flow.reduce((sum, row) => sum + Number(row.expense), 0);

  // A janela do comparativo termina no mês selecionado.
  const [year, monthNumber] = month.slice(0, 7).split('-').map(Number);
  const first = new Date(year, monthNumber - TREND_MONTHS, 1);
  const trendMonths = monthSequence(
    `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-01`,
    TREND_MONTHS,
  );

  // Só as categorias com rollover ligado entram: para as demais o acumulado
  // seria sempre zero e a tabela viraria uma cópia do comparativo.
  const rolloverIds = new Set(
    categories.filter((category) => category.rollover_enabled).map((category) => category.id),
  );
  const rolloverRows = buildRolloverRows({ spending, history, categories, month }).filter((row) =>
    rolloverIds.has(row.categoryId),
  );
  const rolloverCarry = rolloverRows.reduce((sum, row) => sum + row.carry, 0);

  const currentNetWorth = netWorth.length ? Number(netWorth[netWorth.length - 1].net_worth) : 0;

  return (
    <>
      <PageHeader title="Relatórios" subtitle={`Últimos ${TREND_MONTHS} meses`} />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Receitas no período" value={income} tone="income" />
        <KpiCard label="Despesas no período" value={expense} tone="expense" />
        <KpiCard label="Resultado" value={income - expense} subtitle="Receitas − despesas" />
        <KpiCard
          label="Saldo acumulado"
          value={currentNetWorth}
          subtitle="Contas ao fim do último mês com movimento"
        />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <span className="label-caps">Fluxo mensal</span>
          <div className="mt-4">
            {flow.length ? <FlowChart data={flow} /> : <EmptyState message="Sem dados ainda." />}
          </div>
        </div>

        <div className="card">
          <span className="label-caps">Evolução do patrimônio</span>
          <div className="mt-4">
            {netWorth.length > 1 ? (
              <NetWorthChart data={netWorth} />
            ) : (
              <EmptyState message="Um mês de dados não desenha evolução — volte depois do próximo." />
            )}
          </div>
        </div>
      </section>

      <section className="card mt-6">
        <span className="label-caps">Composição das despesas do mês</span>
        <div className="mt-4">
          {spending.some((row) => row.kind === 'expense' && Number(row.spent) > 0) ? (
            <ExpensePie data={spending} />
          ) : (
            <EmptyState message="Nenhuma despesa neste mês." />
          )}
        </div>
      </section>

      <section className="card mt-6">
        <span className="label-caps">Comparativo por categoria</span>
        <div className="mt-3">
          <CategoryTrend rows={trend} months={trendMonths} />
        </div>
      </section>

      {rolloverRows.length ? (
        <section className="card mt-6">
          <div className="flex items-baseline justify-between gap-2">
            <span className="label-caps">Orçamento acumulado</span>
            <span className={`num text-2xs ${rolloverCarry >= 0 ? 'text-income' : 'text-warning'}`}>
              {rolloverCarry >= 0 ? '+' : '−'}
              <Money value={Math.abs(rolloverCarry)} /> no total
            </span>
          </div>
          <p className="mt-1 text-2xs text-textMuted">
            Categorias com rollover ligado. O acumulado vem dos meses anteriores e já está somado ao
            disponível.
          </p>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="label-caps py-2 font-normal">Categoria</th>
                  <th className="label-caps py-2 text-right font-normal">Limite</th>
                  <th className="label-caps py-2 text-right font-normal">Acumulado</th>
                  <th className="label-caps py-2 text-right font-normal">Disponível</th>
                  <th className="label-caps py-2 text-right font-normal">Gasto</th>
                  <th className="label-caps py-2 text-right font-normal">Restante</th>
                </tr>
              </thead>
              <tbody>
                {rolloverRows.map((row) => {
                  const left = row.available - row.spent;
                  return (
                    <tr key={row.categoryId} className="border-b border-border last:border-b-0">
                      <td className="py-2">
                        <span className="flex items-center gap-2 text-textPrimary">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: row.color }}
                          />
                          {row.name}
                        </span>
                      </td>
                      <td className="num py-2 text-right text-xs text-textSecondary">
                        <Money value={row.budget} />
                      </td>
                      <td
                        className={`num py-2 text-right text-xs ${row.carry >= 0 ? 'text-income' : 'text-warning'}`}
                      >
                        {row.carry >= 0 ? '+' : '−'}
                        <Money value={Math.abs(row.carry)} />
                      </td>
                      <td className="num py-2 text-right text-xs text-textPrimary">
                        <Money value={row.available} />
                      </td>
                      <td className="num py-2 text-right text-xs text-expense">
                        <Money value={row.spent} />
                      </td>
                      <td
                        className={`num py-2 text-right text-xs ${left >= 0 ? 'text-textSecondary' : 'text-expense'}`}
                      >
                        <Money value={left} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <span className="label-caps">Gastos por conta</span>
          <div className="mt-2">
            {accounts.length ? (
              accounts.map((row) => (
                <div
                  key={row.account_id}
                  className="flex items-center justify-between border-b border-border py-2 last:border-b-0"
                >
                  <span className="flex items-center gap-2 text-sm text-textPrimary">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
                    {row.name}
                    <span className="num text-2xs text-textMuted">{row.items} lançamento(s)</span>
                  </span>
                  <Money value={Number(row.expense)} className="num text-sm text-expense" />
                </div>
              ))
            ) : (
              <EmptyState message="Nenhum gasto direto em conta neste mês." />
            )}
          </div>
        </div>

        <div className="card">
          <span className="label-caps">Gastos por cartão</span>
          <p className="mt-1 text-2xs text-textMuted">Pelo mês da compra, não o da fatura.</p>
          <div className="mt-2">
            {cards.length ? (
              cards.map((row) => (
                <div
                  key={row.card_id}
                  className="flex items-center justify-between border-b border-border py-2 last:border-b-0"
                >
                  <span className="flex items-center gap-2 text-sm text-textPrimary">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
                    {row.name}
                    <span className="num text-2xs text-textMuted">{row.items} compra(s)</span>
                  </span>
                  <Money value={Number(row.expense)} className="num text-sm text-expense" />
                </div>
              ))
            ) : (
              <EmptyState message="Nenhuma compra no crédito neste mês." />
            )}
          </div>
        </div>
      </section>

      <section className="card mt-6">
        <span className="label-caps">Gastos por tag</span>
        <div className="mt-2">
          {tagTotals.length ? (
            tagTotals.map((row) => (
              <div
                key={row.tag_id}
                className="flex items-center justify-between border-b border-border py-2 last:border-b-0"
              >
                <span className="flex items-center gap-2 text-sm text-textPrimary">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
                  {row.name}
                  <span className="num text-2xs text-textMuted">{row.items} lançamento(s)</span>
                </span>
                <Money value={Number(row.expense)} className="num text-sm text-expense" />
              </div>
            ))
          ) : (
            <EmptyState message="Nenhuma transação com tag neste mês." />
          )}
        </div>
      </section>
    </>
  );
}
