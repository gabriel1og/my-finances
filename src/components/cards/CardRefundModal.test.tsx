import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/render';
import type { CreditCard, Category, TransactionWithCategory } from '@/types/database.types';

const { save, edit } = vi.hoisted(() => ({
  save: vi.fn(async () => ({ error: null as string | null })),
  edit: vi.fn(async () => ({ error: null as string | null })),
}));
vi.mock('@/app/(app)/transactions/actions', () => ({
  createTransaction: save,
  updateTransaction: edit,
}));
vi.mock('@/app/(app)/transactions/refund-options', () => ({
  resolveRefundStatement: vi.fn(async () => ({
    error: null,
    statement: {
      statement_id: 'statement',
      statement_month: '2026-09-01',
      open_amount: 100,
    },
  })),
  getRefundPurchaseReference: vi.fn(async () => ({ purchase: null, error: null })),
  findRefundPurchases: vi.fn(async () => ({ purchases: [], error: null })),
}));
const { TransactionModal } = await import('@/components/ui/AddModal');
const cards = [{ id: 'card', name: 'Visa' }] as CreditCard[];
const categories = [
  { id: 'expense', name: 'Compras', kind: 'expense' },
  { id: 'income', name: 'Salário', kind: 'income' },
] as Category[];
beforeEach(() => {
  save.mockClear();
  edit.mockClear();
});

describe('cadastro de estorno pelo modal real', () => {
  it('abre pela fatura, usa categoria de despesa e envia o destino escolhido', async () => {
    const { user } = renderWithProviders(
      <TransactionModal
        categories={categories}
        accounts={[]}
        cards={cards}
        initialRefund={{ cardId: 'card', statementId: 'statement', month: '2026-09' }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Novo lançamento' }));
    await user.type(screen.getByPlaceholderText('Mercado, salário, aluguel...'), 'Estorno loja');
    await user.type(screen.getByPlaceholderText('0,00'), '150,00');
    expect(screen.getByRole('option', { name: 'Compras' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Salário' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'income',
        settlement: 'card',
        cardId: 'card',
        statementId: 'statement',
        amount: 150,
        accountId: null,
        installments: 1,
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('mantém a natureza fixa e conserva o formulário quando a gravação falha', async () => {
    edit.mockResolvedValueOnce({ error: 'Falha ao salvar.' });
    const transaction = {
      id: 'refund',
      type: 'income',
      settlement: 'card',
      card_id: 'card',
      statement_id: 'statement',
      description: 'Estorno loja',
      amount: 150,
      date: '2026-10-19',
    } as TransactionWithCategory;
    const { user } = renderWithProviders(
      <TransactionModal
        categories={categories}
        accounts={[]}
        cards={cards}
        transaction={transaction}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Novo lançamento' }));
    expect(screen.getByRole('button', { name: 'Despesa' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Receita comum' })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Falha ao salvar.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
