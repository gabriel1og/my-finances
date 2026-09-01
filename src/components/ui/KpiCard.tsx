'use client';

import { useMoney } from '@/lib/currency';

type Tone = 'neutral' | 'income' | 'expense';

const TONE: Record<Tone, string> = {
  neutral: 'text-textPrimary',
  income: 'text-income',
  expense: 'text-expense',
};

export function KpiCard({
  label,
  value,
  subtitle,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  subtitle?: React.ReactNode;
  tone?: Tone;
}) {
  const money = useMoney();

  return (
    <div className="card">
      <span className="label-caps">{label}</span>
      <p className={`num mt-2 text-2xl font-medium ${TONE[tone]}`}>{money(value)}</p>
      {subtitle ? <p className="mt-1 text-xs text-textSecondary">{subtitle}</p> : null}
    </div>
  );
}
