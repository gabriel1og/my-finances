'use client';

import { useMoney } from '@/lib/currency';
import type { RolloverRow } from '@/lib/rollover';

/**
 * Orçamento acumulado das categorias com rollover ligado.
 *
 * Duas leituras da mesma lista: tabela a partir de `lg`, onde comparar seis
 * colunas lado a lado é o ponto, e um card por categoria no celular — rolar
 * uma tabela na horizontal para ler seis números é pior do que empilhar.
 */
export function RolloverTable({ rows }: { rows: RolloverRow[] }) {
  const money = useMoney();

  const columns = [
    { key: 'budget', label: 'Limite' },
    { key: 'carry', label: 'Acumulado' },
    { key: 'available', label: 'Disponível' },
    { key: 'spent', label: 'Gasto' },
    { key: 'left', label: 'Restante' },
  ] as const;

  function valueOf(row: RolloverRow, key: (typeof columns)[number]['key']) {
    if (key === 'left') return row.available - row.spent;
    return row[key];
  }

  function toneOf(row: RolloverRow, key: (typeof columns)[number]['key']) {
    if (key === 'carry') return row.carry >= 0 ? 'text-income' : 'text-warning';
    if (key === 'spent') return 'text-expense';
    if (key === 'left')
      return row.available - row.spent >= 0 ? 'text-textSecondary' : 'text-expense';
    if (key === 'available') return 'text-textPrimary';
    return 'text-textSecondary';
  }

  function render(row: RolloverRow, key: (typeof columns)[number]['key']) {
    const value = valueOf(row, key);
    // O sinal do acumulado importa mais que o número: é o que diz se a
    // categoria está sobrando ou devendo para si mesma.
    if (key === 'carry') return `${value >= 0 ? '+' : '−'}${money(Math.abs(value))}`;
    return money(value);
  }

  return (
    <>
      <div className="hidden lg:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="label-caps py-2 font-medium">Categoria</th>
              {columns.map((column) => (
                <th key={column.key} className="label-caps py-2 text-right font-medium">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.categoryId} className="border-b border-border last:border-b-0">
                <td className="py-2 pr-4">
                  <span className="flex items-center gap-2 text-textPrimary">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: row.color }}
                    />
                    {row.name}
                  </span>
                </td>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`num py-2 text-right text-xs ${toneOf(row, column.key)}`}
                  >
                    {render(row, column.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="lg:hidden">
        {rows.map((row) => (
          <div key={row.categoryId} className="border-b border-border py-3 last:border-b-0">
            <span className="flex items-center gap-2 text-sm text-textPrimary">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              {row.name}
            </span>

            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              {columns.map((column) => (
                <div key={column.key} className="flex items-baseline justify-between gap-2">
                  <dt className="label-caps">{column.label}</dt>
                  <dd className={`num text-xs ${toneOf(row, column.key)}`}>
                    {render(row, column.key)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}
