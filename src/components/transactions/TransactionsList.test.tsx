import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import type { Entry } from '@/lib/transactions';
import type { TransactionWithCategory } from '@/types/database.types';

vi.mock('@/components/ui/TxRow', () => ({
  TxRow: ({ tx }: { tx: TransactionWithCategory }) => <div>{tx.description}</div>,
}));

vi.mock('@/components/ui/TransferRow', () => ({
  TransferRow: ({ entry }: { entry: Extract<Entry, { kind: 'transfer' }> }) => (
    <div>{entry.description}</div>
  ),
}));

const { TransactionsList } = await import('@/components/transactions/TransactionsList');

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
    tags: [],
    ...overrides,
  } as TransactionWithCategory;
}

describe('TransactionsList', () => {
  it('mostra o total líquido dos lançamentos presentes', () => {
    renderWithProviders(
      <TransactionsList
        transactions={[
          tx({ id: 'income', type: 'income', amount: 1000, description: 'Salário' }),
          tx({ id: 'expense', type: 'expense', amount: 175.68, description: 'Mercado' }),
        ]}
        categories={[]}
        accounts={[]}
        cards={[]}
        tags={[]}
      />,
    );

    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText(/824,32/)).toBeInTheDocument();
  });
});
