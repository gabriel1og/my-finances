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
  const total = year * 12 + (month - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export function formatMonthYear(monthKey: string): string {
  const [year, month] = monthKey.slice(0, 7).split('-').map(Number);
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

/** Soma dias a um ISO. Passa por UTC para não escorregar no horário de verão. */
export function shiftDays(iso: string, delta: number): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + delta);
  return toISO(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate());
}

/**
 * Soma meses a um ISO, grudando no último dia quando o mês de destino é mais
 * curto: 31/01 + 1 mês vira 28/02, não 03/03.
 */
export function shiftISOMonths(iso: string, delta: number): string {
  const day = Number(iso.slice(8, 10));
  const [year, month] = shiftMonthKey(iso.slice(0, 7), delta).split('-').map(Number);
  return toISO(year, month, Math.min(day, lastDayOfMonth(year, month)));
}

/**
 * Lê uma data digitada. Aceita o que uma pessoa realmente digita — `5/8`,
 * `05/08/26`, `05082026`, `5` — porque para lançamento retroativo digitar é
 * mais rápido que navegar mês a mês. Devolve null quando não dá para entender,
 * e aí o campo volta ao valor anterior em vez de gravar lixo.
 */
export function parseDateInput(input: string, reference: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (!digits) return null;

  const refYear = Number(reference.slice(0, 4));
  const refMonth = Number(reference.slice(5, 7));

  let day: number;
  let month = refMonth;
  let year = refYear;

  if (digits.length <= 2) {
    day = Number(digits);
  } else if (digits.length <= 4) {
    day = Number(digits.slice(0, 2));
    month = Number(digits.slice(2));
  } else if (digits.length === 6) {
    day = Number(digits.slice(0, 2));
    month = Number(digits.slice(2, 4));
    year = 2000 + Number(digits.slice(4));
  } else if (digits.length === 8) {
    day = Number(digits.slice(0, 2));
    month = Number(digits.slice(2, 4));
    year = Number(digits.slice(4));
  } else {
    return null;
  }

  if (month < 1 || month > 12) return null;
  if (year < 1900 || year > 2200) return null;
  if (day < 1 || day > lastDayOfMonth(year, month)) return null;

  return toISO(year, month, day);
}

/** O mesmo para mês: `8`, `08/26`, `2026-08`. */
export function parseMonthInput(input: string, reference: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (!digits) return null;

  let month: number;
  let year = Number(reference.slice(0, 4));

  if (digits.length <= 2) {
    month = Number(digits);
  } else if (digits.length === 4) {
    month = Number(digits.slice(0, 2));
    year = 2000 + Number(digits.slice(2));
  } else if (digits.length === 6) {
    month = Number(digits.slice(0, 2));
    year = Number(digits.slice(2));
  } else {
    return null;
  }

  if (month < 1 || month > 12) return null;
  if (year < 1900 || year > 2200) return null;

  return `${year}-${String(month).padStart(2, '0')}`;
}
