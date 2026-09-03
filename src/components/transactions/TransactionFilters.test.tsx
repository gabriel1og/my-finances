import { describe, expect, it, vi } from 'vitest';
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
const accounts = [{ id: 'acc-1', name: 'Nubank', color: '#8A05BE' }] as Parameters<
  typeof TransactionFilters
>[0]['accounts'];
const cards = [{ id: 'card-1', name: 'Visa', color: '#2563EB' }] as Parameters<
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

describe('TransactionFilters — conta ou cartão', () => {
  it('mostra a conta selecionada pela URL', () => {
    state.search = 'account=acc-1';
    renderFilters();

    expect(screen.getByDisplayValue('Nubank')).toBeInTheDocument();
  });

  it('mostra o cartão selecionado pela URL', () => {
    state.search = 'card=card-1';
    renderFilters();

    expect(screen.getByDisplayValue('Visa')).toBeInTheDocument();
  });
});
