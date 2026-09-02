'use client';

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
            onClick={onNavigate}
            // aria-label continua: com o menu recolhido o ícone é a única
            // identificação, e o tooltip visual não é lido por leitor de tela.
            aria-label={collapsed ? item.label : undefined}
            className={[
              'group/nav relative flex items-center gap-3 border-l-2 py-2.5 text-sm transition-colors',
              collapsed ? 'justify-center px-0' : 'px-5',
              active
                ? 'border-accent bg-surfaceAlt text-textPrimary'
                : 'border-transparent text-textSecondary hover:text-textPrimary',
            ].join(' ')}
          >
            {Icon ? <Icon className="shrink-0" /> : null}
            {collapsed ? null : <span className="truncate">{item.label}</span>}

            {/* Tooltip próprio em vez do `title` nativo: o do navegador demora
                cerca de um segundo para aparecer, o que atrapalha justamente
                quem está varrendo os ícones à procura da rota. */}
            {collapsed ? (
              <span
                role="tooltip"
                className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-surfaceAlt px-2.5 py-1.5 text-xs text-textPrimary opacity-0 shadow-lg transition-opacity group-hover/nav:opacity-100 group-focus-visible/nav:opacity-100"
              >
                {item.label}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
