'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { CollapseIcon, ExpandIcon, MenuIcon } from '@/components/layout/NavIcons';
import { MonthPicker } from '@/components/layout/MonthPicker';
import { NAV_ITEMS, SUB_ROUTES } from '@/lib/constants';

/**
 * Cabeçalho global fixo: identidade da página à esquerda, seletor de mês à
 * direita.
 *
 * O mês vale para o app inteiro, não para uma tela específica — no topo ele
 * fica sempre no mesmo lugar, em vez de dividir espaço com o logo na sidebar.
 * Abaixo de `lg` o seletor sai daqui e volta para o menu: no celular o topo
 * precisa do espaço para o botão do menu e para o título.
 *
 * Título e subtítulo vêm de `NAV_ITEMS`, então cada rota descreve a si mesma
 * num lugar só.
 */
export function AppHeader({
  onOpenMenu,
  collapsed,
  onToggleCollapse,
}: {
  onOpenMenu: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const pathname = usePathname();
  // Sub-rota primeiro: "/settings/import" também começa com "/settings".
  const item =
    SUB_ROUTES.find((entry) => pathname.startsWith(entry.href)) ??
    NAV_ITEMS.find((entry) => pathname.startsWith(entry.href));

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8"
      // viewportFit: 'cover' faz o conteúdo ir até a borda; o notch do iOS
      // comeria o botão do menu sem este respiro.
      style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
    >
      <button
        onClick={onOpenMenu}
        aria-label="Abrir menu"
        className="-ml-1 rounded-md p-1 text-textSecondary transition-colors hover:text-textPrimary lg:hidden"
      >
        <MenuIcon />
      </button>

      {/* Recolher o menu mora aqui, e não no rodapé da sidebar: no rodapé o
          botão dependia de sobrar altura dentro da barra, e sumia de vista
          quando o menu crescia. No cabeçalho ele está sempre no mesmo lugar. */}
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        aria-pressed={collapsed}
        title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        className="-ml-1 hidden rounded-md p-1 text-textMuted transition-colors hover:text-textPrimary lg:block"
      >
        {collapsed ? <ExpandIcon /> : <CollapseIcon />}
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold tracking-tight sm:text-base">
          {item?.title ?? 'flowly'}
        </h1>
        {item?.subtitle ? (
          <p className="truncate text-2xs text-textSecondary sm:text-xs">{item.subtitle}</p>
        ) : null}
      </div>

      <div className="hidden shrink-0 lg:block">
        <Suspense fallback={<div className="h-[30px] w-[104px]" />}>
          <MonthPicker />
        </Suspense>
      </div>
    </header>
  );
}
