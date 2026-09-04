import { AppShell } from '@/components/layout/AppShell';
import { SessionGuard } from '@/components/auth/SessionGuard';
import { CurrencyProvider } from '@/lib/currency';
import { getAuthEmail, getProfile } from '@/lib/queries';

// Rotas autenticadas: leem cookies de sessao, nao ha o que prerenderizar.
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [profile, email] = await Promise.all([getProfile(), getAuthEmail()]);

  return (
    <CurrencyProvider currency={profile?.currency ?? 'BRL'}>
      <SessionGuard />
      <AppShell user={{ name: profile?.display_name ?? null, email }}>{children}</AppShell>
    </CurrencyProvider>
  );
}
