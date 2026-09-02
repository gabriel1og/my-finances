/**
 * Geração de CSV. Escrito à mão porque a regra toda cabe em duas funções — e
 * porque a única parte delicada (escape) precisa de teste, não de dependência.
 */

/**
 * Aspas duplas dentro do campo viram duas aspas; campos com separador, aspas
 * ou quebra de linha vão entre aspas.
 *
 * O separador padrão é `;`: o Excel em português usa vírgula como decimal, e
 * com `,` de separador ele joga tudo numa coluna só.
 */
export function escapeCsvValue(value: unknown, separator = ';'): string {
  if (value === null || value === undefined) return '';

  const text = String(value);
  const needsQuotes =
    text.includes(separator) || text.includes('"') || text.includes('\n') || text.includes('\r');

  const escaped = text.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

export function toCsv(
  rows: Array<Record<string, unknown>>,
  columns: Array<{ key: string; label: string }>,
  separator = ';',
): string {
  const header = columns.map((column) => escapeCsvValue(column.label, separator)).join(separator);

  const body = rows.map((row) =>
    columns.map((column) => escapeCsvValue(row[column.key], separator)).join(separator),
  );

  // CRLF é o que Excel e Google Sheets esperam.
  return [header, ...body].join('\r\n');
}

/** Valor numérico com vírgula decimal, para abrir certo em pt-BR. */
export function csvNumber(value: number): string {
  return value.toFixed(2).replace('.', ',');
}
