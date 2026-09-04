'use client';

import { formatPercent } from '@/lib/format';
import { useMoney } from '@/lib/currency';
import type { TransactionWithCategory } from '@/types/database.types';

const NO_CATEGORY = { id: 'none', name: 'Sem categoria', color: '#4A5070' };

/**
 * O peso de cada categoria dentro da fatura.
 *
 * A barra é proporcional à maior categoria, não ao total: com oito categorias
 * na fatura, a fatia de cada uma sobre o total vira um traço de dois pixels e
 * a comparação entre elas some. O percentual ao lado continua sendo sobre o
 * total — é o número que responde "quanto disso foi mercado".
 */
export function StatementCategories({ transactions }: { transactions: TransactionWithCategory[] }) {
  const money = useMoney();

  const totals = new Map<string, { name: string; color: string; amount: number; count: number }>();
  for (const tx of transactions) {
    const category = tx.category ?? NO_CATEGORY;
    const current = totals.get(category.id) ?? {
      name: category.name,
      color: category.color,
      amount: 0,
      count: 0,
    };
    current.amount += Number(tx.amount);
    current.count += 1;
    totals.set(category.id, current);
  }

  const rows = [...totals.entries()]
    .map(([id, row]) => ({ id, ...row }))
    .sort((a, b) => b.amount - a.amount);

  if (rows.length === 0) return null;

  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const largest = rows[0].amount;

  return (
    <section className="card">
      <h2 className="label-caps">Por categoria</h2>

      <div className="mt-3 space-y-3">
        {rows.map((row) => (
          <div key={row.id}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="flex min-w-0 items-center gap-2 text-textPrimary">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
                <span className="truncate">{row.name}</span>
              </span>
              <span className="num shrink-0 text-textSecondary">{money(row.amount)}</span>
            </div>

            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-sm bg-surfaceAlt">
              <div
                className="h-1 origin-left animate-barGrow rounded-sm"
                style={{
                  width: `${largest > 0 ? (row.amount / largest) * 100 : 0}%`,
                  backgroundColor: row.color,
                }}
              />
            </div>

            <p className="num mt-1 text-3xs text-textMuted">
              {formatPercent(total > 0 ? (row.amount / total) * 100 : 0)} da fatura · {row.count}{' '}
              lançamento{row.count === 1 ? '' : 's'}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
