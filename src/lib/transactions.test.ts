import { describe, expect, it } from 'vitest';
import { groupTransfers } from '@/lib/transactions';
import type { TransactionWithCategory } from '@/types/database.types';

/** Fixture mínima: só os campos que groupTransfers lê. */
function tx(overrides: Partial<TransactionWithCategory> & { id: string }): TransactionWithCategory {
  return {
    user_id: 'user-1',
    category_id: null,
    type: 'expense',
    description: 'Lançamento',
    amount: 10,
    date: '2026-09-01',
    notes: null,
    settlement: 'account',
    account_id: null,
    card_id: null,
    payment_method: null,
    is_card_payment: false,
    card_payment_for: null,
    installment_group: null,
    installment_no: null,
    installment_total: null,
    is_transfer: false,
    transfer_group: null,
    created_at: '2026-09-01T12:00:00Z',
    updated_at: '2026-09-01T12:00:00Z',
    category: null,
    account: null,
    card: null,
    ...overrides,
  } as TransactionWithCategory;
}

function transferPair(group: string, amount: number, date: string) {
  return [
    tx({
      id: `${group}-out`,
      type: 'expense',
      amount,
      date,
      description: 'Transferência Conta A → Conta B',
      is_transfer: true,
      transfer_group: group,
      account_id: 'acc-a',
      account: { id: 'acc-a', name: 'Conta A', color: '#5B6EF5' },
    }),
    tx({
      id: `${group}-in`,
      type: 'income',
      amount,
      date,
      description: 'Transferência Conta A → Conta B',
      is_transfer: true,
      transfer_group: group,
      account_id: 'acc-b',
      account: { id: 'acc-b', name: 'Conta B', color: '#2ECC9A' },
    }),
  ];
}

describe('groupTransfers', () => {
  it('deixa lançamentos comuns intactos', () => {
    const entries = groupTransfers([tx({ id: 'a' }), tx({ id: 'b' })]);

    expect(entries).toHaveLength(2);
    expect(entries.every((entry) => entry.kind === 'single')).toBe(true);
    expect(entries.map((entry) => entry.key)).toEqual(['a', 'b']);
  });

  it('colapsa o par de uma transferência numa entrada só', () => {
    const entries = groupTransfers(transferPair('g1', 250, '2026-09-10'));

    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry.kind).toBe('transfer');
    if (entry.kind !== 'transfer') throw new Error('esperava transferência');

    expect(entry.group).toBe('g1');
    expect(entry.amount).toBe(250);
    expect(entry.date).toBe('2026-09-10');
    expect(entry.from).toBe('Conta A');
    expect(entry.to).toBe('Conta B');
    expect(entry.fromId).toBe('acc-a');
    expect(entry.toId).toBe('acc-b');
    // A ponta de referência é a de despesa, usada para editar e excluir.
    expect(entry.tx.type).toBe('expense');
  });

  it('preserva a ordem de chegada misturando transferência e lançamento', () => {
    const [out, into] = transferPair('g1', 100, '2026-09-05');
    const entries = groupTransfers([tx({ id: 'antes' }), out, into, tx({ id: 'depois' })]);

    expect(entries.map((entry) => entry.key)).toEqual(['antes', 'g1', 'depois']);
  });

  it('não mistura duas transferências do mesmo dia', () => {
    const entries = groupTransfers([
      ...transferPair('g1', 100, '2026-09-07'),
      ...transferPair('g2', 300, '2026-09-07'),
    ]);

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.key)).toEqual(['g1', 'g2']);
    expect(entries.map((entry) => (entry.kind === 'transfer' ? entry.amount : null))).toEqual([
      100, 300,
    ]);
  });

  it('lida com par partido pelo limite da query', () => {
    // No dashboard a query traz poucas linhas, então uma das pontas pode ficar
    // de fora. A entrada usa o lado disponível e omite o que não sabe.
    const [, into] = transferPair('g1', 80, '2026-09-09');
    const entries = groupTransfers([into]);

    expect(entries).toHaveLength(1);
    const [entry] = entries;
    if (entry.kind !== 'transfer') throw new Error('esperava transferência');

    expect(entry.from).toBeNull();
    expect(entry.fromId).toBeNull();
    expect(entry.to).toBe('Conta B');
    expect(entry.tx.id).toBe('g1-in');
  });

  it('devolve lista vazia para entrada vazia', () => {
    expect(groupTransfers([])).toEqual([]);
  });
});
