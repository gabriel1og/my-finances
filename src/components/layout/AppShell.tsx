'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { CloseIcon, MenuIcon } from '@/components/layout/NavIcons';
import { Sidebar } from '@/components/layout/Sidebar';

const STORAGE_KEY = 'flowly:sidebar-collapsed';

/**
 * Casca responsiva.
 * - < 1024px: sidebar sai do fluxo e vira drawer, aberto pelo topo fixo.
 * - >= 1024px: sidebar fixa, expandida ou recolhida (preferência salva).
 *
 * A preferência é lida depois da montagem para não divergir do HTML do
 * servidor, que não conhece o localStorage.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      // Modo privado ou storage bloqueado: segue expandida.
    }
  }, []);

  function toggleCollapse() {
    setCollapsed((value) => {
      const next = !value;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Sem persistência, mas a sessão continua funcionando.
      }
      return next;
    });
  }

  // Navegar fecha o drawer; sem isso ele cobriria a página recém-aberta.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDrawerOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [drawerOpen]);

  return (
    <div className="flex min-h-screen">
      {/* Desktop e tablet largo */}
      <div className="sticky top-0 hidden h-screen shrink-0 lg:block">
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topo só existe abaixo de lg, onde a sidebar não cabe. */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur lg:hidden">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menu"
            className="rounded-md p-1 text-textSecondary transition-colors hover:text-textPrimary"
          >
            <MenuIcon />
          </button>
          <span className="text-base font-semibold tracking-tight">flowly</span>
        </header>

        <main className="min-w-0 flex-1 animate-fadeUp px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          {children}
        </main>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />

          <div className="relative h-full animate-fadeUp">
            <Sidebar variant="drawer" onNavigate={() => setDrawerOpen(false)} />
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="Fechar menu"
              className="absolute right-3 top-6 rounded-md p-1 text-textMuted transition-colors hover:text-textPrimary"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
