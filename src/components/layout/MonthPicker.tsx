'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { currentMonth } from '@/lib/format';

export function MonthPicker() {
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
    router.push(`${pathname}?${search.toString()}`);
  }

  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    new Date(`${month.slice(0, 7)}-01T12:00:00`),
  );

  return (
    <div className="flex items-center justify-between gap-2">
      <button
        onClick={() => shift(-1)}
        className="rounded-sm px-2 py-1 text-textSecondary transition-colors hover:text-textPrimary"
        aria-label="Mês anterior"
      >
        ‹
      </button>
      <span className="num text-xs text-textPrimary">{label}</span>
      <button
        onClick={() => shift(1)}
        className="rounded-sm px-2 py-1 text-textSecondary transition-colors hover:text-textPrimary"
        aria-label="Próximo mês"
      >
        ›
      </button>
    </div>
  );
}
