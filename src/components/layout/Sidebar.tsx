'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/lib/constants';
import { MonthPicker } from '@/components/layout/MonthPicker';

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-border bg-surface">
      <div className="px-5 py-6">
        <span className="text-lg font-semibold tracking-tight">flowly</span>
      </div>

      <nav className="flex flex-col">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
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

      <div className="mt-auto border-t border-border p-4">
        <Suspense fallback={<div className="h-[26px]" />}>
          <MonthPicker />
        </Suspense>
      </div>
    </aside>
  );
}
