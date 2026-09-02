'use client';

import { Suspense } from 'react';
import { Logo, LogoMark } from '@/components/layout/Logo';
import { MonthPicker } from '@/components/layout/MonthPicker';
import { SidebarNav } from '@/components/layout/SidebarNav';
import { UserCard } from '@/components/layout/UserCard';

/**
 * Uma sidebar, três formatos (o botão de recolher vive no cabeçalho global):
 * - desktop expandida (220px): marca, conta, menu em seções
 * - desktop/tablet recolhida (64px): só ícone, com tooltip
 * - mobile: a mesma coisa dentro de um drawer, sempre expandida (num drawer
 *   que já ocupa a tela, esconder o rótulo não economiza nada)
 *
 * O seletor de mês vive no cabeçalho global. Aqui ele só aparece quando o
 * cabeçalho não tem espaço para ele: no drawer e na barra recolhida.
 */
/** Divisória fina e centrada, do mesmo desenho das que separam as seções do menu. */
function Separator() {
  return <span className="mx-auto my-2 block h-px w-6 bg-border" aria-hidden />;
}

export function Sidebar({
  collapsed = false,
  variant = 'desktop',
  onNavigate,
  user,
}: {
  collapsed?: boolean;
  variant?: 'desktop' | 'drawer';
  onNavigate?: () => void;
  user: { name: string | null; email: string | null };
}) {
  const isDrawer = variant === 'drawer';
  const showLabels = isDrawer || !collapsed;

  return (
    <aside
      className={[
        'flex h-full flex-col border-r border-border bg-surface',
        isDrawer ? 'w-[240px]' : collapsed ? 'w-24' : 'w-[220px]',
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
          'flex items-center',
          // No drawer o padding-direito abre espaço para o botão de fechar.
          isDrawer ? 'pb-4 pl-5 pr-14 pt-6' : showLabels ? 'px-5 py-6' : 'justify-center px-0 py-6',
        ].join(' ')}
      >
        {showLabels ? <Logo /> : <LogoMark size={26} />}
      </div>

      {/* Só na barra expandida a identidade fica no topo. Recolhida e no
          drawer ela desce para o rodapé: ali o topo é do que se usa o tempo
          todo — mês e navegação —, e a conta é consulta ocasional. */}
      {showLabels && !isDrawer ? <UserCard name={user.name} email={user.email} /> : null}

      {/* O seletor de mês só desce para cá quando o cabeçalho global não o
          mostra: abaixo de `lg` (drawer) e na barra recolhida. */}
      {isDrawer || !showLabels ? (
        <>
          {!showLabels ? <Separator /> : null}
          <div className={`my-2 flex ${isDrawer ? 'px-3' : 'justify-center'}`}>
            <Suspense fallback={<div className="h-[30px] w-10" />}>
              <MonthPicker compact={!isDrawer} />
            </Suspense>
          </div>
        </>
      ) : null}

      {/* Rola sempre, recolhida ou não: o tooltip do menu recolhido vive em
          portal, então o container não precisa mais deixar de cortar. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Suspense fallback={<div className="h-[300px]" />}>
          <SidebarNav collapsed={!showLabels} onNavigate={onNavigate} />
        </Suspense>
      </div>

      {isDrawer ? (
        // No drawer o card cabe inteiro, então desce completo — com uma
        // divisória de largura total, que é o que a barra de 240px pede.
        <div className="border-t border-border pt-3">
          <UserCard name={user.name} email={user.email} />
        </div>
      ) : !showLabels ? (
        <div>
          <Separator />
          <div className="pb-3 pt-3">
            <UserCard name={user.name} email={user.email} collapsed />
          </div>
        </div>
      ) : null}
    </aside>
  );
}
