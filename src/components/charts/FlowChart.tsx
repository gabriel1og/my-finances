'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCompact, formatMonthLabel } from '@/lib/format';
import { useMoney } from '@/lib/currency';
import type { MonthlyFlow } from '@/types/database.types';

export function FlowChart({ data }: { data: MonthlyFlow[] }) {
  const money = useMoney();
  const rows = data.map((row) => ({
    month: formatMonthLabel(row.month),
    income: Number(row.income),
    expense: Number(row.expense),
  }));

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} barGap={4}>
          <CartesianGrid stroke="#2A2F45" vertical={false} />
          <XAxis
            dataKey="month"
            stroke="#4A5070"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#7B82A0', fontSize: 11, fontFamily: 'var(--font-jetbrains-mono)' }}
          />
          <YAxis
            stroke="#4A5070"
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={formatCompact}
            tick={{ fill: '#7B82A0', fontSize: 11, fontFamily: 'var(--font-jetbrains-mono)' }}
          />
          <Tooltip
            cursor={{ fill: '#1E2333' }}
            contentStyle={{
              background: '#181C27',
              border: '1px solid #2A2F45',
              borderRadius: 8,
              fontSize: 12,
              fontFamily: 'var(--font-jetbrains-mono)',
            }}
            labelStyle={{ color: '#7B82A0' }}
            formatter={(value: number, name) => [
              money(value),
              name === 'income' ? 'Receitas' : 'Despesas',
            ]}
          />
          <Bar dataKey="income" fill="#2ECC9A" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" fill="#F05C5C" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
