import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { SourceBreakdown } from '@/components/reports/SourceBreakdown';
import { TrendTable } from '@/components/reports/TrendTable';
import type { SourceTotal } from '@/lib/reports';

function total(overrides: Partial<SourceTotal> & { id: string }): SourceTotal & { href: string } {
  return {
    name: 'Itaú',
    color: '#F5A623',
    expense: 700,
    income: 0,
    items: 6,
    share: 70,
    href: `/cards/${overrides.id}?month=2026-09-01`,
    ...overrides,
  };
}

describe('SourceBreakdown', () => {
  it('mostra valor, fatia e contagem de cada origem', () => {
    renderWithProviders(
      <SourceBreakdown
        rows={[total({ id: 'card-1' })]}
        itemsNoun="compra"
        linkTitle="Ver a fatura de"
        emptyMessage="Nada aqui."
      />,
    );

    expect(screen.getByText(/700,00/)).toBeInTheDocument();
    expect(screen.getByText('70,0% das despesas · 6 compras')).toBeInTheDocument();
  });

  it('abre o detalhe daquela origem', () => {
    renderWithProviders(
      <SourceBreakdown
        rows={[total({ id: 'card-1' })]}
        itemsNoun="compra"
        linkTitle="Ver a fatura de"
        emptyMessage="Nada aqui."
      />,
    );

    expect(screen.getByTitle('Ver a fatura de Itaú')).toHaveAttribute(
      'href',
      '/cards/card-1?month=2026-09-01',
    );
  });

  it('mostra o que entrou quando a origem é conta', () => {
    renderWithProviders(
      <SourceBreakdown
        rows={[total({ id: 'acc-1', name: 'Nubank', income: 5000 })]}
        itemsNoun="lançamento"
        linkTitle="Ver lançamentos de"
        emptyMessage="Nada aqui."
        showIncome
      />,
    );

    expect(screen.getByText(/5.000,00 recebido/)).toBeInTheDocument();
  });

  it('não mostra receita no bloco de cartão, que não tem receita', () => {
    renderWithProviders(
      <SourceBreakdown
        rows={[total({ id: 'card-1', income: 5000 })]}
        itemsNoun="compra"
        linkTitle="Ver a fatura de"
        emptyMessage="Nada aqui."
      />,
    );

    expect(screen.queryByText(/recebido/)).not.toBeInTheDocument();
  });

  it('avisa quando o mês não teve movimento', () => {
    renderWithProviders(
      <SourceBreakdown
        rows={[]}
        itemsNoun="compra"
        linkTitle="Ver a fatura de"
        emptyMessage="Nenhuma compra no crédito neste mês."
      />,
    );

    expect(screen.getByText('Nenhuma compra no crédito neste mês.')).toBeInTheDocument();
  });

  it('troca a fatia por um aviso quando a origem só recebeu', () => {
    renderWithProviders(
      <SourceBreakdown
        rows={[total({ id: 'acc-1', expense: 0, share: 0, items: 0, income: 900 })]}
        itemsNoun="lançamento"
        linkTitle="Ver lançamentos de"
        emptyMessage="Nada aqui."
        showIncome
      />,
    );

    expect(screen.getByText('Sem gastos neste mês')).toBeInTheDocument();
  });
});

describe('TrendTable', () => {
  const months = ['2026-07-01', '2026-08-01', '2026-09-01'];
  const rows = [
    { id: 'a', name: 'Itaú', color: '#F5A623', values: [100, 0, 300], total: 400 },
    { id: 'b', name: 'Nubank', color: '#5B6EF5', values: [50, 50, 50], total: 150 },
  ];

  it('usa o rótulo da dimensão no cabeçalho', () => {
    renderWithProviders(
      <TrendTable rows={rows} months={months} label="Cartão" emptyMessage="Sem dados." />,
    );

    expect(screen.getByText('Cartão')).toBeInTheDocument();
    expect(screen.getAllByText('set').length).toBeGreaterThan(0);
  });

  it('mostra travessão no mês sem movimento, não R$ 0,00', () => {
    renderWithProviders(
      <TrendTable rows={rows} months={months} label="Cartão" emptyMessage="Sem dados." />,
    );

    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('soma a coluna de cada mês', () => {
    renderWithProviders(
      <TrendTable rows={rows} months={months} label="Cartão" emptyMessage="Sem dados." />,
    );

    // Julho: 100 + 50.
    expect(screen.getAllByText(/150,00/).length).toBeGreaterThan(0);
  });

  it('destaca a alta relevante sobre o mês anterior', () => {
    renderWithProviders(
      <TrendTable
        rows={[{ id: 'a', name: 'Itaú', color: '#F5A623', values: [100, 200, 200], total: 500 }]}
        months={months}
        label="Cartão"
        emptyMessage="Sem dados."
      />,
    );

    // 100 → 200 passa dos 20%; 200 → 200 não.
    const destacados = screen
      .getAllByText(/200,00/)
      .filter((el) => el.className.includes('warning'));
    expect(destacados).toHaveLength(1);
  });

  it('diz que não há período quando não há linha', () => {
    renderWithProviders(
      <TrendTable rows={[]} months={months} label="Conta" emptyMessage="Sem dados." />,
    );

    expect(screen.getByText('Sem dados.')).toBeInTheDocument();
  });
});
