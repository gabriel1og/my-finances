import { describe, expect, it } from 'vitest';
import {
  currentMonth,
  formatCompact,
  formatCurrency,
  formatDate,
  formatMonthLabel,
  formatPercent,
  monthRange,
} from '@/lib/format';

/** O espaço do pt-BR entre símbolo e número é NBSP, não espaço comum. */
const normalize = (value: string) => value.replace(/ /g, ' ');

describe('formatCurrency', () => {
  it('formata em real com duas casas', () => {
    expect(normalize(formatCurrency(1234.5))).toBe('R$ 1.234,50');
  });

  it('respeita a moeda do perfil', () => {
    expect(normalize(formatCurrency(10, 'USD'))).toBe('US$ 10,00');
  });

  it('mantém o sinal de valores negativos', () => {
    expect(normalize(formatCurrency(-5))).toContain('5,00');
    expect(formatCurrency(-5)).toContain('-');
  });
});

describe('formatDate', () => {
  it('converte ISO para dd/mm/aaaa sem passar por Date', () => {
    // Passar por `new Date(iso)` traria o bug de fuso: em UTC-3 a data
    // voltaria um dia.
    expect(formatDate('2026-01-01')).toBe('01/01/2026');
    expect(formatDate('2026-12-31T00:00:00Z')).toBe('31/12/2026');
  });
});

describe('formatMonthLabel', () => {
  it('devolve o mês abreviado sem ponto', () => {
    expect(formatMonthLabel('2026-09-01')).toBe('set');
    expect(formatMonthLabel('2026-01-15')).toBe('jan');
  });
});

describe('formatPercent', () => {
  it('usa vírgula decimal e uma casa', () => {
    expect(formatPercent(87.25)).toBe('87,3%');
    expect(formatPercent(0)).toBe('0,0%');
  });
});

describe('formatCompact', () => {
  it('encurta valores grandes para caber no eixo do gráfico', () => {
    expect(formatCompact(1500)).toMatch(/1,5\s?mil/);
  });
});

describe('monthRange', () => {
  it('cobre o mês inteiro, inclusive fevereiro bissexto', () => {
    expect(monthRange('2026-09-13')).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(monthRange('2026-02-01')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthRange('2028-02-01')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
  });
});

describe('currentMonth', () => {
  it('devolve o primeiro dia do mês corrente', () => {
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}-01$/);
  });
});
