import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import type { Entry } from '@/lib/transactions';

const deleteTransfer = vi.fn(async () => ({ error: null as string | null }));
vi.mock('@/app/(app)/transactions/actions', () => ({
  deleteTransfer: (...args: unknown[]) => deleteTransfer(...(args as [])),
  createTransfer: vi.fn(),
  updateTransfer: vi.fn(),
}));

const { TransferRow } = await import('@/components/ui/TransferRow');

const entry = {
  kind: 'transfer',
  key: 'grupo-1',
  group: 'grupo-1',
  description: 'Reserva de emergência',
  amount: 500,
  date: '2026-09-10',
  from: 'Nubank',
  to: 'Itaú',
  fromId: 'acc-1',
  toId: 'acc-2',
  tx: { id: 't-1' },
} as unknown as Extract<Entry, { kind: 'transfer' }>;

describe('TransferRow', () => {
  it('mostra as duas contas numa linha só', () => {
    renderWithProviders(<TransferRow entry={entry} />);

    expect(screen.getByText('Reserva de emergência')).toBeInTheDocument();
    expect(screen.getByText(/Nubank → Itaú/)).toBeInTheDocument();
  });

  it('omite a seta quando o par foi partido pela paginação', () => {
    renderWithProviders(<TransferRow entry={{ ...entry, to: null }} />);

    // Só uma ponta na página: melhor não afirmar um destino que não está ali.
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
    expect(screen.getByText(/Transferência/)).toBeInTheDocument();
  });

  it('o valor não é pintado como receita nem como despesa', () => {
    renderWithProviders(<TransferRow entry={entry} />);

    const amount = screen.getByText(/500,00/);
    expect(amount.className).not.toContain('text-income');
    expect(amount.className).not.toContain('text-expense');
  });

  it('sem `editable`, não oferece ações', () => {
    renderWithProviders(<TransferRow entry={entry} />);
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
  });

  it('excluir apaga as duas pontas, depois de confirmar', async () => {
    const { user } = renderWithProviders(<TransferRow entry={entry} editable />);

    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(deleteTransfer).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Sim' }));
    expect(deleteTransfer).toHaveBeenCalledWith('grupo-1');
  });

  it('mostra o erro da action', async () => {
    deleteTransfer.mockResolvedValueOnce({ error: 'permission denied' });
    const { user } = renderWithProviders(<TransferRow entry={entry} editable />);

    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    await user.click(screen.getByRole('button', { name: 'Sim' }));

    expect(await screen.findByText('permission denied')).toBeInTheDocument();
  });
});
