'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useMoney } from '@/lib/currency';
import type { CategorySpending } from '@/types/database.types';

/**
 * Donut da composição de despesas. Só entram categorias com gasto — fatia de
 * valor zero é ruído, não informação.
 */
export function ExpensePie({ data }: { data: CategorySpending[] }) {
  const money = useMoney();

  const slices = data
    .filter((row) => row.kind === 'expense' && Number(row.spent) > 0)
    .map((row) => ({
      name: row.name,
      value: Number(row.spent),
      color: row.color,
    }));

  if (slices.length === 0) return null;

  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <div className="flex items-center gap-6">
      <div className="h-[180px] w-[180px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius={52}
              outerRadius={78}
              paddingAngle={2}
              stroke="none"
            >
              {slices.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#181C27',
                border: '1px solid #2A2F45',
                borderRadius: 8,
                fontSize: 12,
                fontFamily: 'var(--font-jetbrains-mono)',
              }}
              formatter={(value: number, name) => [money(value), name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legenda com percentual: o donut mostra proporção, o número confirma. */}
      <div className="min-w-0 flex-1">
        {slices.slice(0, 6).map((slice) => (
          <div key={slice.name} className="flex items-center justify-between py-1">
            <span className="flex items-center gap-2 truncate text-xs text-textSecondary">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              {slice.name}
            </span>
            <span className="num shrink-0 pl-2 text-xs text-textPrimary">
              {money(slice.value)}
              <span className="pl-2 text-textMuted">
                {((slice.value / total) * 100).toFixed(0)}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
