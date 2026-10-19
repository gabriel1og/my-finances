import { describe, expect, it } from 'vitest';
import { isCardRefund, expenseEffect, statementEffect } from './card-refunds';

describe('estornos no cartão', () => {
  const refund = { type: 'income' as const, settlement: 'card' as const, amount: 150 };
  it('distingue estorno de receita na conta', () => {
    expect(isCardRefund(refund)).toBe(true);
    expect(isCardRefund({ ...refund, settlement: 'account' })).toBe(false);
  });
  it('reduz despesas e fatura sem limitar o crédito', () => {
    expect(expenseEffect(refund)).toBe(-150);
    expect(statementEffect(refund)).toBe(-150);
    expect(expenseEffect({ ...refund, type: 'expense', amount: 100 })).toBe(100);
    expect(expenseEffect({ ...refund, settlement: 'account' })).toBe(0);
  });
});
