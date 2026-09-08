import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';

const push = vi.fn();
const state = { search: '' };

vi.mock('next/navigation', () => ({
  usePathname: () => '/transactions',
  useSearchParams: () => new URLSearchParams(state.search),
  useRouter: () => ({ push }),
}));

const { TransactionFilters } = await import('@/components/transactions/TransactionFilters');

const categories = [] as Parameters<typeof TransactionFilters>[0]['categories'];
const tags = [] as Parameters<typeof TransactionFilters>[0]['tags'];
const accounts = [{ id: 'acc-1', name: 'Inter', color: '#FF7A00' }] as Parameters<
  typeof TransactionFilters
>[0]['accounts'];
const cards = [{ id: 'card-1', name: 'Inter', color: '#2563EB' }] as Parameters<
  typeof TransactionFilters
>[0]['cards'];

function renderFilters() {
  return renderWithProviders(
    <TransactionFilters
      categories={categories}
      accounts={accounts}
      cards={cards}
      tags={tags}
      allMonths={false}
    />,
  );
}

beforeEach(() => {
  push.mockClear();
  state.search = '';
});

describe('TransactionFilters — conta ou cartão', () => {
  it('mostra a conta selecionada pela URL', () => {
    state.search = 'account=acc-1';
    renderFilters();

    expect(screen.getByDisplayValue('Conta - Inter')).toBeInTheDocument();
  });

  it('mostra o cartão selecionado pela URL', () => {
    state.search = 'card=card-1';
    renderFilters();

    expect(screen.getByDisplayValue('Cartão - Inter')).toBeInTheDocument();
  });

  it('diferencia conta e cartão com o mesmo nome', () => {
    state.search = '';
    renderFilters();

    expect(screen.getByRole('option', { name: 'Conta - Inter' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Cartão - Inter' })).toBeInTheDocument();
  });
});

describe('TransactionFilters — limpar filtros', () => {
  it('mantém o botão desabilitado quando não há filtro ativo', () => {
    renderFilters();

    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeDisabled();
  });

  it('limpa os filtros e preserva o mês da URL', async () => {
    state.search = 'month=2026-09-01&q=mercado&type=expense&account=acc-1&page=3';
    const { user } = renderFilters();

    const clear = screen.getByRole('button', { name: 'Limpar filtros' });
    expect(clear).toBeEnabled();

    await user.click(clear);

    expect(push).toHaveBeenCalledWith('/transactions?month=2026-09-01');
  });
});
