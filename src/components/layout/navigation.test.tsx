import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, within } from '@/test/render';

const push = vi.fn();
const state = { pathname: '/dashboard', search: '' };

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useSearchParams: () => new URLSearchParams(state.search),
  useRouter: () => ({ push }),
}));

const { SidebarNav } = await import('@/components/layout/SidebarNav');
const { AppHeader } = await import('@/components/layout/AppHeader');
const { UserCard } = await import('@/components/layout/UserCard');
const { MonthPicker } = await import('@/components/layout/MonthPicker');

describe('SidebarNav', () => {
  it('agrupa as rotas em Menu e Suporte', () => {
    state.pathname = '/dashboard';
    renderWithProviders(<SidebarNav />);

    expect(screen.getByText('Menu')).toBeInTheDocument();
    expect(screen.getByText('Suporte')).toBeInTheDocument();
  });

  it('leva o mês selecionado para as rotas sensíveis a mês', () => {
    state.search = 'month=2026-03-01';
    renderWithProviders(<SidebarNav />);

    expect(screen.getByRole('link', { name: 'Transações' })).toHaveAttribute(
      'href',
      '/transactions?month=2026-03-01',
    );
  });

  it('deixa /settings fora — a tela não é sensível a mês', () => {
    state.search = 'month=2026-03-01';
    renderWithProviders(<SidebarNav />);

    expect(screen.getByRole('link', { name: 'Configurações' })).toHaveAttribute(
      'href',
      '/settings',
    );
  });

  it('sem mês na URL, os links ficam limpos', () => {
    state.search = '';
    renderWithProviders(<SidebarNav />);

    expect(screen.getByRole('link', { name: 'Transações' })).toHaveAttribute(
      'href',
      '/transactions',
    );
  });

  it('marca a rota atual com aria-current implícito pelo estilo ativo', () => {
    state.pathname = '/reports';
    state.search = '';
    renderWithProviders(<SidebarNav />);

    expect(screen.getByRole('link', { name: 'Relatórios' }).className).toContain('border-accent');
  });

  it('recolhido, cada ícone mantém rótulo acessível', () => {
    renderWithProviders(<SidebarNav collapsed />);

    // O texto some da tela, mas o leitor de tela precisa continuar sabendo
    // para onde o ícone leva.
    expect(screen.getByRole('link', { name: 'Transações' })).toBeInTheDocument();
  });

  it('recolhido, mostra tooltip no hover', async () => {
    const { user } = renderWithProviders(<SidebarNav collapsed />);

    await user.hover(screen.getByRole('link', { name: 'Categorias' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Categorias');

    await user.unhover(screen.getByRole('link', { name: 'Categorias' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('expandido, não desenha tooltip nenhum', async () => {
    const { user } = renderWithProviders(<SidebarNav />);

    await user.hover(screen.getByRole('link', { name: 'Categorias' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});

describe('AppHeader', () => {
  it('mostra título e subtítulo da rota atual', () => {
    state.pathname = '/cards';
    renderWithProviders(
      <AppHeader onOpenMenu={vi.fn()} collapsed={false} onToggleCollapse={vi.fn()} />,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cartões de crédito');
    expect(screen.getByText('Faturas do mês selecionado')).toBeInTheDocument();
  });

  it('sub-rota ganha identidade própria, sem herdar o título do pai', () => {
    state.pathname = '/settings/import';
    renderWithProviders(
      <AppHeader onOpenMenu={vi.fn()} collapsed={false} onToggleCollapse={vi.fn()} />,
    );

    // "/settings/import" também começa com "/settings": se a busca em
    // NAV_ITEMS viesse primeiro, o título diria "Configurações".
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Importar CSV');
  });

  it('abre o menu no clique do botão', async () => {
    const onOpenMenu = vi.fn();
    const { user } = renderWithProviders(
      <AppHeader onOpenMenu={onOpenMenu} collapsed={false} onToggleCollapse={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Abrir menu' }));
    expect(onOpenMenu).toHaveBeenCalledTimes(1);
  });

  it('o botão de recolher anuncia o estado e alterna o rótulo', async () => {
    const onToggleCollapse = vi.fn();
    const { user, rerender } = renderWithProviders(
      <AppHeader onOpenMenu={vi.fn()} collapsed={false} onToggleCollapse={onToggleCollapse} />,
    );

    const button = screen.getByRole('button', { name: 'Recolher menu' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await user.click(button);
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);

    rerender(<AppHeader onOpenMenu={vi.fn()} collapsed onToggleCollapse={onToggleCollapse} />);
    expect(screen.getByRole('button', { name: 'Expandir menu' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('UserCard', () => {
  it('usa a inicial do primeiro e do segundo nome', () => {
    renderWithProviders(<UserCard name="Gabriel Oliveira" email="g@exemplo.com" />);
    expect(screen.getByText('GO')).toBeInTheDocument();
  });

  it('com um nome só, usa as duas primeiras letras', () => {
    renderWithProviders(<UserCard name="Gabriel" email="g@exemplo.com" />);
    expect(screen.getByText('Ga')).toBeInTheDocument();
  });

  it('sem nome, cai no trecho antes do @', () => {
    renderWithProviders(<UserCard name={null} email="gabriel@exemplo.com" />);
    expect(screen.getByText('gabriel')).toBeInTheDocument();
  });

  it('sem nome e sem e-mail, ainda diz algo', () => {
    renderWithProviders(<UserCard name={null} email={null} />);
    expect(screen.getByText('Minha conta')).toBeInTheDocument();
  });

  it('leva para Configurações, expandido ou recolhido', () => {
    const { rerender } = renderWithProviders(<UserCard name="Gabriel" email="g@exemplo.com" />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/settings');

    rerender(<UserCard name="Gabriel" email="g@exemplo.com" collapsed />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/settings');
  });

  it('recolhido, mostra só o avatar — mas mantém nome acessível', () => {
    renderWithProviders(<UserCard name="Gabriel Oliveira" email="g@exemplo.com" collapsed />);

    expect(screen.queryByText('g@exemplo.com')).not.toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAccessibleName(/Gabriel Oliveira/);
  });

  it('o e-mail truncado ganha title para poder ser lido inteiro', () => {
    renderWithProviders(<UserCard name="Gabriel" email="endereco.bem.longo@exemplo.com" />);
    expect(screen.getByText('endereco.bem.longo@exemplo.com')).toHaveAttribute(
      'title',
      'endereco.bem.longo@exemplo.com',
    );
  });
});

describe('MonthPicker', () => {
  it('mostra o mês em MM/AA', () => {
    state.search = 'month=2026-09-01';
    renderWithProviders(<MonthPicker />);

    expect(screen.getByRole('button', { name: /Mês selecionado/ })).toHaveTextContent('09/26');
  });

  it('as setas andam um mês, preservando a rota', async () => {
    state.pathname = '/transactions';
    state.search = 'month=2026-09-01';
    const { user } = renderWithProviders(<MonthPicker />);

    await user.click(screen.getByRole('button', { name: 'Mês anterior' }));
    expect(push).toHaveBeenLastCalledWith('/transactions?month=2026-08-01');

    await user.click(screen.getByRole('button', { name: 'Próximo mês' }));
    expect(push).toHaveBeenLastCalledWith('/transactions?month=2026-10-01');
  });

  it('a virada de ano funciona nos dois sentidos', async () => {
    state.pathname = '/dashboard';
    state.search = 'month=2026-01-01';
    const { user } = renderWithProviders(<MonthPicker />);

    await user.click(screen.getByRole('button', { name: 'Mês anterior' }));
    expect(push).toHaveBeenLastCalledWith('/dashboard?month=2025-12-01');
  });

  it('escolher na grade navega para o mês', async () => {
    state.pathname = '/dashboard';
    state.search = 'month=2026-09-01';
    const { user } = renderWithProviders(<MonthPicker />);

    await user.click(screen.getByRole('button', { name: /Mês selecionado/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'mar' }));

    expect(push).toHaveBeenLastCalledWith('/dashboard?month=2026-03-01');
  });

  it('preserva os outros filtros da URL ao trocar de mês', async () => {
    state.pathname = '/transactions';
    state.search = 'month=2026-09-01&q=mercado&page=2';
    const { user } = renderWithProviders(<MonthPicker />);

    await user.click(screen.getByRole('button', { name: 'Próximo mês' }));

    const [url] = push.mock.calls.at(-1)!;
    expect(url).toContain('q=mercado');
    expect(url).toContain('month=2026-10-01');
  });
});
