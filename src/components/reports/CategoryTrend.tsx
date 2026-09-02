'use client';

import { useMoney } from '@/lib/currency';
import { formatMonthLabel } from '@/lib/format';
import type { CategorySpending } from '@/types/database.types';

/**
 * Comparativo mês a mês por categoria. Tabela, não gráfico: com 8 categorias
 * e 6 meses, linhas viram espaguete — aqui o que se quer é comparar números
 * lado a lado e achar o mês fora da curva.
 *
 * No celular a tabela vira um bloco por categoria: seis colunas obrigavam a
 * rolar na horizontal, e ler número comparando com o que saiu da tela não
 * compara nada.
 */
export function CategoryTrend({ rows, months }: { rows: CategorySpending[]; months: string[] }) {
  const money = useMoney();

  const expense = rows.filter((row) => row.kind === 'expense');
  const categories = new Map<string, { name: string; color: string }>();
  for (const row of expense) {
    categories.set(row.category_id, { name: row.name, color: row.color });
  }

  const byKey = new Map(
    expense.map((row) => [`${row.category_id}:${row.month.slice(0, 7)}`, Number(row.spent)]),
  );

  const list = [...categories.entries()]
    .map(([id, meta]) => {
      const values = months.map((month) => byKey.get(`${id}:${month.slice(0, 7)}`) ?? 0);
      return { id, ...meta, values, total: values.reduce((sum, value) => sum + value, 0) };
    })
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);

  if (list.length === 0) {
    return <p className="text-xs text-textMuted">Sem despesas no período.</p>;
  }

  const monthTotals = months.map((_, index) =>
    list.reduce((sum, item) => sum + item.values[index], 0),
  );

  return (
    <>
      <div className="hidden lg:block">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="label-caps py-2 text-left font-medium">Categoria</th>
              {months.map((month) => (
                <th key={month} className="label-caps py-2 text-right font-medium">
                  {formatMonthLabel(month)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {list.map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="py-2 pr-4 text-sm text-textPrimary">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.name}
                  </span>
                </td>

                {item.values.map((value, index) => {
                  const previous = index > 0 ? item.values[index - 1] : null;
                  // Destaca só variação relevante: acima de 20% e com base > 0.
                  const jumped = previous !== null && previous > 0 && value > previous * 1.2;

                  return (
                    <td
                      key={months[index]}
                      className={`num py-2 text-right text-sm ${
                        value === 0
                          ? 'text-textMuted'
                          : jumped
                            ? 'text-warning'
                            : 'text-textPrimary'
                      }`}
                    >
                      {value === 0 ? '—' : money(value)}
                    </td>
                  );
                })}
              </tr>
            ))}

            <tr className="border-t border-borderHover">
              <td className="label-caps py-2">Total</td>
              {monthTotals.map((total, index) => (
                <td key={months[index]} className="num py-2 text-right text-sm text-expense">
                  {money(total)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="lg:hidden">
        {list.map((item) => (
          <div key={item.id} className="border-b border-border py-3 last:border-b-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex items-center gap-2 text-sm text-textPrimary">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {item.name}
              </span>
              <span className="num text-xs text-expense">{money(item.total)}</span>
            </div>

            <dl className="mt-2 grid grid-cols-3 gap-x-4 gap-y-1">
              {item.values.map((value, index) => (
                <div key={months[index]} className="flex items-baseline justify-between gap-2">
                  <dt className="label-caps">{formatMonthLabel(months[index])}</dt>
                  <dd
                    className={`num text-xs ${value === 0 ? 'text-textMuted' : 'text-textPrimary'}`}
                  >
                    {value === 0 ? '—' : money(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}

        <div className="flex items-baseline justify-between gap-2 border-t border-borderHover pt-3">
          <span className="label-caps">Total do período</span>
          <span className="num text-sm text-expense">
            {money(monthTotals.reduce((sum, value) => sum + value, 0))}
          </span>
        </div>
      </div>
    </>
  );
}
