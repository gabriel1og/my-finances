'use client';

import { useMoney } from '@/lib/currency';
import { formatMonthShort, spansYears } from '@/lib/format';
import type { TrendRow } from '@/lib/reports';

/**
 * Comparativo mês a mês de qualquer dimensão — categoria, conta ou cartão.
 *
 * Tabela, não gráfico: com oito linhas e seis meses, linhas viram espaguete —
 * aqui o que se quer é comparar números lado a lado e achar o mês fora da
 * curva.
 *
 * No celular a tabela vira um bloco por linha: seis colunas obrigavam a rolar
 * na horizontal, e ler número comparando com o que saiu da tela não compara
 * nada. Dentro do bloco, cada mês é um par empilhado — o rótulo em cima do
 * valor —, porque mês e valor lado a lado só cabem a partir de `sm`.
 */
export function TrendTable({
  rows,
  months,
  label,
  emptyMessage,
}: {
  rows: TrendRow[];
  months: string[];
  /** Cabeçalho da primeira coluna: "Categoria", "Conta", "Cartão". */
  label: string;
  emptyMessage: string;
}) {
  const money = useMoney();

  if (rows.length === 0) {
    return <p className="text-xs text-textMuted">{emptyMessage}</p>;
  }

  const monthTotals = months.map((_, index) =>
    rows.reduce((sum, item) => sum + item.values[index], 0),
  );

  // Com 12 ou 24 meses na tela a janela cruza a virada do ano, e "jan" sozinho
  // deixa de identificar a coluna.
  const withYear = spansYears(months);

  return (
    <>
      {/* A tabela rola dentro do próprio card: com 24 colunas ela passa da
          largura da tela, e quem não pode rolar na horizontal é a página. */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr>
              <th className="label-caps py-2 text-left font-medium">{label}</th>
              {months.map((month) => (
                <th key={month} className="label-caps py-2 pl-3 text-right font-medium">
                  {formatMonthShort(month, withYear)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((item) => (
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
                      className={`money py-2 text-right text-sm ${
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
                <td key={months[index]} className="money py-2 text-right text-sm text-expense">
                  {money(total)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="lg:hidden">
        {rows.map((item) => (
          <div key={item.id} className="border-b border-border py-3 last:border-b-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm text-textPrimary">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate">{item.name}</span>
              </span>
              <span className="money shrink-0 text-xs text-expense">{money(item.total)}</span>
            </div>

            {/* Par empilhado — rótulo em cima, valor embaixo — e no máximo duas
                colunas antes de `sm`. Lado a lado, três pares de mês e valor em
                BRL completo não cabem em 380px: o rótulo de um mês encavalava no
                valor do anterior ("R$ 1.455,65UN"), que é o pior tipo de erro de
                leitura, porque não parece erro, parece número. */}
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
              {item.values.map((value, index) => (
                <div key={months[index]} className="min-w-0">
                  <dt className="label-caps-tight">{formatMonthShort(months[index], withYear)}</dt>
                  <dd
                    className={`money text-xs ${value === 0 ? 'text-textMuted' : 'text-textPrimary'}`}
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
          <span className="money text-sm text-expense">
            {money(monthTotals.reduce((sum, value) => sum + value, 0))}
          </span>
        </div>
      </div>
    </>
  );
}
