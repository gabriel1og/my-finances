import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';

const push = vi.fn();
const state = { search: '' };

vi.mock('next/navigation', () => ({
  usePathname: () => '/reports',
  useSearchParams: () => new URLSearchParams(state.search),
  useRouter: () => ({ push }),
}));

const { ReportRangePicker } = await import('@/components/reports/ReportRangePicker');

function render(search = '') {
  state.search = search;
  push.mockClear();
  return renderWithProviders(<ReportRangePicker />);
}

describe('ReportRangePicker', () => {
  it('mostra 12 meses quando a URL não pede janela', () => {
    render();
    expect(screen.getByLabelText('Período dos relatórios')).toHaveValue('12');
  });

  it('mostra a janela pedida pela URL', () => {
    render('range=24');
    expect(screen.getByLabelText('Período dos relatórios')).toHaveValue('24');
  });

  it('leva a escolha para a URL, preservando o mês', async () => {
    const { user } = render('month=2026-09-01');
    await user.selectOptions(screen.getByLabelText('Período dos relatórios'), '3');

    expect(push).toHaveBeenCalledWith('/reports?month=2026-09-01&range=3');
  });

  it('não escreve o padrão na URL', async () => {
    const { user } = render('month=2026-09-01&range=3');
    await user.selectOptions(screen.getByLabelText('Período dos relatórios'), '12');

    expect(push).toHaveBeenCalledWith('/reports?month=2026-09-01');
  });

  it('volta para a rota limpa quando não sobra parâmetro nenhum', async () => {
    const { user } = render('range=6');
    await user.selectOptions(screen.getByLabelText('Período dos relatórios'), '12');

    expect(push).toHaveBeenCalledWith('/reports');
  });
});
