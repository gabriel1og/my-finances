import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, within } from '@/test/render';

const state = { pathname: '/dashboard', search: '' };
vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useSearchParams: () => new URLSearchParams(state.search),
  useRouter: () => ({ push: vi.fn() }),
}));

const { Sidebar } = await import('@/components/layout/Sidebar');
const { AppShell } = await import('@/components/layout/AppShell');

const user = { name: 'Gabriel Oliveira', email: 'gabriel@exemplo.com' };

const monthPicker = () => screen.queryByRole('button', { name: /Mês selecionado/ });
const account = () => screen.getByRole('link', { name: /Conta de/ });

describe('Sidebar — expandida', () => {
  it('mostra marca, conta com e-mail e o menu', () => {
    renderWithProviders(<Sidebar user={user} />);

    expect(screen.getByText('gabriel@exemplo.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('não repete o seletor de mês — ele vive no cabeçalho', () => {
    renderWithProviders(<Sidebar user={user} />);
    expect(monthPicker()).not.toBeInTheDocument();
  });
});

describe('Sidebar — recolhida', () => {
  it('traz o seletor de mês de volta, porque o cabeçalho o esconde nessa largura', () => {
    renderWithProviders(<Sidebar collapsed user={user} />);
    expect(monthPicker()).toBeInTheDocument();
  });

  it('reduz a conta ao avatar, ainda clicável', () => {
    renderWithProviders(<Sidebar collapsed user={user} />);

    expect(screen.queryByText('gabriel@exemplo.com')).not.toBeInTheDocument();
    expect(account()).toHaveAttribute('href', '/settings');
  });

  it('esconde os rótulos das seções, que não caberiam em 64px', () => {
    renderWithProviders(<Sidebar collapsed user={user} />);

    expect(screen.queryByText('Menu')).not.toBeInTheDocument();
    expect(screen.queryByText('Suporte')).not.toBeInTheDocument();
  });
});

describe('Sidebar — drawer', () => {
  it('mostra o seletor de mês e o cartão completo', () => {
    renderWithProviders(<Sidebar variant="drawer" user={user} />);

    expect(monthPicker()).toBeInTheDocument();
    expect(screen.getByText('gabriel@exemplo.com')).toBeInTheDocument();
  });

  it('avisa o pai ao navegar, para o drawer fechar', async () => {
    const onNavigate = vi.fn();
    const { user: session } = renderWithProviders(
      <Sidebar variant="drawer" user={user} onNavigate={onNavigate} />,
    );

    await session.click(screen.getByRole('link', { name: 'Relatórios' }));
    expect(onNavigate).toHaveBeenCalled();
  });
});

describe('AppShell', () => {
  it('renderiza cabeçalho, conteúdo e menu', () => {
    renderWithProviders(
      <AppShell user={user}>
        <p>conteúdo da página</p>
      </AppShell>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText('conteúdo da página')).toBeInTheDocument();
  });

  it('abre e fecha o drawer pelo cabeçalho', async () => {
    const { user: session } = renderWithProviders(
      <AppShell user={user}>
        <p>conteúdo</p>
      </AppShell>,
    );

    expect(screen.queryByRole('button', { name: 'Fechar menu' })).not.toBeInTheDocument();

    await session.click(screen.getByRole('button', { name: 'Abrir menu' }));
    expect(screen.getByRole('button', { name: 'Fechar menu' })).toBeInTheDocument();

    await session.click(screen.getByRole('button', { name: 'Fechar menu' }));
    expect(screen.queryByRole('button', { name: 'Fechar menu' })).not.toBeInTheDocument();
  });

  it('recolher pelo cabeçalho muda a sidebar e guarda a preferência', async () => {
    window.localStorage.clear();
    const { user: session } = renderWithProviders(
      <AppShell user={user}>
        <p>conteúdo</p>
      </AppShell>,
    );

    await session.click(screen.getByRole('button', { name: 'Recolher menu' }));

    // Foi este o caminho que quebrou quando o botão morava no rodapé da
    // sidebar: o clique existia, mas o botão saía da área visível.
    expect(screen.getByRole('button', { name: 'Expandir menu' })).toBeInTheDocument();
    expect(window.localStorage.getItem('flowly:sidebar-collapsed')).toBe('1');
  });

  it('lê a preferência salva ao montar', () => {
    window.localStorage.setItem('flowly:sidebar-collapsed', '1');
    renderWithProviders(
      <AppShell user={user}>
        <p>conteúdo</p>
      </AppShell>,
    );

    expect(screen.getByRole('button', { name: 'Expandir menu' })).toBeInTheDocument();
    window.localStorage.clear();
  });

  it('sobrevive a localStorage bloqueado (aba anônima)', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() =>
      renderWithProviders(
        <AppShell user={user}>
          <p>conteúdo</p>
        </AppShell>,
      ),
    ).not.toThrow();

    getItem.mockRestore();
  });

  it('o Esc fecha o drawer', async () => {
    const { user: session } = renderWithProviders(
      <AppShell user={user}>
        <p>conteúdo</p>
      </AppShell>,
    );

    await session.click(screen.getByRole('button', { name: 'Abrir menu' }));
    await session.keyboard('{Escape}');

    expect(screen.queryByRole('button', { name: 'Fechar menu' })).not.toBeInTheDocument();
  });

  it('o drawer trava o scroll do fundo enquanto aberto', async () => {
    const { user: session } = renderWithProviders(
      <AppShell user={user}>
        <p>conteúdo</p>
      </AppShell>,
    );

    await session.click(screen.getByRole('button', { name: 'Abrir menu' }));
    expect(document.body.style.overflow).toBe('hidden');
  });
});
