/**
 * Helpers de calendário para os seletores próprios. Puros e testáveis: erro de
 * grade de dias é o tipo de bug que só aparece em fevereiro ou na virada de
 * ano, quando ninguém está olhando.
 *
 * Tudo trabalha com string ISO (`YYYY-MM-DD`) e evita `new Date(iso)` sem hora,
 * que o JS interpreta como UTC e pode voltar o dia anterior em fuso negativo.
 */

export const MONTH_LABELS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

/** Domingo primeiro, como o calendário brasileiro. */
export const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export function todayISO(): string {
  const now = new Date();
  return toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export type DayCell = {
  /** ISO do dia, ou null nos espaços antes do dia 1 e depois do último. */
  iso: string | null;
  day: number | null;
};

/**
 * Grade de 6 semanas (42 células) do mês. Altura fixa evita o popover pular de
 * tamanho ao trocar de mês.
 */
export function monthGrid(year: number, month: number): DayCell[] {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const total = lastDayOfMonth(year, month);

  return Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    if (day < 1 || day > total) return { iso: null, day: null };
    return { iso: toISO(year, month, day), day };
  });
}

/** Soma meses a um `YYYY-MM`, sem passar por Date com fuso. */
export function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.slice(0, 7).split('-').map(Number);
  const total = (year * 12 + (month - 1)) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export function formatMonthYear(monthKey: string): string {
  const [year, month] = monthKey.slice(0, 7).split('-').map(Number);
  return `${MONTH_LABELS[month - 1]} ${year}`;
}
