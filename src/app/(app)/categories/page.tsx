import { CategoryCard } from '@/components/categories/CategoryCard';
import { CategoryFormModal } from '@/components/categories/CategoryFormModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { currentMonth, formatCurrency } from '@/lib/format';
import { getCategories, getCategorySpending, getMonthBudgets } from '@/lib/queries';
import type { Category } from '@/types/database.types';

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month = currentMonth() } = await searchParams;

  const [categories, spending, budgets] = await Promise.all([
    getCategories(true),
    getCategorySpending(month),
    getMonthBudgets(month),
  ]);

  const totalByCategory = new Map(spending.map((row) => [row.category_id, Number(row.spent)]));
  const overrideByCategory = new Map(budgets.map((row) => [row.category_id, Number(row.amount)]));

  const active = categories.filter((category) => !category.is_archived);
  const expense = active.filter((category) => category.kind === 'expense');
  const income = active.filter((category) => category.kind === 'income');
  const archived = categories.filter((category) => category.is_archived);

  function renderCard(category: Category) {
    const override = overrideByCategory.get(category.id) ?? null;
    return (
      <CategoryCard
        key={category.id}
        category={category}
        month={month}
        spent={totalByCategory.get(category.id) ?? 0}
        budget={override ?? Number(category.budget)}
        monthOverride={override}
      />
    );
  }

  const expenseTotal = expense.reduce(
    (sum, category) => sum + (totalByCategory.get(category.id) ?? 0),
    0,
  );
  const incomeTotal = income.reduce(
    (sum, category) => sum + (totalByCategory.get(category.id) ?? 0),
    0,
  );

  return (
    <>
      <PageHeader
        title="Categorias"
        subtitle="Limites e consumo do mês"
        action={<CategoryFormModal />}
      />

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <span className="label-caps">Despesas</span>
          <span className="num text-xs text-expense">{formatCurrency(expenseTotal)}</span>
        </div>

        {expense.length ? (
          <div className="grid grid-cols-3 gap-4">{expense.map(renderCard)}</div>
        ) : (
          <EmptyState message="Nenhuma categoria de despesa." />
        )}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="label-caps">Receitas</span>
          <span className="num text-xs text-income">{formatCurrency(incomeTotal)}</span>
        </div>

        {income.length ? (
          <div className="grid grid-cols-3 gap-4">{income.map(renderCard)}</div>
        ) : (
          <EmptyState message="Nenhuma categoria de receita. Crie uma para classificar salário, freelas, rendimentos." />
        )}
      </section>

      {archived.length ? (
        <section className="mt-8">
          <span className="label-caps">Arquivadas</span>
          <div className="mt-3 grid grid-cols-3 gap-4">{archived.map(renderCard)}</div>
        </section>
      ) : null}
    </>
  );
}
