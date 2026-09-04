import { TrendTable } from '@/components/reports/TrendTable';
import { buildTrendRows } from '@/lib/reports';
import type { CategorySpending } from '@/types/database.types';

/**
 * Comparativo por categoria. A montagem e o desenho são os mesmos de conta e
 * cartão — aqui só se traduz a linha da view para a forma comum.
 */
export function CategoryTrend({ rows, months }: { rows: CategorySpending[]; months: string[] }) {
  const trend = buildTrendRows(
    rows
      .filter((row) => row.kind === 'expense')
      .map((row) => ({
        id: row.category_id,
        name: row.name,
        color: row.color,
        month: row.month,
        expense: Number(row.spent),
        items: 0,
      })),
    months,
  );

  return (
    <TrendTable
      rows={trend}
      months={months}
      label="Categoria"
      emptyMessage="Sem despesas no período."
    />
  );
}
