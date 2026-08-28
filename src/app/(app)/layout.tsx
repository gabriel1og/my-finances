import { Sidebar } from '@/components/layout/Sidebar';

// Rotas autenticadas: leem cookies de sessao, nao ha o que prerenderizar.
export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 animate-fadeUp px-8 py-7">{children}</main>
    </div>
  );
}
