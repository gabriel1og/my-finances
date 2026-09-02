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
  // No drawer o canto direito do topo pertence ao botão de fechar, então o
  // seletor de mês desce uma linha em vez de disputar espaço com ele.
  const monthBelow = isDrawer || !showLabels;

  return (
    <aside
      className={[
        'flex h-full flex-col border-r border-border bg-surface',
        isDrawer ? 'w-[240px]' : collapsed ? 'w-20' : 'w-[220px]',
        isDrawer ? '' : 'transition-[width] duration-200',
      ].join(' ')}
      // O drawer cobre a tela inteira, inclusive a faixa do relógio e do notch
      // no iOS — sem este respiro o logo nasce embaixo da barra de status.
      style={
        isDrawer
          ? {
              paddingTop: 'env(safe-area-inset-top)',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }
          : undefined
      }
    >
      <div
        className={[
          'flex items-center gap-2',
          // No drawer o padding-direito abre espaço para o botão de fechar.
          isDrawer
            ? 'justify-start pb-3 pl-5 pr-14 pt-6'
            : showLabels
              ? 'justify-between px-5 py-6'
              : 'justify-center px-0 py-6',
        ].join(' ')}
      >
        {showLabels ? <Logo /> : <LogoMark size={26} />}

        {!monthBelow ? (
          <Suspense fallback={<div className="h-[18px] w-[86px]" />}>
            <MonthPicker />
          </Suspense>
        ) : null}
      </div>

      {/* Recolhida ou no drawer, o seletor de mês fica numa linha própria: em
          64px de largura ou ao lado do botão de fechar não sobra espaço, e sem
          ele o usuário perderia o mês de vista. */}
      {monthBelow ? (
        <div className={`mb-3 flex ${isDrawer ? 'px-5' : 'justify-center'}`}>
          <Suspense fallback={<div className="h-[18px] w-10" />}>
            <MonthPicker compact={!isDrawer} />
          </Suspense>
        </div>
      ) : null}

      {/* Rola sempre, recolhida ou não: o tooltip do menu recolhido vive em
          portal, então o container não precisa mais deixar de cortar. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
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
