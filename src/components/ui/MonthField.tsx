'use client';

import { useRef, useState } from 'react';
import { MonthGrid } from '@/components/ui/MonthGrid';
import { Popover } from '@/components/ui/Popover';
import { formatMonthYear, todayISO } from '@/lib/calendar';

/**
 * Campo de mês com o mesmo seletor da sidebar, no lugar do
 * `input[type=month]`. Aceita valor vazio: em "Termina em", vazio significa
 * "sem fim", e o campo precisa dizer isso em vez de mostrar uma data qualquer.
 */
export function MonthField({
  value,
  onChange,
  label,
  placeholder = 'Escolher',
  clearable = false,
  className = '',
}: {
  /** `YYYY-MM` ou string vazia. */
  value: string;
  onChange: (next: string) => void;
  label: string;
  placeholder?: string;
  clearable?: boolean;
  className?: string;
}) {
  const today = todayISO();
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));

  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(value ? Number(value.slice(0, 4)) : currentYear);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function toggle() {
    setYear(value ? Number(value.slice(0, 4)) : currentYear);
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
        aria-label={`${label}: ${value ? formatMonthYear(value) : placeholder}. Escolher outro mês`}
        className={`input-base num flex items-center justify-between text-left ${
          open ? 'border-accent' : ''
        } ${value ? '' : 'text-textMuted'}`}
      >
        {value ? formatMonthYear(value) : placeholder}
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

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={triggerRef} label={label}>
        <MonthGrid
          year={year}
          onYearChange={setYear}
          selectedYear={value ? Number(value.slice(0, 4)) : null}
          selectedMonth={value ? Number(value.slice(5, 7)) : null}
          currentYear={currentYear}
          currentMonth={currentMonth}
          onSelect={(month) => {
            onChange(`${year}-${String(month).padStart(2, '0')}`);
            setOpen(false);
          }}
        />

        {clearable && value ? (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
            className="mt-3 w-full rounded-md border border-border py-1.5 text-xs text-textSecondary transition-colors hover:border-borderHover hover:text-textPrimary"
          >
            Sem data final
          </button>
        ) : null}
      </Popover>
    </div>
  );
}
