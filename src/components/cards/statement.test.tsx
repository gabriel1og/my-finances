import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, within } from '@/test/render';
import type { TransactionWithCategory } from '@/types/database.types';

// A linha da fatura é a TxRow real — é ela que decide o selo de parcela. O que
// se corta são as dependências de servidor dela: o modal de edição e as
// actions, que puxariam o cliente Supabase para dentro do jsdom.
vi.mock('@/components/ui/AddModal', () => ({ TransactionModal: () => null }));
vi.mock('@/app/(app)/transactions/actions', () => ({
  deleteTransaction: vi.fn(),
  deleteInstallmentGroup: vi.fn(),
  deleteTransfer: vi.fn(),
}));

const { StatementItems } = await import('@/components/cards/StatementItems');
const { StatementCategories } = await import('@/components/cards/StatementCategories');
const { UpcomingStatements } = await import('@/components/cards/UpcomingStatements');

const MERCADO = { id: 'cat-1', name: 'Alimentação', color: '#2ECC9A' };
const LAZER = { id: 'cat-2', name: 'Lazer', color: '#F05C5C' };

function tx(overrides: Partial<TransactionWithCategory>): TransactionWithCategory {
  return {
    id: 'tx-1',
    type: 'expense',
    description: 'Compra',
    amount: 100,
    date: '2026-09-10',
    updated_at: '2026-09-10T00:00:00Z',
    notes: null,
    category: MERCADO,
    account: null,
    card: { id: 'card-1', name: 'Visa', color: '#5B6EF5' },
    tags: [],
    installment_no: null,
    installment_total: null,
    ...overrides,
  } as unknown as TransactionWithCategory;
}

const transactions = [
  tx({ id: 'tx-1', description: 'Mercado do bairro', amount: 250, category: MERCADO }),
  tx({ id: 'tx-2', description: 'Cinema', amount: 60, category: LAZER }),
  tx({
    id: 'tx-3',
    description: 'Geladeira',
    amount: 400,
    category: null,
    installment_no: 2,
    installment_total: 6,
  }),
];

function renderItems() {
  return renderWithProviders(
    <StatementItems
      transactions={transactions}
      categories={[]}
      accounts={[]}
      cards={[]}
      tags={[]}
    />,
  );
}

describe('StatementItems', () => {
  it('lista a fatura inteira, não só as primeiras linhas', () => {
    renderItems();

    expect(screen.getByText('Mercado do bairro')).toBeInTheDocument();
    expect(screen.getByText('Cinema')).toBeInTheDocument();
    expect(screen.getByText('Geladeira')).toBeInTheDocument();
  });

  it('resume quantos lançamentos estão em tela e quanto somam', () => {
    renderItems();
    expect(screen.getByText(/3 de 3 lançamentos · subtotal/)).toBeInTheDocument();
    expect(screen.getByText(/710,00/)).toBeInTheDocument();
  });

  it('filtra pela busca e recalcula o subtotal do que sobrou', async () => {
    const { user } = renderItems();
    await user.type(screen.getByLabelText('Buscar na fatura'), 'cinema');

    expect(screen.queryByText('Mercado do bairro')).not.toBeInTheDocument();
    // O subtotal e a linha do Cinema mostram o mesmo valor: a asserção precisa
    // dizer que é o do resumo.
    expect(screen.getByText(/1 de 3 lançamentos · subtotal.*60,00/)).toBeInTheDocument();
  });

  it('filtra por categoria e oferece só as categorias presentes na fatura', async () => {
    const { user } = renderItems();
    const select = screen.getByLabelText('Filtrar por categoria');

    expect(within(select).queryByText('Moradia')).not.toBeInTheDocument();

    await user.selectOptions(select, 'cat-2');
    expect(screen.getByText('Cinema')).toBeInTheDocument();
    expect(screen.queryByText('Geladeira')).not.toBeInTheDocument();
  });

  it('separa os lançamentos sem categoria', async () => {
    const { user } = renderItems();
    await user.selectOptions(screen.getByLabelText('Filtrar por categoria'), 'none');

    expect(screen.getByText('Geladeira')).toBeInTheDocument();
    expect(screen.queryByText('Cinema')).not.toBeInTheDocument();
  });

  it('devolve a lista inteira ao limpar os filtros', async () => {
    const { user } = renderItems();
    await user.type(screen.getByLabelText('Buscar na fatura'), 'cinema');
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));

    expect(screen.getByText(/3 de 3 lançamentos/)).toBeInTheDocument();
  });

  it('marca a parcela com o número dela dentro do total', () => {
    renderItems();
    expect(screen.getByTitle('Parcela 2 de 6')).toHaveTextContent('2/6');
  });

  it('avisa quando o filtro não devolve nada, sem sumir com a fatura', async () => {
    const { user } = renderItems();
    await user.type(screen.getByLabelText('Buscar na fatura'), 'zzz');

    expect(screen.getByText('Nenhum lançamento com esses filtros.')).toBeInTheDocument();
  });
});

describe('StatementCategories', () => {
  it('ordena as categorias pelo peso na fatura e mostra o percentual', () => {
    renderWithProviders(<StatementCategories transactions={transactions} />);

    const names = screen
      .getAllByText(/Alimentação|Lazer|Sem categoria/)
      .map((el) => el.textContent);
    expect(names).toEqual(['Sem categoria', 'Alimentação', 'Lazer']);

    // 400 de 710.
    expect(screen.getByText(/56,3% da fatura/)).toBeInTheDocument();
  });

  it('não renderiza nada numa fatura vazia', () => {
    const { container } = renderWithProviders(<StatementCategories transactions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('UpcomingStatements', () => {
  const ahead = [
    {
      card_id: 'card-1',
      statement_month: '2026-10-01',
      total: 500,
      due_date: '2026-11-10',
    },
    {
      card_id: 'card-1',
      statement_month: '2026-11-01',
      total: 300,
      due_date: '2026-12-10',
    },
  ] as unknown as Parameters<typeof UpcomingStatements>[0]['statements'];

  it('mostra mês e valor de cada fatura à frente', () => {
    renderWithProviders(<UpcomingStatements cardId="card-1" statements={ahead} />);

    expect(screen.getByText('out/26')).toBeInTheDocument();
    expect(screen.getByText(/500,00/)).toBeInTheDocument();
    expect(screen.getByText('nov/26')).toBeInTheDocument();
  });

  it('leva para a fatura daquele mês', () => {
    renderWithProviders(<UpcomingStatements cardId="card-1" statements={ahead} />);

    expect(screen.getByTitle(/Fatura de outubro de 2026 · vence 10\/11\/2026/)).toHaveAttribute(
      'href',
      '/cards/card-1?month=2026-10-01',
    );
  });

  it('não ocupa espaço quando não há nada comprometido à frente', () => {
    const { container } = renderWithProviders(
      <UpcomingStatements cardId="card-1" statements={[]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
