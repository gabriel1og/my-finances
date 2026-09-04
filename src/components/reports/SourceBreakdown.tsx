'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatPercent } from '@/lib/format';
import { useMoney } from '@/lib/currency';
import type { SourceTotal } from '@/lib/reports';

/**
 * Gasto do mês por origem — uma conta, um cartão.
 *
 * A barra é proporcional à maior origem, e o percentual ao lado é sobre o
 * total do bloco: número solto não diz se R$ 800 é a maior parte do mês ou
 * uma sobra. Cada linha é um link para onde aquele número se abre, porque a
 * pergunta seguinte a "gastei 800 nesse cartão" é sempre "em quê?".
 */
export function SourceBreakdown({
  rows,
  itemsNoun,
  linkTitle,
  emptyMessage,
  showIncome = false,
}: {
  rows: (SourceTotal & { href: string })[];
  /** Singular; o plural é o mesmo com "s". */
  itemsNoun: string;
  /** Prefixo do title do link — completado com o nome da origem. */
  linkTitle: string;
  emptyMessage: string;
  /** Conta tem receita; cartão não. */
  showIncome?: boolean;
}) {
  const money = useMoney();

  if (rows.length === 0) return <EmptyState message={emptyMessage} />;

  const largest = Math.max(...rows.map((row) => row.expense), 0);

  return (
    <div>
      {rows.map((row) => (
        <Link
          key={row.id}
          href={row.href as Route}
          title={`${linkTitle} ${row.name}`}
          className="group block border-b border-border py-2.5 last:border-b-0"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-sm text-textPrimary">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <span className="truncate transition-colors group-hover:text-accent">{row.name}</span>
            </span>
            <span className="num shrink-0 text-sm text-expense">{money(row.expense)}</span>
          </div>

          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-sm bg-surfaceAlt">
            <div
              className="h-1 origin-left animate-barGrow rounded-sm"
              style={{
                width: `${largest > 0 ? (row.expense / largest) * 100 : 0}%`,
                backgroundColor: row.color,
              }}
            />
          </div>

          <div className="mt-1 flex items-baseline justify-between gap-3">
            <p className="num text-3xs text-textMuted">
              {row.expense > 0
                ? `${formatPercent(row.share)} das despesas · ${row.items} ${itemsNoun}${
                    row.items === 1 ? '' : 's'
                  }`
                : 'Sem gastos neste mês'}
            </p>

            {showIncome && row.income > 0 ? (
              <p className="num shrink-0 text-3xs text-income">+ {money(row.income)} recebido</p>
            ) : null}
          </div>
        </Link>
      ))}
    </div>
  );
}
