import { CategoryCard } from '@/components/categories/CategoryCard';
import { CategoryFormModal } from '@/components/categories/CategoryFormModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { currentMonth } from '@/lib/format';
import { getCategories, getCategorySpending, getMonthBudgets } from '@/lib/queries';

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

  const spentByCategory = new Map(spending.map((row) => [row.category_id, Number(row.spent)]));
  const overrideByCategory = new Map(budgets.map((row) => [row.category_id, Number(row.amount)]));

  const active = categories.filter((category) => !category.is_archived);
  const archived = categories.filter((category) => category.is_archived);

  return (
    <>
      <PageHeader
        title="Categorias"
        subtitle="Limites e consumo do mês"
        action={<CategoryFormModal />}
      />

      {active.length ? (
        <div className="grid grid-cols-3 gap-4">
          {active.map((category) => {
            const override = overrideByCategory.get(category.id) ?? null;
            return (
              <CategoryCard
                key={category.id}
                category={category}
                month={month}
                spent={spentByCategory.get(category.id) ?? 0}
                budget={override ?? Number(category.budget)}
                monthOverride={override}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState message="Nenhuma categoria ativa. Crie a primeira." />
      )}

      {archived.length ? (
        <section className="mt-8">
          <span className="label-caps">Arquivadas</span>
          <div className="mt-3 grid grid-cols-3 gap-4">
            {archived.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                month={month}
                spent={spentByCategory.get(category.id) ?? 0}
                budget={Number(category.budget)}
                monthOverride={overrideByCategory.get(category.id) ?? null}
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
