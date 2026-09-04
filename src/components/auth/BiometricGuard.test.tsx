import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderWithProviders, screen, waitFor } from '@/test/render';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));

const signOut = vi.fn().mockResolvedValue({ error: null });
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signOut } }) }));

const { BiometricGuard } = await import('@/components/auth/BiometricGuard');
const { BIOMETRIC_LOCK_CLASS, BIOMETRIC_RELOCK_SECONDS, BIOMETRIC_STORAGE_KEY } =
  await import('@/lib/biometric');

const USER = 'user-1';
const get = vi.fn();

function registerCredential(userId = USER) {
  window.localStorage.setItem(
    BIOMETRIC_STORAGE_KEY,
    JSON.stringify({ credentialId: 'Y3JlZA', userId }),
  );
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

const dialog = () => screen.queryByRole('dialog');

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.add(BIOMETRIC_LOCK_CLASS);
  setVisibility('visible');
  get.mockReset();
  replace.mockClear();
  signOut.mockClear();
  Object.defineProperty(navigator, 'credentials', {
    configurable: true,
    value: { get, create: vi.fn() },
  });
});

describe('BiometricGuard — quando não há cadeado', () => {
  it('não bloqueia nada e libera a cobertura pré-pintura', async () => {
    renderWithProviders(<BiometricGuard userId={USER} />);

    await waitFor(() => expect(document.documentElement).not.toHaveClass(BIOMETRIC_LOCK_CLASS));
    expect(dialog()).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it('ignora credencial registrada por outra conta no mesmo aparelho', async () => {
    registerCredential('outra-conta');
    renderWithProviders(<BiometricGuard userId={USER} />);

    await waitFor(() => expect(document.documentElement).not.toHaveClass(BIOMETRIC_LOCK_CLASS));
    expect(dialog()).not.toBeInTheDocument();
  });
});

describe('BiometricGuard — com cadeado', () => {
  it('cobre a tela, pede a biometria sozinho e libera quando ela confirma', async () => {
    registerCredential();
    let confirm!: (value: unknown) => void;
    get.mockImplementation(() => new Promise((resolve) => (confirm = resolve)));

    renderWithProviders(<BiometricGuard userId={USER} />);

    expect(await screen.findByRole('dialog')).toHaveAccessibleName('flowly bloqueado');
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    // A cobertura sai porque o próprio diálogo passa a tapar a tela.
    expect(document.documentElement).not.toHaveClass(BIOMETRIC_LOCK_CLASS);

    await act(async () => confirm({ id: 'cred' }));
    await waitFor(() => expect(dialog()).not.toBeInTheDocument());
  });

  it('não alarma quando a tentativa automática falha, mas alerta na manual', async () => {
    // No Safari a tentativa automática falha por falta de gesto do usuário —
    // erro esperado, não motivo para mensagem vermelha na primeira abertura.
    registerCredential();
    get.mockRejectedValue(new Error('NotAllowedError'));

    const { user } = renderWithProviders(<BiometricGuard userId={USER} />);

    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Desbloquear' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(dialog()).toBeInTheDocument();
  });

  it('volta a bloquear depois de tempo em segundo plano', async () => {
    registerCredential();
    get.mockResolvedValueOnce({ id: 'cred' }).mockImplementation(() => new Promise(() => {}));

    renderWithProviders(<BiometricGuard userId={USER} />);
    await waitFor(() => expect(dialog()).not.toBeInTheDocument());

    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(0);
    setVisibility('hidden');
    now.mockReturnValue(BIOMETRIC_RELOCK_SECONDS * 1000);
    setVisibility('visible');

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('não pede biometria de novo numa ida rápida a outro app', async () => {
    registerCredential();
    get.mockResolvedValueOnce({ id: 'cred' }).mockImplementation(() => new Promise(() => {}));

    renderWithProviders(<BiometricGuard userId={USER} />);
    await waitFor(() => expect(dialog()).not.toBeInTheDocument());

    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(0);
    setVisibility('hidden');
    now.mockReturnValue(1_000);
    setVisibility('visible');

    expect(dialog()).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('a saída de emergência apaga o cadeado local antes de deslogar', async () => {
    // Aparelho novo ou biometria reconfigurada deixariam a conta inacessível
    // para sempre se sair não removesse a credencial órfã.
    registerCredential();
    get.mockRejectedValue(new Error('NotAllowedError'));

    const { user } = renderWithProviders(<BiometricGuard userId={USER} />);

    await user.click(await screen.findByRole('button', { name: /Sair da conta/ }));

    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(window.localStorage.getItem(BIOMETRIC_STORAGE_KEY)).toBeNull();
    expect(replace).toHaveBeenCalledWith('/login');
  });
});
