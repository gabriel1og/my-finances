'use client';

import { useMoney } from '@/lib/currency';
import { formatDate } from '@/lib/format';
import { itemDuplicateKeys } from '@/lib/import/plan';
import type { PlanItem } from '@/lib/import/types';

/**
 * Cada linha do plano com sua caixa de seleção. Tabela a partir de `lg`; um
 * bloco por linha abaixo disso, como as tabelas de relatório.
 *
 * Duplicata e aviso não bloqueiam nada — marcam. O usuário decide, e a
 * decisão fica visível na própria linha, não numa lista à parte.
 */
export function ImportRows({
  items,
  selected,
  duplicates,
  onToggle,
  onToggleAll,
}: {
  items: PlanItem[];
  selected: Set<string>;
  duplicates: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], on: boolean) => void;
}) {
  const money = useMoney();
  const ids = items.map((item) => item.id);
  const allOn = ids.every((id) => selected.has(id));
  const someOn = !allOn && ids.some((id) => selected.has(id));

  return (
    <section className="card mt-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="label-caps">Linhas</span>
          <p className="mt-1 text-xs text-textSecondary">
            Desmarque o que não deve entrar. Linhas que já existem começam desmarcadas.
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-textSecondary">
          <input
            type="checkbox"
            checked={allOn}
            ref={(element) => {
              if (element) element.indeterminate = someOn;
            }}
            onChange={(event) => onToggleAll(ids, event.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          Todas
        </label>
      </div>

      {/* Tabela (lg+) */}
      <div className="mt-3 hidden overflow-x-auto lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="label-caps text-left">
              <th className="w-8 pb-2 font-medium" />
              <th className="pb-2 font-medium">Data</th>
              <th className="pb-2 font-medium">Descrição</th>
              <th className="pb-2 font-medium">Categoria</th>
              <th className="pb-2 font-medium">Conta / cartão</th>
              <th className="pb-2 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const on = selected.has(item.id);
              const dup = itemDuplicateKeys(item).some((key) => duplicates.has(key));
              const view = describe(item);
              return (
                <tr
                  key={item.id}
                  className={`border-t border-border ${on ? '' : 'text-textMuted'}`}
                >
                  <td className="py-2 align-top">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => onToggle(item.id)}
                      aria-label={`Importar linha ${view.line}`}
                      className="mt-0.5 h-4 w-4 accent-accent"
                    />
                  </td>
                  <td className="num whitespace-nowrap py-2 align-top text-xs">
                    {formatDate(view.date)}
                  </td>
                  <td className="py-2 align-top">
                    <p className={on ? 'text-textPrimary' : ''}>{view.description}</p>
                    <Flags dup={dup} warnings={view.warnings} line={view.line} />
                  </td>
                  <td className="py-2 align-top text-xs text-textSecondary">{view.category}</td>
                  <td className="py-2 align-top text-xs text-textSecondary">{view.origin}</td>
                  <td
                    className={`num whitespace-nowrap py-2 text-right align-top ${on ? view.tone : ''}`}
                  >
                    {view.sign}
                    {money(view.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Blocos (abaixo de lg) */}
      <ul className="mt-3 lg:hidden">
        {items.map((item) => {
          const on = selected.has(item.id);
          const dup = itemDuplicateKeys(item).some((key) => duplicates.has(key));
          const view = describe(item);
          return (
            <li key={item.id} className={`row-divider flex gap-3 ${on ? '' : 'text-textMuted'}`}>
              <input
                type="checkbox"
                checked={on}
                onChange={() => onToggle(item.id)}
                aria-label={`Importar linha ${view.line}`}
                className="mt-1 h-4 w-4 shrink-0 accent-accent"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className={`min-w-0 flex-1 text-sm ${on ? 'text-textPrimary' : ''}`}>
                    {view.description}
                  </p>
                  <span className={`num shrink-0 text-sm ${on ? view.tone : ''}`}>
                    {view.sign}
                    {money(view.amount)}
                  </span>
                </div>
                <p className="mt-0.5 text-2xs text-textSecondary">
                  <span className="num">{formatDate(view.date)}</span>
                  {view.category ? ` · ${view.category}` : ''}
                  {view.origin ? ` · ${view.origin}` : ''}
                </p>
                <Flags dup={dup} warnings={view.warnings} line={view.line} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Flags({ dup, warnings, line }: { dup: boolean; warnings: string[]; line: string }) {
  if (!dup && warnings.length === 0) return null;
  return (
    <div className="mt-0.5 space-y-0.5 text-2xs">
      {dup ? <p className="text-warning">Já existe um lançamento igual no flowly.</p> : null}
      {warnings.map((warning) => (
        <p key={warning} className="text-textSecondary">
          <span className="num text-textMuted">L{line}</span> {warning}
        </p>
      ))}
    </div>
  );
}

function describe(item: PlanItem) {
  if (item.kind === 'transfer') {
    const { transfer } = item;
    return {
      line: transfer.lines.join('+'),
      date: transfer.date,
      description: `${transfer.from} → ${transfer.to}`,
      category: 'Transferência',
      origin: '',
      amount: transfer.amount,
      sign: '',
      tone: 'text-textSecondary',
      warnings: [] as string[],
    };
  }

  const { row } = item;
  const isIncome = row.type === 'income';
  return {
    line: String(row.line),
    date: row.date,
    description: row.description,
    category:
      row.nature === 'card_payment' ? `Fatura · ${row.paidCard ?? ''}` : (row.category ?? '—'),
    origin: row.origin ?? '—',
    amount: row.amount,
    sign: isIncome ? '+' : '−',
    tone: isIncome ? 'text-income' : 'text-expense',
    warnings: row.warnings,
  };
}
