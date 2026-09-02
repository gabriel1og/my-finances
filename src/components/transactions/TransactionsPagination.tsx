'use client';

import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function TransactionsPagination({
  page,
  pageCount,
  total,
  shown,
}: {
  page: number;
  pageCount: number;
  total: number;
  shown: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function goTo(next: number) {
    const search = new URLSearchParams(params.toString());
    if (next <= 1) search.delete('page');
    else search.set('page', String(next));
    router.push(`${pathname}?${search.toString()}` as Route);
  }

  return (
    <div className="mt-4 flex items-center justify-between">
      <span className="num text-xs text-textMuted">
        {shown} de {total} lançamento(s)
      </span>

      {pageCount > 1 ? (
        <div className="flex items-center gap-2">
          <button
            onClick={() => goTo(page - 1)}
            disabled={page <= 1}
            className="btn-secondary px-3 text-xs"
          >
            Anterior
          </button>
          <span className="num text-xs text-textSecondary">
            {page} / {pageCount}
          </span>
          <button
            onClick={() => goTo(page + 1)}
            disabled={page >= pageCount}
            className="btn-secondary px-3 text-xs"
          >
            Próxima
          </button>
        </div>
      ) : null}
    </div>
  );
}
