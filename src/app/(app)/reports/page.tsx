import { Suspense } from 'react';
import { ExpensePie } from '@/components/charts/ExpensePie';
import { FlowChart } from '@/components/charts/FlowChart';
import { NetWorthChart } from '@/components/charts/NetWorthChart';
import { CategoryTrend } from '@/components/reports/CategoryTrend';
import { RolloverTable } from '@/components/reports/RolloverTable';
import { ReportRangePicker } from '@/components/reports/ReportRangePicker';
import { ReportScopeToggle } from '@/components/reports/ReportScopeToggle';
import { SourceBreakdown } from '@/components/reports/SourceBreakdown';
import { TrendTable } from '@/components/reports/TrendTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageActions } from '@/components/ui/PageActions';
import { Money } from '@/lib/currency';
import { monthSequence } from '@/lib/forecast';
import { buildRolloverRows } from '@/lib/rollover';
import {
  buildCategorySpendingTotals,
  buildSourceTotals,
  buildTagTotals,
  buildTrendRows,
  parseReportCardScope,
  parseReportRange,
} from '@/lib/reports';
import { currentMonth, formatMonthLong, formatMonthShort } from '@/lib/format';
import {
  getAccountMonthTotalsRange,
  getCardMonthTotalsRange,
  getCategories,
  getCategoryHistory,
  getCategorySpending,
  getCategorySpendingRange,
  getMonthlyFlow,
  getNetWorthSeries,
  getTagTotalsRange,
} from '@/lib/queries';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    compositionScope?: string;
    month?: string;
    range?: string;
    tagScope?: string;
  }>;
}) {
  const {
    compositionScope: compositionScopeParam,
    month = currentMonth(),
    range: rangeParam,
    tagScope: tagScopeParam,
  } = await searchParams;

  // Toda janela da página sai daqui: fluxo, comparativos e evolução olham o
  // mesmo período, senão dois números lado a lado passariam a falar de prazos
  // diferentes.
  const range = parseReportRange(rangeParam);
  const compositionScope = parseReportCardScope(compositionScopeParam);
  const tagScope = parseReportCardScope(tagScopeParam);

  const [flow, spending, tagTotals, trend, accounts, cards, netWorth, categories, history] =
    await Promise.all([
      getMonthlyFlow(range, month),
      getCategorySpending(month),
      getTagTotalsRange(month, range - 1),
      getCategorySpendingRange(month, range - 1),
      getAccountMonthTotalsRange(month, range - 1),
      getCardMonthTotalsRange(month, range - 1),
      getNetWorthSeries(range),
      getCategories(),
      getCategoryHistory(month),
    ]);

  const income = flow.reduce((sum, row) => sum + Number(row.income), 0);
  const expense = flow.reduce((sum, row) => sum + Number(row.expense), 0);

  // A janela do comparativo termina no mês selecionado.
  const [year, monthNumber] = month.slice(0, 7).split('-').map(Number);
  const first = new Date(year, monthNumber - range, 1);
  const trendMonths = monthSequence(
    `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-01`,
    range,
  );

  const windowLabel = `${range} meses até ${formatMonthShort(month, true)}`;

  // Só as categorias com rollover ligado entram: para as demais o acumulado
  // seria sempre zero e a tabela viraria uma cópia do comparativo.
  const rolloverIds = new Set(
    categories.filter((category) => category.rollover_enabled).map((category) => category.id),
  );
  const rolloverRows = buildRolloverRows({ spending, history, categories, month }).filter((row) =>
    rolloverIds.has(row.categoryId),
  );
  const rolloverCarry = rolloverRows.reduce((sum, row) => sum + row.carry, 0);

  // As duas views viram a mesma forma (`id` no lugar de `account_id`/`card_id`)
  // para a montagem ser uma só — ver lib/reports.ts.
  const accountSeries = accounts.map((row) => ({
    id: row.account_id,
    name: row.name,
    color: row.color,
    month: row.month,
    expense: Number(row.expense),
    income: Number(row.income),
    items: row.items,
  }));

  const cardSeries = cards.map((row) => ({
    id: row.card_id,
    name: row.name,
    color: row.color,
    month: row.month,
    expense: Number(row.expense),
    items: row.items,
  }));

  const monthKey = `${month.slice(0, 7)}-01`;
  const inMonth = (row: { month: string }) => row.month.slice(0, 7) === month.slice(0, 7);

  // Conta abre nos lançamentos dela; cartão abre na fatura do mês. São as duas
  // perguntas seguintes a "gastei tanto aqui".
  const accountRows = buildSourceTotals(accountSeries.filter(inMonth)).map((row) => ({
    ...row,
    href: `/transactions?month=${monthKey}&account=${row.id}`,
  }));

  const cardRows = buildSourceTotals(cardSeries.filter(inMonth)).map((row) => ({
    ...row,
    href: `/cards/${row.id}?month=${monthKey}`,
  }));

  const accountTrend = buildTrendRows(accountSeries, trendMonths);
  const cardTrend = buildTrendRows(cardSeries, trendMonths);
  const compositionRows =
    compositionScope === 'month' ? spending : buildCategorySpendingTotals(trend);
  const compositionLabel =
    compositionScope === 'month'
      ? formatMonthLong(month)
      : `${range} meses até ${formatMonthLong(month)}`;
  const compositionHasExpenses = compositionRows.some(
    (row) => row.kind === 'expense' && Number(row.spent) > 0,
  );

  const tagRows = buildTagTotals(tagScope === 'month' ? tagTotals.filter(inMonth) : tagTotals);
  const tagExpense = tagRows.reduce((sum, row) => sum + row.expense, 0);
  const tagLabel =
    tagScope === 'month' ? formatMonthLong(month) : `${range} meses até ${formatMonthLong(month)}`;

  const currentNetWorth = netWorth.length ? Number(netWorth[netWorth.length - 1].net_worth) : 0;

  return (
    <>
      <PageActions>
        {/* useSearchParams exige Suspense no App Router. */}
        <Suspense fallback={<div className="h-9" />}>
          <ReportRangePicker />
        </Suspense>
      </PageActions>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Receitas no período" value={income} tone="income" subtitle={windowLabel} />
        <KpiCard
          label="Despesas no período"
          value={expense}
          tone="expense"
          subtitle={windowLabel}
        />
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="label-caps">Composição das despesas</span>
            <p className="mt-1 text-2xs text-textMuted">{compositionLabel}</p>
          </div>
          <Suspense fallback={<div className="h-9" />}>
            <ReportScopeToggle paramKey="compositionScope" scope={compositionScope} />
          </Suspense>
        </div>
        <div className="mt-4">
          {compositionHasExpenses ? (
            <ExpensePie data={compositionRows} />
          ) : (
            <EmptyState message="Nenhuma despesa neste período." />
          )}
        </div>
      </section>

      <section className="card mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="label-caps">Comparativo por categoria</span>
          <span className="text-2xs text-textMuted">
            {range} meses até {formatMonthLong(month)}
          </span>
        </div>
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

          <div className="mt-3">
            <RolloverTable rows={rolloverRows} />
          </div>
        </section>
      ) : null}

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <span className="label-caps">Gastos por conta</span>
          <p className="mt-1 text-2xs text-textMuted">
            Saídas direto da conta; o que entrou aparece ao lado. Pagamento de fatura e
            transferência ficam de fora — não são gasto novo.
          </p>
          <div className="mt-3">
            <SourceBreakdown
              rows={accountRows}
              itemsNoun="lançamento"
              linkTitle="Ver lançamentos de"
              emptyMessage="Nenhum movimento em conta neste mês."
              showIncome
            />
          </div>
        </div>

        <div className="card">
          <span className="label-caps">Gastos por cartão</span>
          <p className="mt-1 text-2xs text-textMuted">
            Pelo mês da compra, não o da fatura. Clicar abre a fatura do mês.
          </p>
          <div className="mt-3">
            <SourceBreakdown
              rows={cardRows}
              itemsNoun="compra"
              linkTitle="Ver a fatura de"
              emptyMessage="Nenhuma compra no crédito neste mês."
            />
          </div>
        </div>
      </section>

      <section className="card mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="label-caps">Evolução por conta</span>
          <span className="text-2xs text-textMuted">
            {range} meses até {formatMonthLong(month)}
          </span>
        </div>
        <div className="mt-3">
          <TrendTable
            rows={accountTrend}
            months={trendMonths}
            label="Conta"
            emptyMessage="Sem gastos direto em conta no período."
          />
        </div>
      </section>

      <section className="card mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="label-caps">Evolução por cartão</span>
          <span className="text-2xs text-textMuted">
            {range} meses até {formatMonthLong(month)}
          </span>
        </div>
        <div className="mt-3">
          <TrendTable
            rows={cardTrend}
            months={trendMonths}
            label="Cartão"
            emptyMessage="Sem compras no crédito no período."
          />
        </div>
      </section>

      <section className="card mt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="label-caps">Gastos por tag</span>
            <p className="mt-1 text-2xs text-textMuted">
              {tagLabel} · <Money value={tagExpense} /> no total
            </p>
          </div>
          <Suspense fallback={<div className="h-9" />}>
            <ReportScopeToggle paramKey="tagScope" scope={tagScope} />
          </Suspense>
        </div>
        <div className="mt-2">
          {tagRows.length ? (
            tagRows.map((row) => (
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
            <EmptyState message="Nenhuma transação com tag neste período." />
          )}
        </div>
      </section>
    </>
  );
}
