'use client';

import { useEffect, useRef, useState } from 'react';
import { MonthGrid } from '@/components/ui/MonthGrid';
import { Popover } from '@/components/ui/Popover';
import { parseMonthInput, todayISO } from '@/lib/calendar';

/**
 * Campo de mês com o mesmo seletor da sidebar, no lugar do
 * `input[type=month]`. Aceita valor vazio: em "Termina em", vazio significa
 * "sem fim", e o campo precisa dizer isso em vez de mostrar uma data qualquer.
 *
 * Como o campo de data, aceita digitação: `08`, `08/26` ou `08/2026`. O que
 * não for entendido volta ao valor anterior em vez de virar mês inválido.
 */
export function MonthField({
  value,
  onChange,
  label,
  placeholder = 'mm/aaaa',
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

  const display = (iso: string) => (iso ? `${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => display(value));
  const [year, setYear] = useState(value ? Number(value.slice(0, 4)) : currentYear);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setText(display(value)), [value]);

  function commitText() {
    // Campo limpável e vazio significa "sem data final" — apagar é uma
    // intenção legítima, não um erro de digitação.
    if (!text.trim()) {
      if (clearable) onChange('');
      else setText(display(value));
      return;
    }

    const parsed = parseMonthInput(text, value || today);
    if (parsed) onChange(parsed);
    else setText(display(value));
  }

  function openGrid() {
    setYear(value ? Number(value.slice(0, 4)) : currentYear);
    setOpen(true);
  }

  return (
    <div ref={triggerRef} className={`relative ${className}`}>
      <div
        className={`input-base num flex items-center gap-2 focus-within:border-accent ${
          open ? 'border-accent' : ''
        }`}
      >
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={commitText}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitText();
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              openGrid();
            }
          }}
          inputMode="numeric"
          placeholder={placeholder}
          aria-label={label}
          className="num w-full bg-transparent text-sm text-textPrimary outline-none placeholder:text-textMuted focus-visible:ring-0"
        />

        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openGrid())}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${label}: escolher no calendário`}
          className="shrink-0 rounded-sm text-textMuted transition-colors hover:text-textPrimary"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden
          >
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
        </button>
      </div>

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
