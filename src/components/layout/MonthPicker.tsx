'use client';

import type { Route } from 'next';
import { useRef, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { MonthGrid } from '@/components/ui/MonthGrid';
import { Popover } from '@/components/ui/Popover';
import { currentMonth } from '@/lib/format';

/**
 * Navegação de mês da sidebar: setas para o mês vizinho e um popover para
 * saltos longos. Usa a mesma `MonthGrid` dos campos de formulário — o seletor
 * de mês é um só no projeto, em dois enquadramentos.
 */
export function MonthPicker({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const month = params.get('month') ?? currentMonth();
  const selectedYear = Number(month.slice(0, 4));
  const selectedMonth = Number(month.slice(5, 7));

  const today = currentMonth();
  const currentYear = Number(today.slice(0, 4));
  const currentMonthNumber = Number(today.slice(5, 7));

  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(selectedYear);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // O painel se ancora na cápsula inteira, não no rótulo: centrado no rótulo
  // ele nascia deslocado para a esquerda, porque as setas ficam de fora.
  const containerRef = useRef<HTMLDivElement>(null);

  function goTo(next: string) {
    const search = new URLSearchParams(params.toString());
    search.set('month', next);
    router.push(`${pathname}?${search.toString()}` as Route);
  }

  function shift(delta: number) {
    const date = new Date(`${month.slice(0, 7)}-01T12:00:00`);
    date.setMonth(date.getMonth() + delta);
    goTo(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`);
  }

  function toggle() {
    // Abrir sempre no ano em uso, não no que sobrou de uma consulta anterior.
    setYear(selectedYear);
    setOpen((value) => !value);
  }

  // MM/AA — o nome por extenso não cabe ao lado do logo, nem nos 64px da
  // sidebar recolhida.
  const label = `${month.slice(5, 7)}/${month.slice(2, 4)}`;
  const fullLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    new Date(`${month.slice(0, 7)}-01T12:00:00`),
  );

  return (
    // Cápsula: setas e rótulo lidos como um controle só, não como três
    // elementos soltos ao lado do logo.
    <div
      ref={containerRef}
      className={`bg-green relative flex items-center border border-border bg-surfaceAlt ${
        compact ? 'rounded-full px-1 py-1' : 'rounded-md px-2 py-2'
      }`}
    >
      <button
        onClick={() => shift(-1)}
        className={`rounded-full leading-none text-textSecondary transition-colors hover:bg-surface hover:text-textPrimary ${
          compact ? 'px-0.5 pb-0.5' : 'px-1 pb-1'
        }`}
        aria-label="Mês anterior"
      >
        ‹
      </button>

      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Mês selecionado: ${fullLabel}. Escolher outro mês`}
        className={`num rounded-full px-1 text-center text-textPrimary transition-colors hover:bg-surface ${
          open ? 'bg-surface' : ''
        } ${compact ? 'min-w-[34px] text-3xs' : 'min-w-[46px] text-xs'}`}
      >
        {label}
      </button>

      <button
        onClick={() => shift(1)}
        className={`rounded-full leading-none text-textSecondary transition-colors hover:bg-surface hover:text-textPrimary ${
          compact ? 'px-0.5 pb-0.5' : 'px-1 pb-1'
        }`}
        aria-label="Próximo mês"
      >
        ›
      </button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={containerRef}
        label="Escolher mês"
        align="right"
      >
        <MonthGrid
          year={year}
          onYearChange={setYear}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          currentYear={currentYear}
          currentMonth={currentMonthNumber}
          onSelect={(monthNumber) => {
            goTo(`${year}-${String(monthNumber).padStart(2, '0')}-01`);
            setOpen(false);
          }}
        />

        <button
          type="button"
          onClick={() => {
            setYear(currentYear);
            goTo(today);
            setOpen(false);
          }}
          className="mt-3 w-full rounded-md border border-border py-1.5 text-xs text-textSecondary transition-colors hover:border-borderHover hover:text-textPrimary"
        >
          Mês atual
        </button>
      </Popover>
    </div>
  );
}
