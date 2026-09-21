import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import type { Account } from '@/types/database.types';

vi.mock('@/components/accounts/AccountFormModal', () => ({ AccountFormModal: () => null }));
vi.mock('@/app/(app)/accounts/actions', () => ({
  archiveAccount: vi.fn(),
  deleteAccount: vi.fn(),
  getAccountBalanceHistory: vi.fn(),
  restoreAccount: vi.fn(),
}));

const { AccountCard } = await import('@/components/accounts/AccountCard');

const account = {
  id: 'account-1',
  user_id: 'user-1',
  name: 'Conta principal',
  kind: 'checking',
  institution: 'Banco',
  color: '#5B6EF5',
  opening_balance: 100,
  is_archived: false,
  position: 1,
  created_at: '2026-09-01T12:00:00Z',
  updated_at: '2026-09-01T12:00:00Z',
  balance_changed_at: '2026-09-21T01:30:00Z',
} satisfies Account;

describe('AccountCard', () => {
  it('mostra no cabeçalho a data civil da última alteração do saldo', () => {
    renderWithProviders(
      <AccountCard account={account} balance={150} cards={[]} openCardTotal={0} />,
    );

    expect(screen.getByText('Saldo atualizado')).toBeInTheDocument();
    expect(screen.getByText('20/09/2026')).toHaveAttribute('datetime', '2026-09-21T01:30:00Z');
  });
});
