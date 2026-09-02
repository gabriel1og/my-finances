'use client';

import { useSearchParams } from 'next/navigation';

/**
 * Exportação é um GET num route handler, não uma server action: o navegador
 * precisa receber o arquivo como download, e action retorna dados, não
 * resposta HTTP com Content-Disposition.
 */
export function ExportButton({ month }: { month: string }) {
  const params = useSearchParams();
  const scope = params.get('scope') === 'all' ? 'all' : 'month';
  const href = `/api/export/transactions?scope=${scope}&month=${month}`;

  return (
    <a
      href={href}
      className="rounded-md border border-border px-4 py-2 text-sm text-textSecondary transition-colors hover:border-borderHover hover:text-textPrimary"
      title={scope === 'all' ? 'Exportar todo o histórico' : 'Exportar o mês selecionado'}
    >
      Exportar CSV
    </a>
  );
}
