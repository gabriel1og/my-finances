'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { NAV_ITEMS } from '@/lib/constants';

/**
 * O mês selecionado vive na query string, então cada link do menu precisa
 * carregá-lo — sem isso, trocar de aba jogava o usuário de volta no mês atual.
 * /settings não é sensível a mês e fica de fora, para não sujar a URL.
 */
export function SidebarNav() {
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

        return (
          <Link
            key={item.href}
            href={href}
            className={[
              'border-l-2 px-5 py-2.5 text-sm transition-colors',
              active
                ? 'border-accent bg-surfaceAlt text-textPrimary'
                : 'border-transparent text-textSecondary hover:text-textPrimary',
            ].join(' ')}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
