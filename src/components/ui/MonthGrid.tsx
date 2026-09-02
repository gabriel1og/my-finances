'use client';

import { useEffect, useRef, useState } from 'react';
import { MONTH_LABELS } from '@/lib/calendar';

/**
 * Navegação de ano + grade 3×4 de meses. Compartilhada pelo seletor da sidebar
 * e pelos campos de mês dos formulários — o mesmo desenho nos dois lugares.
 *
 * Teclado: setas andam na grade (esquerda/direita mês a mês, virando o ano na
 * borda; cima/baixo de três em três, que é uma linha), PageUp/PageDown trocam
 * de ano e Home/End vão para janeiro e dezembro. Só o mês em foco é tabulável,
 * para que sair da grade não custe doze tabuladas.
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
  const gridRef = useRef<HTMLDivElement>(null);
  const [focusMonth, setFocusMonth] = useState(
    () =>
      (year === selectedYear ? selectedMonth : null) ?? (year === currentYear ? currentMonth : 1),
  );
  // Só move o foco do navegador depois que o teclado foi usado: senão abrir o
  // popover com o mouse roubaria o foco do campo.
  const [keyboard, setKeyboard] = useState(false);

  useEffect(() => {
    if (!keyboard) return;
    gridRef.current?.querySelector<HTMLButtonElement>('[data-focus="true"]')?.focus();
  }, [keyboard, focusMonth, year]);

  function move(delta: number) {
    setKeyboard(true);
    const target = focusMonth + delta;

    if (target < 1) {
      onYearChange(year - 1);
      setFocusMonth(target + 12);
    } else if (target > 12) {
      onYearChange(year + 1);
      setFocusMonth(target - 12);
    } else {
      setFocusMonth(target);
    }
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -3,
      ArrowDown: 3,
    };

    if (event.key in moves) {
      event.preventDefault();
      move(moves[event.key]);
      return;
    }

    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      setKeyboard(true);
      onYearChange(year + (event.key === 'PageUp' ? -1 : 1));
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setKeyboard(true);
      setFocusMonth(event.key === 'Home' ? 1 : 12);
    }
  }

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
        <span className="num text-sm text-textPrimary" aria-live="polite">
          {year}
        </span>
        <button
          type="button"
          onClick={() => onYearChange(year + 1)}
          aria-label="Próximo ano"
          className="rounded-sm px-2 py-1 text-textSecondary transition-colors hover:bg-surfaceAlt hover:text-textPrimary"
        >
          ›
        </button>
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-label={`Meses de ${year}. Use as setas para navegar`}
        onKeyDown={onKeyDown}
        className="mt-3 grid grid-cols-3 gap-1"
      >
        {MONTH_LABELS.map((name, index) => {
          const monthNumber = index + 1;
          const isSelected = year === selectedYear && monthNumber === selectedMonth;
          const isCurrent = year === currentYear && monthNumber === currentMonth;
          const isFocus = monthNumber === focusMonth;

          return (
            <button
              key={name}
              type="button"
              data-focus={isFocus ? 'true' : undefined}
              tabIndex={isFocus ? 0 : -1}
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
