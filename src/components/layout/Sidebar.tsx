'use client';

import { Suspense } from 'react';
import { CollapseIcon, ExpandIcon } from '@/components/layout/NavIcons';
import { Logo, LogoMark } from '@/components/layout/Logo';
import { MonthPicker } from '@/components/layout/MonthPicker';
import { SidebarNav } from '@/components/layout/SidebarNav';

/**
 * Uma sidebar, três formatos:
 * - desktop expandida (220px): ícone + rótulo
 * - desktop/tablet recolhida (64px): só ícone, com tooltip
 * - mobile: a mesma coisa dentro de um drawer, sempre expandida (num drawer
 *   que já ocupa a tela, esconder o rótulo não economiza nada)
 */
export function Sidebar({
  collapsed = false,
  onToggleCollapse,
  variant = 'desktop',
  onNavigate,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  variant?: 'desktop' | 'drawer';
  onNavigate?: () => void;
}) {
  const isDrawer = variant === 'drawer';
  const showLabels = isDrawer || !collapsed;

  return (
    <aside
      className={[
        'flex h-full flex-col border-r border-border bg-surface',
        isDrawer ? 'w-[240px]' : collapsed ? 'w-20' : 'w-[220px]',
        isDrawer ? '' : 'transition-[width] duration-200',
      ].join(' ')}
    >
      <div
        className={[
          'flex items-center gap-2 py-6',
          showLabels ? 'justify-between px-5' : 'justify-center px-0',
        ].join(' ')}
      >
        {showLabels ? (
          <>
            <Logo />
            <Suspense fallback={<div className="h-[18px] w-[86px]" />}>
              <MonthPicker />
            </Suspense>
          </>
        ) : (
          <LogoMark size={26} />
        )}
      </div>

      {/* Recolhida, o seletor de mês desce para baixo do logo: MM/AA cabe em
          64px, e sem ele o usuário perderia o mês de vista. */}
      {!showLabels ? (
        <div className="mb-2 flex justify-center">
          <Suspense fallback={<div className="h-[18px] w-10" />}>
            <MonthPicker compact />
          </Suspense>
        </div>
      ) : null}

      {/* Recolhida, o container não pode cortar: o tooltip de cada ícone é
          desenhado fora dos 64px da barra. Expandida, volta a rolar. */}
      <div className={`min-h-0 flex-1 ${showLabels ? 'overflow-y-auto' : 'overflow-visible'}`}>
        <Suspense fallback={<div className="h-[300px]" />}>
          <SidebarNav collapsed={!showLabels} onNavigate={onNavigate} />
        </Suspense>
      </div>

      {onToggleCollapse ? (
        <button
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className={[
            'hidden items-center gap-3 border-t border-border py-3 text-xs text-textMuted transition-colors hover:text-textPrimary lg:flex',
            collapsed ? 'justify-center px-0' : 'px-5',
          ].join(' ')}
        >
          {collapsed ? <ExpandIcon /> : <CollapseIcon />}
          {collapsed ? null : <span>Recolher menu</span>}
        </button>
      ) : null}
    </aside>
  );
}
