import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, within } from '@/test/render';
import type { TransactionWithCategory } from '@/types/database.types';

const deleteTransaction = vi.fn(async () => ({ error: null as string | null }));
const deleteInstallmentGroup = vi.fn(async () => ({ error: null as string | null }));
const deleteTransfer = vi.fn(async () => ({ error: null as string | null }));

vi.mock('@/app/(app)/transactions/actions', () => ({
  deleteTransaction: (...args: unknown[]) => deleteTransaction(...(args as [])),
  deleteInstallmentGroup: (...args: unknown[]) => deleteInstallmentGroup(...(args as [])),
  deleteTransfer: (...args: unknown[]) => deleteTransfer(...(args as [])),
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  createTransfer: vi.fn(),
  updateTransfer: vi.fn(),
}));

const { TxRow } = await import('@/components/ui/TxRow');

/**
 * A linha tem dois desenhos — o de `lg` para cima e o do celular — e o jsdom
 * não aplica media query, então os dois estão na árvore ao mesmo tempo. As
 * ações em texto são as de `lg`; as do celular vivem dentro do painel do menu,
 * e por isso os testes daquele caminho consultam sempre dentro dele.
 */
function tx(overrides: Partial<TransactionWithCategory> = {}): TransactionWithCategory {
  return {
    id: 't-1',
    type: 'expense',
    description: 'Mercado',
    amount: 150,
    date: '2026-09-10',
    category: { id: 'cat-1', name: 'Alimentação', color: '#5B6EF5' },
    account: { id: 'acc-1', name: 'Nubank', color: '#5B6EF5' },
    card: null,
    tags: [],
    is_transfer: false,
    installment_group: null,
    transfer_group: null,
    ...overrides,
  } as unknown as TransactionWithCategory;
}

const categories = [
  { id: 'cat-1', name: 'Alimentação', color: '#5B6EF5', kind: 'expense' },
] as Parameters<typeof TxRow>[0]['categories'];

describe('TxRow — leitura', () => {
  it('mostra descrição, categoria e origem', () => {
    renderWithProviders(<TxRow tx={tx()} />);

    expect(screen.getByText('Mercado')).toBeInTheDocument();
    expect(screen.getByText(/Alimentação · Nubank/)).toBeInTheDocument();
  });

  it('diz "Sem categoria" em vez de deixar em branco', () => {
    renderWithProviders(<TxRow tx={tx({ category: null })} />);
    expect(screen.getByText(/Sem categoria/)).toBeInTheDocument();
  });

  it('mostra as tags', () => {
    renderWithProviders(
      <TxRow tx={tx({ tags: [{ id: 'tag-1', name: 'Viagem', color: '#22D3EE' }] })} />,
    );

    // Na linha do título a partir de `lg`, em linha própria no celular.
    expect(screen.getAllByText('Viagem')).toHaveLength(2);
  });

  it('sem `categories`, a linha é só leitura — o dashboard usa assim', () => {
    renderWithProviders(<TxRow tx={tx()} />);

    expect(screen.queryByRole('button', { name: 'Ações de Mercado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
  });

  it('sinal e valor saem na mesma string, que não quebra linha', () => {
    renderWithProviders(<TxRow tx={tx()} />);

    // O "−" separado do valor por uma quebra fazia a linha parecer duas
    // informações; é o bug que a classe `.money` fecha.
    for (const amount of screen.getAllByText(/150,00/)) {
      expect(amount.textContent).toMatch(/^−\s?R\$/);
      expect(amount.className).toContain('money');
    }
  });
});

describe('TxRow — exclusão', () => {
  it('pede confirmação antes de excluir', async () => {
    const { user } = renderWithProviders(<TxRow tx={tx()} categories={categories} />);

    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(screen.getByText('Excluir?')).toBeInTheDocument();
    expect(deleteTransaction).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Sim' }));
    expect(deleteTransaction).toHaveBeenCalledWith('t-1');
  });

  it('dá para desistir da confirmação', async () => {
    const { user } = renderWithProviders(<TxRow tx={tx()} categories={categories} />);

    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    await user.click(screen.getByRole('button', { name: 'Não' }));

    expect(screen.queryByText('Excluir?')).not.toBeInTheDocument();
    expect(deleteTransaction).not.toHaveBeenCalled();
  });

  it('em compra parcelada, oferece apagar só a parcela ou todas', async () => {
    const { user } = renderWithProviders(
      <TxRow tx={tx({ installment_group: 'grupo-1' })} categories={categories} />,
    );

    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(screen.getByRole('button', { name: 'Só esta' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Todas as parcelas' }));
    expect(deleteInstallmentGroup).toHaveBeenCalledWith('grupo-1');
  });

  it('em transferência, oferece apagar os dois lados', async () => {
    const { user } = renderWithProviders(
      <TxRow tx={tx({ is_transfer: true, transfer_group: 'grupo-t' })} categories={categories} />,
    );

    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    await user.click(screen.getByRole('button', { name: 'Os dois lados' }));

    // Apagar uma ponta só deixaria o saldo de uma das contas errado.
    expect(deleteTransfer).toHaveBeenCalledWith('grupo-t');
  });

  it('mostra o erro da action e volta ao estado normal', async () => {
    deleteTransaction.mockResolvedValueOnce({ error: 'permission denied' });
    const { user } = renderWithProviders(<TxRow tx={tx()} categories={categories} />);

    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    await user.click(screen.getByRole('button', { name: 'Sim' }));

    expect(await screen.findByText('permission denied')).toBeInTheDocument();
  });
});

describe('TxRow — edição', () => {
  it('"Editar" abre o formulário do lançamento', async () => {
    const { user } = renderWithProviders(<TxRow tx={tx()} categories={categories} />);

    await user.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByRole('dialog', { name: 'Editar lançamento' })).toBeInTheDocument();
  });
});

describe('TxRow — menu do celular', () => {
  function openMenu(user: ReturnType<typeof renderWithProviders>['user']) {
    return user.click(screen.getByRole('button', { name: 'Ações de Mercado' }));
  }

  function panel() {
    return screen.getByRole('dialog', { name: 'Ações de Mercado' });
  }

  it('exclui pelo painel, com a confirmação dentro dele', async () => {
    const { user } = renderWithProviders(<TxRow tx={tx()} categories={categories} />);

    await openMenu(user);
    await user.click(within(panel()).getByRole('button', { name: 'Excluir' }));
    expect(within(panel()).getByText('Excluir este lançamento?')).toBeInTheDocument();

    await user.click(within(panel()).getByRole('button', { name: 'Sim' }));
    expect(deleteTransaction).toHaveBeenCalledWith('t-1');
  });

  it('"Editar" fecha o painel antes de abrir o formulário', async () => {
    const { user } = renderWithProviders(<TxRow tx={tx()} categories={categories} />);

    await openMenu(user);
    await user.click(within(panel()).getByRole('button', { name: 'Editar' }));

    // O popover (z-60) por cima do modal (z-50) esconderia o formulário.
    expect(screen.getByRole('dialog', { name: 'Editar lançamento' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Ações de Mercado' })).not.toBeInTheDocument();
  });
});
