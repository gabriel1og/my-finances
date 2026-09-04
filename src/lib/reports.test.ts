import { describe, expect, it } from 'vitest';
import { DEFAULT_REPORT_RANGE } from '@/lib/constants';
import {
  buildSourceTotals,
  buildTrendRows,
  parseReportRange,
  type SourceMonthRow,
} from '@/lib/reports';

function row(overrides: Partial<SourceMonthRow> & { id: string }): SourceMonthRow {
  return {
    name: 'Origem',
    color: '#5B6EF5',
    month: '2026-09-01',
    expense: 0,
    items: 0,
    ...overrides,
  };
}

describe('buildSourceTotals', () => {
  const rows = [
    row({ id: 'a', name: 'Nubank', expense: 300, items: 4 }),
    row({ id: 'b', name: 'Itaú', expense: 700, items: 6 }),
  ];

  it('ordena do maior gasto para o menor', () => {
    expect(buildSourceTotals(rows).map((item) => item.name)).toEqual(['Itaú', 'Nubank']);
  });

  it('calcula a fatia sobre o total do grupo', () => {
    const [maior, menor] = buildSourceTotals(rows);
    expect(maior.share).toBe(70);
    expect(menor.share).toBe(30);
  });

  it('soma as linhas da mesma origem quando a janela traz vários meses', () => {
    const total = buildSourceTotals([
      row({ id: 'a', expense: 100, items: 1 }),
      row({ id: 'a', month: '2026-08-01', expense: 50, items: 2 }),
    ]);

    expect(total[0].expense).toBe(150);
    expect(total[0].items).toBe(3);
  });

  it('mantém conta que só recebeu — some justo de onde se procura por ela', () => {
    const total = buildSourceTotals([row({ id: 'a', name: 'Salário', expense: 0, income: 5000 })]);

    expect(total).toHaveLength(1);
    expect(total[0].income).toBe(5000);
    // Sem despesa no grupo, não há fatia a mostrar.
    expect(total[0].share).toBe(0);
  });

  it('descarta origem sem movimento nenhum', () => {
    expect(buildSourceTotals([row({ id: 'a', expense: 0, income: 0 })])).toEqual([]);
  });
});

describe('buildTrendRows', () => {
  const months = ['2026-07-01', '2026-08-01', '2026-09-01'];

  it('põe um valor por mês, na ordem pedida, com zero no mês sem movimento', () => {
    const trend = buildTrendRows(
      [
        row({ id: 'a', name: 'Itaú', month: '2026-07-01', expense: 100 }),
        row({ id: 'a', name: 'Itaú', month: '2026-09-01', expense: 300 }),
      ],
      months,
    );

    expect(trend[0].values).toEqual([100, 0, 300]);
    expect(trend[0].total).toBe(400);
  });

  it('ordena pelo total do período', () => {
    const trend = buildTrendRows(
      [
        row({ id: 'a', name: 'Itaú', expense: 100 }),
        row({ id: 'b', name: 'Nubank', expense: 500 }),
      ],
      months,
    );

    expect(trend.map((item) => item.name)).toEqual(['Nubank', 'Itaú']);
  });

  it('deixa de fora a origem sem gasto no período — seria uma faixa de traços', () => {
    const trend = buildTrendRows([row({ id: 'a', month: '2026-05-01', expense: 900 })], months);
    expect(trend).toEqual([]);
  });
});

describe('parseReportRange', () => {
  it('aceita as janelas oferecidas', () => {
    expect(parseReportRange('3')).toBe(3);
    expect(parseReportRange('24')).toBe(24);
  });

  it('cai no padrão sem parâmetro', () => {
    expect(parseReportRange(null)).toBe(DEFAULT_REPORT_RANGE);
    expect(parseReportRange(undefined)).toBe(DEFAULT_REPORT_RANGE);
  });

  it('cai no padrão com valor fora da lista — URL editada à mão não quebra a página', () => {
    expect(parseReportRange('7')).toBe(DEFAULT_REPORT_RANGE);
    expect(parseReportRange('abacaxi')).toBe(DEFAULT_REPORT_RANGE);
    expect(parseReportRange('')).toBe(DEFAULT_REPORT_RANGE);
  });
});
