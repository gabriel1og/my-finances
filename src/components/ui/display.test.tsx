import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';
import { CategoryBar } from '@/components/ui/CategoryBar';
import { GoalProgress } from '@/components/ui/GoalProgress';
import { KpiCard } from '@/components/ui/KpiCard';
import { Toggle } from '@/components/ui/Toggle';
import { TagChip } from '@/components/ui/TagChip';
import { EmptyState } from '@/components/ui/EmptyState';

/** Regra permanente do design system: todo dado numérico em JetBrains Mono. */
function isMono(element: HTMLElement | null) {
  return element?.className.includes('num') ?? false;
}

describe('KpiCard', () => {
  it('formata na moeda do perfil', () => {
    renderWithProviders(<KpiCard label="Saldo" value={1234.5} />, { currency: 'USD' });
    expect(screen.getByText(/1,234\.50|1.234,50/)).toBeInTheDocument();
  });

  it('escreve o número em fonte mono', () => {
    renderWithProviders(<KpiCard label="Saldo" value={10} />);
    // A regra vale para todo valor: sem `.num`, colunas de números deixam de
    // alinhar e o dashboard "dança" a cada atualização.
    expect(isMono(screen.getByText(/10,00/))).toBe(true);
  });

  it('colore receita e despesa com tons distintos', () => {
    const { rerender } = renderWithProviders(<KpiCard label="Receitas" value={10} tone="income" />);
    expect(screen.getByText(/10,00/).className).toContain('text-income');

    rerender(<KpiCard label="Despesas" value={10} tone="expense" />);
    expect(screen.getByText(/10,00/).className).toContain('text-expense');
  });
});

describe('CategoryBar', () => {
  it('mostra gasto e limite quando há orçamento', () => {
    renderWithProviders(<CategoryBar name="Mercado" color="#5B6EF5" spent={300} budget={800} />);

    expect(screen.getByText('Mercado')).toBeInTheDocument();
    expect(screen.getByText(/300,00.*800,00/)).toBeInTheDocument();
    expect(screen.getByText('37,5% do limite')).toBeInTheDocument();
  });

  it('omite o percentual quando a categoria não tem limite', () => {
    renderWithProviders(<CategoryBar name="Mercado" color="#5B6EF5" spent={300} budget={0} />);
    expect(screen.queryByText(/do limite/)).not.toBeInTheDocument();
  });

  it('vira alerta a partir de 85% do limite', () => {
    renderWithProviders(<CategoryBar name="Mercado" color="#5B6EF5" spent={700} budget={800} />);
    expect(screen.getByText('87,5% do limite').className).toContain('text-warning');
  });

  it('explica o acumulado quando há rollover, com o limite do mês ao lado', () => {
    renderWithProviders(
      <CategoryBar name="Mercado" color="#5B6EF5" spent={100} budget={900} carry={100} />,
    );

    // O `budget` recebido já é o disponível; o limite do mês é o que sobra
    // quando se tira o acumulado.
    expect(screen.getByText(/\+.*100,00 acumulado de meses anteriores/)).toBeInTheDocument();
    expect(screen.getByText(/limite do mês.*800,00/)).toBeInTheDocument();
  });

  it('mostra estouro herdado com sinal de menos e tom de alerta', () => {
    renderWithProviders(
      <CategoryBar name="Mercado" color="#5B6EF5" spent={100} budget={700} carry={-100} />,
    );

    const line = screen.getByText(/acumulado de meses anteriores/);
    expect(line.textContent).toContain('−');
    expect(line.className).toContain('text-warning');
  });

  it('não desenha a linha de acumulado quando não há rollover', () => {
    renderWithProviders(<CategoryBar name="Mercado" color="#5B6EF5" spent={100} budget={800} />);
    expect(screen.queryByText(/acumulado/)).not.toBeInTheDocument();
  });
});

describe('GoalProgress', () => {
  it('não renderiza sem meta definida', () => {
    const { container } = renderWithProviders(
      <GoalProgress variant="saving" current={100} target={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('meta de economia: diz quanto falta', () => {
    renderWithProviders(<GoalProgress variant="saving" current={400} target={1000} />);
    expect(screen.getByText(/Faltam/)).toBeInTheDocument();
  });

  it('meta de economia: mês no vermelho é dito com todas as letras', () => {
    renderWithProviders(<GoalProgress variant="saving" current={-250} target={1000} />);
    expect(screen.getByText(/no vermelho/)).toBeInTheDocument();
  });

  it('teto de gastos: avisa quando estoura', () => {
    renderWithProviders(<GoalProgress variant="cap" current={1200} target={1000} />);
    expect(screen.getByText(/Teto estourado/)).toBeInTheDocument();
  });

  it('as duas leituras têm rótulos distintos', () => {
    const { rerender } = renderWithProviders(
      <GoalProgress variant="saving" current={100} target={1000} />,
    );
    expect(screen.getByText('Meta de economia')).toBeInTheDocument();

    rerender(<GoalProgress variant="cap" current={100} target={1000} />);
    expect(screen.getByText('Teto de gastos')).toBeInTheDocument();
  });
});

describe('Toggle', () => {
  it('é um switch com estado anunciado, não um botão de texto', () => {
    renderWithProviders(<Toggle checked={false} onChange={vi.fn()} label="Rollover" />);

    const toggle = screen.getByRole('switch', { name: 'Rollover' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('alterna no clique e no teclado', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <Toggle checked={false} onChange={onChange} label="Rollover" />,
    );

    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);

    screen.getByRole('switch').focus();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('não dispara quando desabilitado', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <Toggle checked onChange={onChange} label="Rollover" disabled />,
    );

    await user.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('TagChip', () => {
  it('mostra o nome e permite remover quando há ação', async () => {
    const onRemove = vi.fn();
    const { user } = renderWithProviders(
      <TagChip name="Viagem" color="#22D3EE" onRemove={onRemove} />,
    );

    expect(screen.getByText('Viagem')).toBeInTheDocument();
    await user.click(screen.getByRole('button'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('sem ação, não vira botão — é só rótulo', () => {
    renderWithProviders(<TagChip name="Viagem" color="#22D3EE" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('explica a ausência em vez de deixar o espaço vazio', () => {
    renderWithProviders(<EmptyState message="Nenhum lançamento neste mês." />);
    expect(screen.getByText('Nenhum lançamento neste mês.')).toBeInTheDocument();
  });
});
