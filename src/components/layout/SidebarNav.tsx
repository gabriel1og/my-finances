'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { NAV_ICONS } from '@/components/layout/NavIcons';
import { NAV_ITEMS } from '@/lib/constants';

/**
 * O mês selecionado vive na query string, então cada link precisa carregá-lo —
 * sem isso, trocar de aba jogava o usuário de volta no mês atual.
 * /settings não é sensível a mês e fica de fora, para não sujar a URL.
 */
export function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [tip, setTip] = useState<{ label: string; top: number; left: number } | null>(null);

  useEffect(() => setMounted(true), []);
  // Recolher ou expandir troca o layout sem passar por mouseleave — sem isto
  // o tooltip ficaria preso na tela.
  useEffect(() => setTip(null), [collapsed]);

  const pathname = usePathname();
  const params = useSearchParams();
  const month = params.get('month');

  return (
    <nav className="flex flex-col">
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        const href = (
          month && item.monthAware ? `${item.href}?month=${month}` : item.href
        ) as Route;
        const Icon = NAV_ICONS[item.href];

        return (
          <Link
            key={item.href}
            href={href}
            onClick={() => {
              setTip(null);
              onNavigate?.();
            }}
            // aria-label continua: com o menu recolhido o ícone é a única
            // identificação, e o tooltip visual não é lido por leitor de tela.
            aria-label={collapsed ? item.label : undefined}
            onMouseEnter={(event) => {
              if (!collapsed) return;
              const rect = event.currentTarget.getBoundingClientRect();
              setTip({ label: item.label, top: rect.top + rect.height / 2, left: rect.right + 8 });
            }}
            onFocus={(event) => {
              if (!collapsed) return;
              const rect = event.currentTarget.getBoundingClientRect();
              setTip({ label: item.label, top: rect.top + rect.height / 2, left: rect.right + 8 });
            }}
            onMouseLeave={() => setTip(null)}
            onBlur={() => setTip(null)}
            className={[
              'relative flex items-center gap-3 border-l-2 py-2.5 text-sm transition-colors',
              collapsed ? 'justify-center px-0' : 'px-5',
              active
                ? 'border-accent bg-surfaceAlt text-textPrimary'
                : 'border-transparent text-textSecondary hover:text-textPrimary',
            ].join(' ')}
          >
            {Icon ? <Icon className="shrink-0" /> : null}
            {collapsed ? null : <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}

      {/* Tooltip próprio em vez do `title` nativo, que demora cerca de um
          segundo para aparecer — justamente quando se está varrendo os ícones
          à procura da rota. Em portal com posição fixa: como filho do link, ele
          obrigava o container do menu a ficar `overflow-visible`, e aí o menu
          não rolava em tela baixa. */}
      {mounted && tip
        ? createPortal(
            <span
              role="tooltip"
              style={{ top: tip.top, left: tip.left }}
              className="pointer-events-none fixed z-[70] -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-surfaceAlt px-2.5 py-1.5 text-xs text-textPrimary shadow-lg"
            >
              {tip.label}
            </span>,
            document.body,
          )
        : null}
    </nav>
  );
}
