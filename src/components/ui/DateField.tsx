'use client';

import { useRef, useState } from 'react';
import { Popover } from '@/components/ui/Popover';
import {
  formatMonthYear,
  monthGrid,
  shiftMonthKey,
  todayISO,
  WEEKDAY_LABELS,
} from '@/lib/calendar';
import { formatDate } from '@/lib/format';

/**
 * Campo de data com calendário próprio, no lugar do `input[type=date]`.
 *
 * O nativo é impossível de tematizar de verdade — o popover é do sistema
 * operacional, muda a cada navegador e ignora os tokens do projeto. Como o
 * app já tem um seletor de mês próprio, ter metade dos campos com calendário
 * nativo e metade com o nosso seria pior do que qualquer um dos dois.
 */
export function DateField({
  value,
  onChange,
  label,
  className = '',
}: {
  /** ISO `YYYY-MM-DD`. */
  value: string;
  onChange: (next: string) => void;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [monthKey, setMonthKey] = useState(value.slice(0, 7));
  const triggerRef = useRef<HTMLButtonElement>(null);

  const today = todayISO();
  const [year, month] = monthKey.split('-').map(Number);
  const cells = monthGrid(year, month);

  function toggle() {
    // Abrir sempre no mês do valor atual, não no mês que sobrou da última vez.
    setMonthKey(value.slice(0, 7));
    setOpen((current) => !current);
  }

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${formatDate(value)}. Escolher outra data`}
        className={`input-base num flex items-center justify-between text-left ${
          open ? 'border-accent' : ''
        }`}
      >
        {formatDate(value)}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="shrink-0 text-textMuted"
          aria-hidden
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        label={label}
        width={268}
      >
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonthKey(shiftMonthKey(monthKey, -1))}
            aria-label="Mês anterior"
            className="rounded-sm px-2 py-1 text-textSecondary transition-colors hover:bg-surfaceAlt hover:text-textPrimary"
          >
            ‹
          </button>
          <span className="num text-sm text-textPrimary">{formatMonthYear(monthKey)}</span>
          <button
            type="button"
            onClick={() => setMonthKey(shiftMonthKey(monthKey, 1))}
            aria-label="Próximo mês"
            className="rounded-sm px-2 py-1 text-textSecondary transition-colors hover:bg-surfaceAlt hover:text-textPrimary"
          >
            ›
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-0.5">
          {WEEKDAY_LABELS.map((weekday, index) => (
            <span
              key={`${weekday}-${index}`}
              className="label-caps py-1 text-center text-3xs"
              aria-hidden
            >
              {weekday}
            </span>
          ))}

          {cells.map((cell, index) => {
            if (!cell.iso) return <span key={`empty-${index}`} />;

            const isSelected = cell.iso === value;
            const isToday = cell.iso === today;

            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => {
                  onChange(cell.iso!);
                  setOpen(false);
                }}
                aria-current={isSelected ? 'date' : undefined}
                className={[
                  'num rounded-md py-1.5 text-xs transition-colors',
                  isSelected
                    ? 'bg-accent font-medium text-white'
                    : 'text-textSecondary hover:bg-surfaceAlt hover:text-textPrimary',
                  // Hoje é contorno, não preenchimento — senão brigaria com o
                  // dia selecionado.
                  !isSelected && isToday ? 'border border-borderHover text-textPrimary' : '',
                ].join(' ')}
              >
                {cell.day}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            onChange(today);
            setOpen(false);
          }}
          className="mt-3 w-full rounded-md border border-border py-1.5 text-xs text-textSecondary transition-colors hover:border-borderHover hover:text-textPrimary"
        >
          Hoje
        </button>
      </Popover>
    </div>
  );
}
