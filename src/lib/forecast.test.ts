import { describe, expect, it } from 'vitest';
import { buildForecast, monthSequence, recurringAppliesTo } from '@/lib/forecast';
import type { CardStatement, RecurringWithRelations } from '@/types/database.types';

function statement(overrides: Partial<CardStatement> & { card_id: string; statement_month: string }) {
  return {
    user_id: 'user-1',
    name: 'Cartão',
    color: '#A78BFA',
    credit_limit: 5000,
    closing_day: 28,
    due_day: 10,
    is_archived: false,
    total: 0,
    paid: 0,
    open_amount: 0,
    due_date: '2026-10-10',
    closing_date: '2026-09-28',
    ...overrides,
  } as CardStatement;
}

function model(overrides: Partial<RecurringWithRelations> & { id: string }) {
  return {
    user_id: 'user-1',
    description: 'Fixo',
    amount: 100,
    type: 'expense',
    day_of_month: 5,
    category_id: null,
    settlement: 'account',
    account_id: null,
    card_id: null,
    payment_method: null,
    start_month: '2026-01-01',
    end_month: null,
    is_active: true,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    category: null,
    account: null,
    card: null,
    tags: [],
    ...overrides,
  } as RecurringWithRelations;
}

describe('monthSequence', () => {
  it('gera os meses a partir do informado, inclusive', () => {
    expect(monthSequence('2026-11-01', 3)).toEqual(['2026-11-01', '2026-12-01', '2027-01-01']);
  });
});

describe('recurringAppliesTo', () => {
  it('ignora modelo pausado', () => {
    expect(recurringAppliesTo(model({ id: 'a', is_active: false }), '2026-09-01')).toBe(false);
  });

  it('ignora modelo que ainda não começou', () => {
    expect(recurringAppliesTo(model({ id: 'a', start_month: '2026-10-01' }), '2026-09-01')).toBe(
      false,
    );
  });

  it('ignora modelo encerrado', () => {
    expect(recurringAppliesTo(model({ id: 'a', end_month: '2026-08-01' }), '2026-09-01')).toBe(
      false,
    );
  });

  it('aceita o mês exato do fim', () => {
    expect(recurringAppliesTo(model({ id: 'a', end_month: '2026-09-01' }), '2026-09-01')).toBe(true);
  });
});

describe('buildForecast', () => {
  const months = monthSequence('2026-09-01', 3);

  it('soma faturas e fixos no mês certo', () => {
    const [item] = buildForecast({
      months: ['2026-09-01'],
      statements: [
        statement({ card_id: 'c1', statement_month: '2026-09-01', total: 300 }),
        statement({ card_id: 'c2', statement_month: '2026-09-01', total: 200 }),
      ],
      recurring: [model({ id: 'r1', amount: 1500 })],
      postedRecurringIds: new Set(),
    });

    expect(item.cardTotal).toBe(500);
    expect(item.recurringExpense).toBe(1500);
    expect(item.committed).toBe(2000);
  });

  it('não conta fixo já lançado — senão ele apareceria duas vezes', () => {
    const [item] = buildForecast({
      months: ['2026-09-01'],
      statements: [],
      recurring: [model({ id: 'r1', amount: 900 })],
      postedRecurringIds: new Set(['r1']),
    });

    expect(item.recurringExpense).toBe(0);
    expect(item.committed).toBe(0);
  });

  it('separa receita fixa do comprometido', () => {
    const [item] = buildForecast({
      months: ['2026-09-01'],
      statements: [],
      recurring: [
        model({ id: 'r1', amount: 5000, type: 'income' }),
        model({ id: 'r2', amount: 1200 }),
      ],
      postedRecurringIds: new Set(),
    });

    expect(item.recurringIncome).toBe(5000);
    expect(item.recurringExpense).toBe(1200);
    expect(item.committed).toBe(1200);
  });

  it('distribui as parcelas nos meses corretos', () => {
    const forecast = buildForecast({
      months,
      statements: [
        statement({ card_id: 'c1', statement_month: '2026-09-01', total: 100 }),
        statement({ card_id: 'c1', statement_month: '2026-10-01', total: 100 }),
        statement({ card_id: 'c1', statement_month: '2026-11-01', total: 100 }),
      ],
      recurring: [],
      postedRecurringIds: new Set(),
    });

    expect(forecast.map((item) => item.cardTotal)).toEqual([100, 100, 100]);
  });

  it('respeita o fim do modelo ao longo dos meses', () => {
    const forecast = buildForecast({
      months,
      statements: [],
      recurring: [model({ id: 'r1', amount: 700, end_month: '2026-10-01' })],
      postedRecurringIds: new Set(),
    });

    expect(forecast.map((item) => item.recurringExpense)).toEqual([700, 700, 0]);
  });
});
