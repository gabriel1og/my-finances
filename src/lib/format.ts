// Formatadores — todo valor numerico renderiza com a classe `.num` (algarismos
// tabulares), para que colunas de números alinhem. Ver globals.css.

export function formatCurrency(value: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  );
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Formata um instante na data civil de São Paulo, sem risco de exibir D-1. */
export function formatTimestampDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso));
}

/** Data e hora civis de São Paulo para eventos registrados como instante UTC. */
export function formatTimestampDateTime(iso: string): string {
  const time = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso));
  return `${formatTimestampDate(iso)} às ${time}`;
}

export function formatMonthLabel(iso: string): string {
  const date = new Date(`${iso.slice(0, 7)}-01T12:00:00`);
  return new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', '');
}

/**
 * Rótulo curto de eixo e cabeçalho: "set" ou "set/26".
 *
 * O ano entra quando a janela cruza a virada — com 12 ou 24 meses na tela,
 * "jan" sem ano não diz de qual janeiro se trata.
 */
export function formatMonthShort(iso: string, withYear = false): string {
  const label = formatMonthLabel(iso);
  return withYear ? `${label}/${iso.slice(2, 4)}` : label;
}

/** true quando a lista de meses passa por mais de um ano. */
export function spansYears(months: string[]): boolean {
  return new Set(months.map((month) => month.slice(0, 4))).size > 1;
}

/** "setembro de 2026" — usado onde o mês é o assunto da tela, não um eixo. */
export function formatMonthLong(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    new Date(`${iso.slice(0, 7)}-01T12:00:00`),
  );
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1).replace('.', ',')}%`;
}

export function monthRange(month: string): { start: string; end: string } {
  const start = `${month.slice(0, 7)}-01`;
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(
    endDate.getDate(),
  ).padStart(2, '0')}`;
  return { start, end };
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}
