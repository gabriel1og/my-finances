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
            // Com a sidebar recolhida o ícone é a única identificação: o title
            // dá o tooltip nativo e o aria-label mantém o nome para leitores.
            title={collapsed ? item.label : undefined}
            aria-label={collapsed ? item.label : undefined}
            className={[
              'flex items-center gap-3 border-l-2 py-2.5 text-sm transition-colors',
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
    </nav>
  );
}
