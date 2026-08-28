import { CategoryBar } from '@/components/ui/CategoryBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { currentMonth, formatCurrency } from '@/lib/format';
import { getCategorySpending } from '@/lib/queries';

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month = currentMonth() } = await searchParams;
  const spending = await getCategorySpending(month);

  return (
    <>
      <PageHeader title="Categorias" subtitle="Limites e consumo do mês" />

      {spending.length ? (
        <div className="grid grid-cols-3 gap-4">
          {spending.map((row) => (
            <div key={row.category_id} className="card">
              <div className="flex items-center justify-between">
                <span className="label-caps">{row.name}</span>
                <span className="num text-xs text-textMuted">
                  restam {formatCurrency(Math.max(Number(row.budget) - Number(row.spent), 0))}
                </span>
              </div>
              <CategoryBar
                name={row.name}
                color={row.color}
                spent={Number(row.spent)}
                budget={Number(row.budget)}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message="Nenhuma categoria com movimentação neste mês." />
      )}
    </>
  );
}
