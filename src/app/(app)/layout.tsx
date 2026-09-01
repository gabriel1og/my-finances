import { Sidebar } from '@/components/layout/Sidebar';
import { CurrencyProvider } from '@/lib/currency';
import { getProfile } from '@/lib/queries';

// Rotas autenticadas: leem cookies de sessao, nao ha o que prerenderizar.
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();

  return (
    <CurrencyProvider currency={profile?.currency ?? 'BRL'}>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 animate-fadeUp px-8 py-7">{children}</main>
      </div>
    </CurrencyProvider>
  );
}
