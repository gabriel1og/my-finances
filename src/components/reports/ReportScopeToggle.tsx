'use client';

import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import type { ReportCardScope } from '@/lib/reports';

type ReportScopeToggleProps = {
  paramKey: string;
  scope: ReportCardScope;
};

export function ReportScopeToggle({ paramKey, scope }: ReportScopeToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const isMonthOnly = scope === 'month';
  const label = isMonthOnly ? 'Ver período da página' : 'Ver só mês atual';

  function toggle() {
    const next = new URLSearchParams(params.toString());
    if (isMonthOnly) next.delete(paramKey);
    else next.set(paramKey, 'month');

    const query = next.toString();
    startTransition(() =>
      router.push((query ? `${pathname}?${query}` : pathname) as Route, { scroll: false }),
    );
  }

  return (
    <button type="button" className="btn-secondary btn-sm" onClick={toggle}>
      {label}
    </button>
  );
}
