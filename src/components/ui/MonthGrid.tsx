'use client';

import { MONTH_LABELS } from '@/lib/calendar';

/**
 * Navegação de ano + grade 3×4 de meses. Compartilhada pelo seletor da sidebar
 * e pelos campos de mês dos formulários — o mesmo desenho nos dois lugares.
 */
export function MonthGrid({
  year,
  onYearChange,
  selectedYear,
  selectedMonth,
  currentYear,
  currentMonth,
  onSelect,
}: {
  year: number;
  onYearChange: (next: number) => void;
  selectedYear: number | null;
  selectedMonth: number | null;
  currentYear: number;
  currentMonth: number;
  onSelect: (month: number) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onYearChange(year - 1)}
          aria-label="Ano anterior"
          className="rounded-sm px-2 py-1 text-textSecondary transition-colors hover:bg-surfaceAlt hover:text-textPrimary"
        >
          ‹
        </button>
        <span className="num text-sm text-textPrimary">{year}</span>
        <button
          type="button"
          onClick={() => onYearChange(year + 1)}
          aria-label="Próximo ano"
          className="rounded-sm px-2 py-1 text-textSecondary transition-colors hover:bg-surfaceAlt hover:text-textPrimary"
        >
          ›
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1">
        {MONTH_LABELS.map((name, index) => {
          const monthNumber = index + 1;
          const isSelected = year === selectedYear && monthNumber === selectedMonth;
          const isCurrent = year === currentYear && monthNumber === currentMonth;

          return (
            <button
              key={name}
              type="button"
              onClick={() => onSelect(monthNumber)}
              aria-current={isSelected ? 'true' : undefined}
              className={[
                'num rounded-md py-2 text-xs transition-colors',
                isSelected
                  ? 'bg-accent font-medium text-white'
                  : 'text-textSecondary hover:bg-surfaceAlt hover:text-textPrimary',
                // O mês corrente ganha contorno, não preenchimento: senão
                // competiria com o selecionado.
                !isSelected && isCurrent ? 'border border-borderHover text-textPrimary' : '',
              ].join(' ')}
            >
              {name}
            </button>
          );
        })}
      </div>
    </>
  );
}
