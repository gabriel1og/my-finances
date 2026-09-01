import Link from 'next/link';
import type { Route } from 'next';

/**
 * Um lançamento fixo só serve se o usuário lembrar dele. O banner é o lembrete
 * — e leva para a tela onde ele confirma, em vez de lançar por conta própria.
 */
export function PendingBanner({ count, month }: { count: number; month: string }) {
  if (count === 0) return null;

  return (
    <Link
      href={`/recurring?month=${month}` as Route}
      className="mb-4 flex items-center justify-between rounded-lg border border-warning/40 bg-warningDim px-5 py-3 transition-colors hover:border-warning"
    >
      <span className="text-sm text-textPrimary">
        <span className="num text-warning">{count}</span> lançamento(s) fixo(s) pendente(s) neste
        mês
      </span>
      <span className="text-xs text-warning">Revisar →</span>
    </Link>
  );
}
