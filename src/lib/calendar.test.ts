import { describe, expect, it } from 'vitest';
import { lastDayOfMonth, monthGrid, shiftMonthKey, toISO } from '@/lib/calendar';

describe('lastDayOfMonth', () => {
  it('conhece os meses de 30 e 31 dias', () => {
    expect(lastDayOfMonth(2026, 1)).toBe(31);
    expect(lastDayOfMonth(2026, 4)).toBe(30);
  });

  it('trata fevereiro e ano bissexto', () => {
    expect(lastDayOfMonth(2026, 2)).toBe(28);
    expect(lastDayOfMonth(2028, 2)).toBe(29);
  });
});

describe('monthGrid', () => {
  it('sempre devolve 42 células, para o popover não mudar de altura', () => {
    expect(monthGrid(2026, 2)).toHaveLength(42);
    expect(monthGrid(2026, 8)).toHaveLength(42);
  });

  it('posiciona o dia 1 no dia da semana correto', () => {
    // 01/09/2026 é uma terça — índice 2 na semana começando no domingo.
    const grid = monthGrid(2026, 9);
    expect(grid[0].iso).toBeNull();
    expect(grid[1].iso).toBeNull();
    expect(grid[2].iso).toBe('2026-09-01');
  });

  it('não inventa dias além do último', () => {
    const grid = monthGrid(2026, 2);
    const dias = grid.filter((cell) => cell.iso !== null);
    expect(dias).toHaveLength(28);
    expect(dias[dias.length - 1].iso).toBe('2026-02-28');
  });
});

describe('shiftMonthKey', () => {
  it('avança e volta dentro do ano', () => {
    expect(shiftMonthKey('2026-09', 1)).toBe('2026-10');
    expect(shiftMonthKey('2026-09', -1)).toBe('2026-08');
  });

  it('vira o ano nas duas direções', () => {
    expect(shiftMonthKey('2026-12', 1)).toBe('2027-01');
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12');
  });

  it('aceita saltos longos', () => {
    expect(shiftMonthKey('2026-09', 12)).toBe('2027-09');
    expect(shiftMonthKey('2026-09', -20)).toBe('2025-01');
  });
});

describe('toISO', () => {
  it('preenche mês e dia com zero à esquerda', () => {
    expect(toISO(2026, 9, 5)).toBe('2026-09-05');
  });
});
