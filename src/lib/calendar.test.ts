import { describe, expect, it } from 'vitest';
import {
  lastDayOfMonth,
  monthGrid,
  parseDateInput,
  parseMonthInput,
  shiftDays,
  shiftISOMonths,
  shiftMonthKey,
  toISO,
} from '@/lib/calendar';

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

describe('shiftDays', () => {
  it('anda dentro do mês', () => {
    expect(shiftDays('2026-08-10', 5)).toBe('2026-08-15');
    expect(shiftDays('2026-08-10', -3)).toBe('2026-08-07');
  });

  it('atravessa mês e ano', () => {
    expect(shiftDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(shiftDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('conhece fevereiro bissexto', () => {
    expect(shiftDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('shiftISOMonths', () => {
  it('mantém o dia quando ele existe no destino', () => {
    expect(shiftISOMonths('2026-08-15', 1)).toBe('2026-09-15');
  });

  it('gruda no último dia quando o mês de destino é mais curto', () => {
    expect(shiftISOMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(shiftISOMonths('2026-03-31', -1)).toBe('2026-02-28');
  });

  it('vira o ano', () => {
    expect(shiftISOMonths('2026-01-10', -1)).toBe('2025-12-10');
  });
});

describe('parseDateInput', () => {
  const ref = '2026-08-20';

  it('entende só o dia', () => {
    expect(parseDateInput('5', ref)).toBe('2026-08-05');
  });

  it('entende dia e mês', () => {
    expect(parseDateInput('05/09', ref)).toBe('2026-09-05');
  });

  it('entende data completa, com e sem separador', () => {
    expect(parseDateInput('05/09/2025', ref)).toBe('2025-09-05');
    expect(parseDateInput('05092025', ref)).toBe('2025-09-05');
    expect(parseDateInput('05/09/25', ref)).toBe('2025-09-05');
  });

  it('recusa data impossível', () => {
    expect(parseDateInput('31/02/2026', ref)).toBeNull();
    expect(parseDateInput('10/13/2026', ref)).toBeNull();
    expect(parseDateInput('', ref)).toBeNull();
    expect(parseDateInput('abc', ref)).toBeNull();
  });
});

describe('parseMonthInput', () => {
  const ref = '2026-08-20';

  it('entende mês solto e mês com ano', () => {
    expect(parseMonthInput('3', ref)).toBe('2026-03');
    expect(parseMonthInput('03/27', ref)).toBe('2027-03');
    expect(parseMonthInput('03/2027', ref)).toBe('2027-03');
  });

  it('recusa mês inválido', () => {
    expect(parseMonthInput('13', ref)).toBeNull();
    expect(parseMonthInput('', ref)).toBeNull();
  });
});
