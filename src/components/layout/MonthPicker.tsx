'use client';

import type { Route } from 'next';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { currentMonth } from '@/lib/format';

export function MonthPicker({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const month = params.get('month') ?? currentMonth();

  function shift(delta: number) {
    const date = new Date(`${month.slice(0, 7)}-01T12:00:00`);
    date.setMonth(date.getMonth() + delta);
    const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    const search = new URLSearchParams(params.toString());
    search.set('month', next);
    router.push(`${pathname}?${search.toString()}` as Route);
  }

  // Formato compacto MM/AA — o nome por extenso não cabe ao lado do logo.
  const label = `${month.slice(5, 7)}/${month.slice(2, 4)}`;

  return (
    <div className={compact ? 'flex items-center' : 'flex items-center gap-1'}>
      <button
        onClick={() => shift(-1)}
        className={`rounded-sm leading-none text-textSecondary transition-colors hover:text-textPrimary ${
          compact ? 'px-0.5' : 'px-1'
        }`}
        aria-label="Mês anterior"
      >
        ‹
      </button>
      <span
        className={`num text-center text-textPrimary ${
          compact ? 'min-w-[30px] text-[10px]' : 'min-w-[42px] text-xs'
        }`}
      >
        {label}
      </span>
      <button
        onClick={() => shift(1)}
        className={`rounded-sm leading-none text-textSecondary transition-colors hover:text-textPrimary ${
          compact ? 'px-0.5' : 'px-1'
        }`}
        aria-label="Próximo mês"
      >
        ›
      </button>
    </div>
  );
}
