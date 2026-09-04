import { AppShell } from '@/components/layout/AppShell';
import { SessionGuard } from '@/components/auth/SessionGuard';
import { BiometricGuard } from '@/components/auth/BiometricGuard';
import { BiometricLockPaint } from '@/components/auth/BiometricLockPaint';
import { CurrencyProvider } from '@/lib/currency';
import { getAuthEmail, getProfile } from '@/lib/queries';

// Rotas autenticadas: leem cookies de sessao, nao ha o que prerenderizar.
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [profile, email] = await Promise.all([getProfile(), getAuthEmail()]);

  return (
    <CurrencyProvider currency={profile?.currency ?? 'BRL'}>
      {profile ? <BiometricLockPaint userId={profile.id} /> : null}
      <SessionGuard />
      {profile ? <BiometricGuard userId={profile.id} /> : null}
      <AppShell user={{ name: profile?.display_name ?? null, email }}>{children}</AppShell>
    </CurrencyProvider>
  );
}
