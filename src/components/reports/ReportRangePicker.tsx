'use client';

import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { DEFAULT_REPORT_RANGE, REPORT_RANGES } from '@/lib/constants';
import { parseReportRange } from '@/lib/reports';

/**
 * Janela dos relatórios, em meses.
 *
 * Vive na URL como o resto dos filtros do app: o link leva o período junto e o
 * botão voltar desfaz a troca. O padrão sai da URL — 12 meses não escreve
 * `?range=`, para o endereço não carregar o que já é o normal.
 *
 * O mês selecionado continua sendo o fim da janela, e quem o controla é o
 * seletor do cabeçalho global.
 */
export function ReportRangePicker() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const range = parseReportRange(params.get('range'));

  function change(value: string) {
    const next = new URLSearchParams(params.toString());
    if (Number(value) === DEFAULT_REPORT_RANGE) next.delete('range');
    else next.set('range', value);

    const query = next.toString();
    startTransition(() => router.push((query ? `${pathname}?${query}` : pathname) as Route));
  }

  return (
    <label className="flex items-center gap-2 text-xs text-textSecondary">
      Período
      <select
        aria-label="Período dos relatórios"
        className="select-base w-auto"
        value={range}
        onChange={(event) => change(event.target.value)}
      >
        {REPORT_RANGES.map((option) => (
          <option key={option} value={option}>
            {option} meses
          </option>
        ))}
      </select>
    </label>
  );
}
