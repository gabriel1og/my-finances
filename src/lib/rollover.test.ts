import { describe, expect, it } from 'vitest';
import { buildRolloverRows, computeRollover } from '@/lib/rollover';
import type { RolloverCategory } from '@/lib/rollover';
import type { CategorySpending } from '@/types/database.types';

function row(month: string, budget: number, spent: number): CategorySpending {
  return {
    user_id: 'user-1',
    category_id: 'cat-1',
    name: 'Alimentação',
    color: '#5B6EF5',
    kind: 'expense',
    month: `${month}-01`,
    spent,
    budget,
    pct_used: budget > 0 ? (spent / budget) * 100 : null,
  } as CategorySpending;
}

const base = {
  rows: [row('2026-06', 500, 400), row('2026-07', 500, 550), row('2026-08', 500, 300)],
  categoryId: 'cat-1',
  month: '2026-09-01',
  monthBudget: 500,
};

describe('computeRollover', () => {
  it('devolve só o limite quando o rollover está desligado', () => {
    const result = computeRollover({ ...base, since: null });

    expect(result.carry).toBe(0);
    expect(result.available).toBe(500);
    expect(result.monthsCounted).toBe(0);
  });

  it('soma sobras e estouros dos meses anteriores', () => {
    // +100 (jun) −50 (jul) +200 (ago) = +250
    const result = computeRollover({ ...base, since: '2026-06-01' });

    expect(result.carry).toBe(250);
    expect(result.available).toBe(750);
    expect(result.monthsCounted).toBe(3);
  });

  it('conta só a partir de rollover_since', () => {
    const result = computeRollover({ ...base, since: '2026-08-01' });

    expect(result.carry).toBe(200);
    expect(result.available).toBe(700);
    expect(result.monthsCounted).toBe(1);
  });

  it('ignora o mês corrente e os futuros', () => {
    const result = computeRollover({
      ...base,
      rows: [...base.rows, row('2026-09', 500, 480), row('2026-10', 500, 0)],
      since: '2026-06-01',
    });

    expect(result.carry).toBe(250);
    expect(result.monthsCounted).toBe(3);
  });

  it('ignora mês sem limite definido — orçamento zero é "não orçado"', () => {
    const result = computeRollover({
      ...base,
      rows: [row('2026-06', 0, 900), row('2026-07', 500, 400)],
      since: '2026-06-01',
    });

    expect(result.carry).toBe(100);
    expect(result.monthsCounted).toBe(1);
  });

  it('deixa o disponível abaixo do limite quando houve estouro acumulado', () => {
    const result = computeRollover({
      ...base,
      rows: [row('2026-07', 500, 800), row('2026-08', 500, 700)],
      since: '2026-07-01',
    });

    expect(result.carry).toBe(-500);
    expect(result.available).toBe(0);
  });

  it('não mistura categorias', () => {
    const other = { ...row('2026-08', 500, 100), category_id: 'cat-2' } as CategorySpending;
    const result = computeRollover({ ...base, rows: [other], since: '2026-06-01' });

    expect(result.carry).toBe(0);
  });
});

describe('buildRolloverRows', () => {
  const history = [row('2026-07', 500, 400), row('2026-08', 500, 300)];
  const current = [row('2026-09', 500, 120)];

  const withRollover: RolloverCategory = {
    id: 'cat-1',
    kind: 'expense',
    rollover_enabled: true,
    rollover_since: '2026-07-01',
  };

  it('soma o acumulado ao disponível quando o rollover está ligado', () => {
    const [result] = buildRolloverRows({
      spending: current,
      history,
      categories: [withRollover],
      month: '2026-09-01',
    });

    expect(result.budget).toBe(500);
    expect(result.carry).toBe(300);
    expect(result.available).toBe(800);
    expect(result.spent).toBe(120);
  });

  it('devolve carry zero para categoria sem rollover', () => {
    const [result] = buildRolloverRows({
      spending: current,
      history,
      categories: [{ ...withRollover, rollover_enabled: false }],
      month: '2026-09-01',
    });

    expect(result.carry).toBe(0);
    expect(result.available).toBe(500);
  });

  it('ignora categorias de receita', () => {
    const income = { ...row('2026-09', 0, 3000), kind: 'income' } as CategorySpending;

    expect(
      buildRolloverRows({
        spending: [income],
        history: [],
        categories: [withRollover],
        month: '2026-09-01',
      }),
    ).toHaveLength(0);
  });

  it('não quebra com categoria ausente da lista', () => {
    const [result] = buildRolloverRows({
      spending: current,
      history,
      categories: [],
      month: '2026-09-01',
    });

    expect(result.carry).toBe(0);
  });
});
