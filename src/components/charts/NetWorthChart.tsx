'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useMoney } from '@/lib/currency';
import { formatCompact, formatMonthLabel } from '@/lib/format';
import type { NetWorthPoint } from '@/types/database.types';

export function NetWorthChart({ data }: { data: NetWorthPoint[] }) {
  const money = useMoney();

  const rows = data.map((point) => ({
    month: formatMonthLabel(point.month),
    net: Number(point.net_worth),
  }));

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows}>
          <defs>
            <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5B6EF5" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#5B6EF5" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="#2A2F45" vertical={false} />
          <XAxis
            dataKey="month"
            stroke="#4A5070"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#7B82A0', fontSize: 11 }}
          />
          <YAxis
            stroke="#4A5070"
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={formatCompact}
            tick={{ fill: '#7B82A0', fontSize: 11 }}
          />
          <Tooltip
            cursor={{ stroke: '#3A4060' }}
            contentStyle={{
              background: '#181C27',
              border: '1px solid #2A2F45',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: '#7B82A0' }}
            formatter={(value: number) => [money(value), 'Saldo acumulado']}
          />
          <Area
            type="monotone"
            dataKey="net"
            stroke="#5B6EF5"
            strokeWidth={2}
            fill="url(#netWorthFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
