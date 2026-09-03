import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen } from '@/test/render';
import { DateField } from '@/components/ui/DateField';
import { MonthField } from '@/components/ui/MonthField';

function DateHarness({ initial = '2026-09-10', onChange = vi.fn() }) {
  const [value, setValue] = useState(initial);
  return (
    <DateField
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      label="Data"
    />
  );
}

const field = () => screen.getByLabelText('Data') as HTMLInputElement;
const openCalendar = () => screen.getByRole('button', { name: /calendário/i });

describe('DateField — digitação', () => {
  it('mostra a data em dd/mm/aaaa', () => {
    renderWithProviders(<DateHarness />);
    expect(field()).toHaveValue('10/09/2026');
  });

  it('aceita data completa digitada', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<DateHarness onChange={onChange} />);

    await user.clear(field());
    await user.type(field(), '05/08/2025');
    await user.tab();

    expect(onChange).toHaveBeenCalledWith('2025-08-05');
  });

  it('completa mês e ano quando só o dia é digitado', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<DateHarness onChange={onChange} />);

    await user.clear(field());
    await user.type(field(), '3');
    await user.tab();

    // Referência é o valor atual: setembro de 2026.
    expect(onChange).toHaveBeenCalledWith('2026-09-03');
  });

  it('volta ao valor anterior quando o texto não faz sentido', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<DateHarness onChange={onChange} />);

    await user.clear(field());
    await user.type(field(), '31/02/2026');
    await user.tab();

    // 31 de fevereiro não existe: melhor recusar do que gravar lixo.
    expect(onChange).not.toHaveBeenCalled();
    expect(field()).toHaveValue('10/09/2026');
  });

  it('confirma no Enter, sem esperar o blur', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<DateHarness onChange={onChange} />);

    await user.clear(field());
    await user.type(field(), '01/01/2027{Enter}');

    expect(onChange).toHaveBeenCalledWith('2027-01-01');
  });
});

describe('DateField — calendário', () => {
  it('abre pelo botão e anuncia como diálogo', async () => {
    const { user } = renderWithProviders(<DateHarness />);
    await user.click(openCalendar());

    expect(screen.getByRole('dialog', { name: 'Data' })).toBeInTheDocument();
    expect(screen.getByText('set 2026')).toBeInTheDocument();
  });

  it('abre com a seta para baixo a partir do campo', async () => {
    const { user } = renderWithProviders(<DateHarness />);
    await user.click(field());
    await user.keyboard('{ArrowDown}');

    expect(screen.getByRole('dialog', { name: 'Data' })).toBeInTheDocument();
  });

  it('escolher um dia fecha o painel e grava a data', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<DateHarness onChange={onChange} />);

    await user.click(openCalendar());
    await user.click(screen.getByRole('button', { name: '15' }));

    expect(onChange).toHaveBeenCalledWith('2026-09-15');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('"Hoje" salta para a data corrente', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<DateHarness initial="2020-01-01" onChange={onChange} />);

    await user.click(openCalendar());
    await user.click(screen.getByRole('button', { name: 'Hoje' }));

    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate(),
    ).padStart(2, '0')}`;
    expect(onChange).toHaveBeenCalledWith(iso);
  });

  it('marca o dia selecionado com aria-current', async () => {
    const { user } = renderWithProviders(<DateHarness />);
    await user.click(openCalendar());

    expect(screen.getByRole('button', { name: '10' })).toHaveAttribute('aria-current', 'date');
  });
});

describe('DateField — teclado na grade', () => {
  async function openGrid() {
    const { user } = renderWithProviders(<DateHarness />);
    await user.click(openCalendar());
    return { user, grid: screen.getByRole('grid') };
  }

  it('só o dia em foco é tabulável (roving tabindex)', async () => {
    await openGrid();

    const tabbable = screen
      .getAllByRole('button')
      .filter((button) => button.getAttribute('tabindex') === '0');

    // Sem isso, sair da grade custaria 31 tabuladas.
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toHaveTextContent('10');
  });

  it('setas andam dia a dia e semana a semana', async () => {
    const { grid } = await openGrid();

    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    expect(document.activeElement).toHaveTextContent('11');

    fireEvent.keyDown(grid, { key: 'ArrowDown' });
    expect(document.activeElement).toHaveTextContent('18');

    fireEvent.keyDown(grid, { key: 'ArrowLeft' });
    expect(document.activeElement).toHaveTextContent('17');
  });

  it('PageDown troca de mês', async () => {
    const { grid } = await openGrid();

    fireEvent.keyDown(grid, { key: 'PageDown' });
    expect(screen.getByText('out 2026')).toBeInTheDocument();
  });

  it('Home e End vão às pontas do mês', async () => {
    const { grid } = await openGrid();

    fireEvent.keyDown(grid, { key: 'End' });
    expect(document.activeElement).toHaveTextContent('30');

    fireEvent.keyDown(grid, { key: 'Home' });
    expect(document.activeElement).toHaveTextContent('1');
  });

  it('atravessa o mês pela seta, sem pular dias', async () => {
    const { grid } = await openGrid();

    fireEvent.keyDown(grid, { key: 'End' });
    fireEvent.keyDown(grid, { key: 'ArrowRight' });

    // 30/09 + 1 dia = 01/10: a grade acompanha a virada.
    expect(screen.getByText('out 2026')).toBeInTheDocument();
  });
});

describe('MonthField', () => {
  function MonthHarness({ initial = '2026-09', clearable = false, onChange = vi.fn() }) {
    const [value, setValue] = useState(initial);
    return (
      <MonthField
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
        label="Começa em"
        clearable={clearable}
      />
    );
  }

  const monthField = () => screen.getByLabelText('Começa em') as HTMLInputElement;

  it('mostra mm/aaaa', () => {
    renderWithProviders(<MonthHarness />);
    expect(monthField()).toHaveValue('09/2026');
  });

  it('aceita mês solto, herdando o ano em uso', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<MonthHarness onChange={onChange} />);

    await user.clear(monthField());
    await user.type(monthField(), '3{Enter}');

    expect(onChange).toHaveBeenCalledWith('2026-03');
  });

  it('limpar só apaga quando o campo aceita vazio', async () => {
    const onChange = vi.fn();
    const { user, rerender } = renderWithProviders(<MonthHarness onChange={onChange} />);

    await user.clear(monthField());
    await user.tab();
    // Campo obrigatório: vazio volta ao valor anterior.
    expect(onChange).not.toHaveBeenCalled();

    rerender(<MonthHarness clearable onChange={onChange} />);
    await user.clear(screen.getByLabelText('Começa em'));
    await user.tab();
    // "Termina em" aceita vazio: é assim que se diz "sem fim".
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('escolher na grade grava o mês', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<MonthHarness onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /calendário/i }));
    await user.click(screen.getByRole('button', { name: 'mar' }));

    expect(onChange).toHaveBeenCalledWith('2026-03');
  });

  it('setas andam de três em três na vertical (uma linha da grade)', async () => {
    const { user } = renderWithProviders(<MonthHarness />);
    await user.click(screen.getByRole('button', { name: /calendário/i }));

    fireEvent.keyDown(screen.getByRole('grid'), { key: 'ArrowDown' });
    // set + 3 = dez.
    expect(document.activeElement).toHaveTextContent('dez');
  });
});
