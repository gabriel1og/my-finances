import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/render';

const push = vi.fn();
const state = { search: '' };

vi.mock('next/navigation', () => ({
  usePathname: () => '/reports',
  useSearchParams: () => new URLSearchParams(state.search),
  useRouter: () => ({ push }),
}));

const { ReportScopeToggle } = await import('@/components/reports/ReportScopeToggle');

function render(search = '', scope: 'range' | 'month' = 'range') {
  state.search = search;
  push.mockClear();
  return renderWithProviders(<ReportScopeToggle paramKey="tagScope" scope={scope} />);
}

describe('ReportScopeToggle', () => {
  it('oferece ver só o mês atual quando o card está no período', async () => {
    const { user } = render('month=2026-09-01&range=6');
    await user.click(screen.getByRole('button', { name: 'Ver só mês atual' }));

    expect(push).toHaveBeenCalledWith('/reports?month=2026-09-01&range=6&tagScope=month', {
      scroll: false,
    });
  });

  it('oferece voltar ao período da página quando o card está no mês', async () => {
    const { user } = render('month=2026-09-01&range=6&tagScope=month', 'month');
    await user.click(screen.getByRole('button', { name: 'Ver período da página' }));

    expect(push).toHaveBeenCalledWith('/reports?month=2026-09-01&range=6', { scroll: false });
  });
});
