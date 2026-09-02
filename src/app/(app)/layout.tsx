import { AppShell } from '@/components/layout/AppShell';
import { CurrencyProvider } from '@/lib/currency';
import { getProfile } from '@/lib/queries';

// Rotas autenticadas: leem cookies de sessao, nao ha o que prerenderizar.
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();

  return (
    <CurrencyProvider currency={profile?.currency ?? 'BRL'}>
      <AppShell>{children}</AppShell>
    </CurrencyProvider>
  );
}
