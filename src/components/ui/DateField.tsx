'use client';

import { useEffect, useRef, useState } from 'react';
import { Popover } from '@/components/ui/Popover';
import {
  formatMonthYear,
  monthGrid,
  parseDateInput,
  shiftDays,
  shiftISOMonths,
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
 *
 * O campo é editável: para lançamento retroativo, digitar `05/08` é mais
 * rápido que voltar meses no calendário. O que for digitado só vira valor se
 * `parseDateInput` entender; caso contrário o campo volta ao que estava.
 *
 * Na grade vale o padrão de calendário acessível: uma única célula tabulável
 * (roving tabindex) e setas para andar dia a dia, semana a semana e mês a mês.
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
  const [text, setText] = useState(() => formatDate(value));
  const [focusDay, setFocusDay] = useState(value);
  const triggerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const today = todayISO();
  const monthKey = focusDay.slice(0, 7);
  const [year, month] = monthKey.split('-').map(Number);
  const cells = monthGrid(year, month);

  // O valor pode mudar por fora (editar outra transação no mesmo modal).
  useEffect(() => setText(formatDate(value)), [value]);

  // Depois de trocar o dia em foco, o foco do navegador precisa acompanhar —
  // senão a próxima seta seria interpretada pelo documento, não pela grade.
  useEffect(() => {
    if (!open) return;
    const cell = gridRef.current?.querySelector<HTMLButtonElement>('[data-focus="true"]');
    cell?.focus();
  }, [open, focusDay]);

  function openAt(iso: string) {
    setFocusDay(iso);
    setOpen(true);
  }

  function pick(iso: string) {
    onChange(iso);
    setFocusDay(iso);
    setOpen(false);
  }

  function commitText() {
    const parsed = parseDateInput(text, value || today);
    if (parsed) onChange(parsed);
    else setText(formatDate(value));
  }

  function onGridKeyDown(event: React.KeyboardEvent) {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };

    if (event.key in moves) {
      event.preventDefault();
      setFocusDay((current) => shiftDays(current, moves[event.key]));
      return;
    }

    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      setFocusDay((current) => shiftISOMonths(current, event.key === 'PageUp' ? -1 : 1));
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setFocusDay((current) =>
        event.key === 'Home'
          ? `${current.slice(0, 7)}-01`
          : shiftDays(shiftISOMonths(`${current.slice(0, 7)}-01`, 1), -1),
      );
    }
  }

  return (
    <div ref={triggerRef} className={`relative ${className}`}>
      <div
        className={`input-base num flex items-center gap-2 focus-within:border-accent ${
          open ? 'border-accent' : ''
        }`}
        // O anel de foco vive no container para não parecer que o campo e o
        // botão do calendário são dois controles soltos.
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
              openAt(value || today);
            }
          }}
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          aria-label={label}
          className="num w-full bg-transparent text-sm text-textPrimary outline-none placeholder:text-textMuted focus-visible:ring-0"
        />

        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openAt(value || today))}
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
            onClick={() => setFocusDay((current) => shiftISOMonths(current, -1))}
            aria-label="Mês anterior"
            className="rounded-sm px-2 py-1 text-textSecondary transition-colors hover:bg-surfaceAlt hover:text-textPrimary"
          >
            ‹
          </button>
          <span className="num text-sm text-textPrimary" aria-live="polite">
            {formatMonthYear(monthKey)}
          </span>
          <button
            type="button"
            onClick={() => setFocusDay((current) => shiftISOMonths(current, 1))}
            aria-label="Próximo mês"
            className="rounded-sm px-2 py-1 text-textSecondary transition-colors hover:bg-surfaceAlt hover:text-textPrimary"
          >
            ›
          </button>
        </div>

        <div
          ref={gridRef}
          role="grid"
          aria-label={`${formatMonthYear(monthKey)}. Use as setas para navegar`}
          onKeyDown={onGridKeyDown}
          className="mt-3 grid grid-cols-7 gap-0.5"
        >
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
            const isFocus = cell.iso === focusDay;

            return (
              <button
                key={cell.iso}
                type="button"
                data-focus={isFocus ? 'true' : undefined}
                // Roving tabindex: só o dia em foco entra na ordem do Tab, para
                // que sair da grade não custe 31 tabuladas.
                tabIndex={isFocus ? 0 : -1}
                onClick={() => pick(cell.iso!)}
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
          onClick={() => pick(today)}
          className="mt-3 w-full rounded-md border border-border py-1.5 text-xs text-textSecondary transition-colors hover:border-borderHover hover:text-textPrimary"
        >
          Hoje
        </button>
      </Popover>
    </div>
  );
}
