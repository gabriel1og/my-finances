import { FlowChart } from '@/components/charts/FlowChart';
import { EmptyState } from '@/components/ui/EmptyState';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { CategoryBar } from '@/components/ui/CategoryBar';
import { currentMonth } from '@/lib/format';
import { Money } from '@/lib/currency';
import { getCategorySpending, getMonthlyFlow, getTagTotals } from '@/lib/queries';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month = currentMonth() } = await searchParams;
  const [flow, spending, tagTotals] = await Promise.all([
    getMonthlyFlow(3),
    getCategorySpending(month),
    getTagTotals(month),
  ]);

  const expenseSpending = spending.filter((row) => row.kind === 'expense');

  const income = flow.reduce((sum, row) => sum + Number(row.income), 0);
  const expense = flow.reduce((sum, row) => sum + Number(row.expense), 0);

  return (
    <>
      <PageHeader title="Relatórios" subtitle="Resumo dos últimos 3 meses" />

      <section className="grid grid-cols-3 gap-4">
        <KpiCard label="Receitas no trimestre" value={income} tone="income" />
        <KpiCard label="Despesas no trimestre" value={expense} tone="expense" />
        <KpiCard label="Resultado" value={income - expense} subtitle="Receitas − despesas" />
      </section>

      <section className="mt-4 grid grid-cols-3 gap-4">
        <div className="card col-span-2">
          <span className="label-caps">Fluxo trimestral</span>
          <div className="mt-4">
            {flow.length ? <FlowChart data={flow} /> : <EmptyState message="Sem dados ainda." />}
          </div>
        </div>

        <div className="card">
          <span className="label-caps">Despesas por categoria</span>
          <div className="mt-2">
            {expenseSpending.length ? (
              expenseSpending.map((row) => (
                <CategoryBar
                  key={row.category_id}
                  name={row.name}
                  color={row.color}
                  spent={Number(row.spent)}
                  budget={Number(row.budget)}
                />
              ))
            ) : (
              <EmptyState message="Sem despesas no mês selecionado." />
            )}
          </div>
        </div>
      </section>
      <section className="card mt-4">
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
                  <span className="num text-[11px] text-textMuted">{row.items} lançamento(s)</span>
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
