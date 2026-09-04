'use client';

import { useMoney } from '@/lib/currency';
import type { RolloverRow } from '@/lib/rollover';

/**
 * Orçamento acumulado das categorias com rollover ligado.
 *
 * Duas leituras da mesma lista: tabela a partir de `lg`, onde comparar seis
 * colunas lado a lado é o ponto, e um card por categoria no celular — rolar
 * uma tabela na horizontal para ler seis números é pior do que empilhar.
 *
 * No card, quem carrega o sinal é a barra, não o texto: uma tela de orçamento
 * em que tudo está em número obriga a fazer a divisão de cabeça a cada linha.
 * Os cinco campos ficam abaixo dela como detalhe, com o rótulo em cima do
 * valor — lado a lado, cinco rótulos em caixa-alta comiam metade da largura.
 */
export function RolloverTable({ rows }: { rows: RolloverRow[] }) {
  const money = useMoney();

  const columns = [
    { key: 'budget', label: 'Limite', short: 'Limite' },
    { key: 'carry', label: 'Acumulado', short: 'Acum.' },
    { key: 'available', label: 'Disponível', short: 'Disp.' },
    { key: 'spent', label: 'Gasto', short: 'Gasto' },
    { key: 'left', label: 'Restante', short: 'Restante' },
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

  /** Categoria sem limite e sem acumulado não tem orçamento para comparar. */
  function isBudgeted(row: RolloverRow) {
    return row.budget > 0 || row.carry !== 0;
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
                    className={`money py-2 text-right text-xs ${toneOf(row, column.key)}`}
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
        {rows.map((row) => {
          const budgeted = isBudgeted(row);
          const over = budgeted && row.spent > row.available;
          const pct =
            budgeted && row.available > 0 ? Math.min((row.spent / row.available) * 100, 100) : 100;

          return (
            <div key={row.categoryId} className="border-b border-border py-3 last:border-b-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-sm text-textPrimary">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className="truncate">{row.name}</span>
                </span>
                <span
                  className={`money shrink-0 text-xs ${over ? 'text-expense' : 'text-textSecondary'}`}
                >
                  {money(row.spent)}
                  {budgeted ? ` / ${money(row.available)}` : ''}
                </span>
              </div>

              {budgeted ? (
                <>
                  {/* A barra é o sinal primário; os números abaixo dela são
                      detalhe. Sem limite não há barra: trilho vazio não diz
                      nada e ainda parece um gasto de zero. */}
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-sm bg-surfaceAlt">
                    <div
                      className="h-1 origin-left animate-barGrow rounded-sm"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: over ? '#F05C5C' : row.color,
                      }}
                    />
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
                    {columns.map((column) => (
                      <div key={column.key} className="min-w-0">
                        <dt className="label-caps-tight">{column.short}</dt>
                        <dd className={`money text-xs ${toneOf(row, column.key)}`}>
                          {render(row, column.key)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : (
                // Repetir quatro "R$ 0,00" por categoria é muito pixel para
                // informação nenhuma: uma frase diz o mesmo e some do caminho.
                <p className="mt-1.5 text-2xs text-textMuted">
                  Sem limite definido — só o gasto do mês.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
