import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { waitFor } from '@testing-library/react';

vi.mock('@/app/(app)/transactions/refund-options', () => ({
  resolveRefundStatement: vi.fn(async () => ({
    error: null,
    statement: {
      statement_id: 'target',
      statement_month: '2026-09-01',
      open_amount: 500,
    },
  })),
  getRefundPurchaseReference: vi.fn(async () => ({ purchase: null, error: null })),
  findRefundPurchases: vi.fn(async () => ({ purchases: [], error: null })),
}));
const { CardRefundFields } = await import('./CardRefundFields');

describe('destino do estorno', () => {
  it('carrega o destino persistido e não altera a referência informativa', async () => {
    const selectStatement = vi.fn();
    const selectPurchase = vi.fn();
    renderWithProviders(
      <CardRefundFields
        cards={[]}
        cardId="card"
        onCardChange={vi.fn()}
        initialStatementId="source"
        onStatementChange={selectStatement}
        relatedPurchaseId="purchase"
        onPurchaseChange={selectPurchase}
      />,
    );
    await waitFor(() => expect(selectStatement).toHaveBeenCalledWith('target'));
    expect(screen.getByText(/Não aumenta a renda/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Compra relacionada' })).toHaveValue('purchase');
    expect(selectPurchase).not.toHaveBeenCalled();
  });
});
