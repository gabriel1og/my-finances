import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import type { Account, AccountBalanceHistory } from '@/types/database.types';

const { getAccountBalanceHistory } = vi.hoisted(() => ({
  getAccountBalanceHistory: vi.fn(),
}));
vi.mock('@/app/(app)/accounts/actions', () => ({ getAccountBalanceHistory }));

const { AccountHistoryDrawer } = await import('@/components/accounts/AccountHistoryDrawer');

const account = {
  id: 'account-1',
  name: 'Conta principal',
} as Account;

const history = [
  {
    sequence_no: 2,
    user_id: 'user-1',
    account_id: 'account-1',
    change_kind: 'transaction_created',
    delta: -50,
    balance: 150,
    description: 'Mercado',
    transaction_id: 'transaction-1',
    changed_at: '2026-09-21T12:00:00Z',
    recorded_at: '2026-09-21T12:00:00Z',
  },
] satisfies AccountBalanceHistory[];

describe('AccountHistoryDrawer', () => {
  it('abre o painel e mostra data, saldo resultante, diferença e origem', async () => {
    getAccountBalanceHistory.mockResolvedValue({ entries: history, hasMore: false, error: null });
    const { user } = renderWithProviders(<AccountHistoryDrawer account={account} balance={150} />);

    await user.click(screen.getByRole('button', { name: 'Ver histórico' }));

    expect(await screen.findByRole('dialog', { name: 'Histórico · Conta principal' })).toHaveClass(
      'sm:h-full',
    );
    expect(screen.getByText('21/09/2026 às 09:00')).toBeInTheDocument();
    expect(screen.getByText('Lançamento adicionado')).toBeInTheDocument();
    expect(screen.getByText('Mercado')).toBeInTheDocument();
    expect(screen.getAllByText(/150,00/)).toHaveLength(2);
    expect(screen.getByText(/-.*50,00/)).toBeInTheDocument();
  });

  it('oferece nova tentativa com mensagem amigável', async () => {
    getAccountBalanceHistory.mockResolvedValue({
      entries: [],
      hasMore: false,
      error: 'Não foi possível carregar o histórico agora.',
    });
    const { user } = renderWithProviders(<AccountHistoryDrawer account={account} balance={150} />);

    await user.click(screen.getByRole('button', { name: 'Ver histórico' }));

    expect(
      await screen.findByText('Não foi possível carregar o histórico agora.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });
});
