import { describe, expect, it } from 'vitest';
import { shiftMonths, splitInstallments } from '@/lib/installments';

describe('splitInstallments', () => {
  it('divide em partes iguais quando o valor é divisível', () => {
    expect(splitInstallments(300, 3)).toEqual([100, 100, 100]);
  });

  it('joga a sobra dos centavos na primeira parcela', () => {
    // 100 / 3 = 33,333...  -> 33,34 + 33,33 + 33,33
    expect(splitInstallments(100, 3)).toEqual([33.34, 33.33, 33.33]);
  });

  it('mantém a soma exatamente igual ao valor da compra', () => {
    const cases: Array<[number, number]> = [
      [100, 3],
      [0.1, 3],
      [1234.56, 7],
      [999.99, 12],
      [10, 12],
      [4321.09, 11],
    ];

    for (const [total, count] of cases) {
      const parts = splitInstallments(total, count);
      const sumCents = parts.reduce((sum, part) => sum + Math.round(part * 100), 0);
      expect(sumCents).toBe(Math.round(total * 100));
      expect(parts).toHaveLength(count);
    }
  });

  it('gera uma parcela só quando count é 1', () => {
    expect(splitInstallments(49.9, 1)).toEqual([49.9]);
  });

  it('não produz parcela negativa nem zero em valores pequenos', () => {
    const parts = splitInstallments(0.03, 3);
    expect(parts).toEqual([0.01, 0.01, 0.01]);
  });
});

describe('shiftMonths', () => {
  it('mantém o dia quando o mês de destino é longo o bastante', () => {
    expect(shiftMonths('2026-01-15', 1)).toBe('2026-02-15');
    expect(shiftMonths('2026-01-15', 0)).toBe('2026-01-15');
  });

  it('grampeia o dia 31 ao último dia de fevereiro', () => {
    expect(shiftMonths('2026-01-31', 1)).toBe('2026-02-28');
  });

  it('respeita ano bissexto', () => {
    // 2028 é bissexto.
    expect(shiftMonths('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('grampeia o dia 31 em meses de 30 dias', () => {
    expect(shiftMonths('2026-03-31', 1)).toBe('2026-04-30');
  });

  it('vira o ano corretamente', () => {
    expect(shiftMonths('2026-11-30', 2)).toBe('2027-01-30');
    expect(shiftMonths('2026-12-31', 12)).toBe('2027-12-31');
  });

  it('não perde o dia original em parcelas seguidas', () => {
    // A parcela 3 de uma compra em 31/01 volta a cair no dia 31 em abril? Não:
    // cada parcela é calculada a partir da data original, então março tem 31.
    expect(shiftMonths('2026-01-31', 2)).toBe('2026-03-31');
  });
});
