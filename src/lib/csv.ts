/**
 * Geração e leitura de CSV. Escrito à mão porque a regra toda cabe em poucas
 * funções — e porque a única parte delicada (escape) precisa de teste, não de
 * dependência.
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

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

/**
 * Descobre o separador olhando só a primeira linha, fora de aspas. O flowly
 * exporta com `;`; o Fortuno (e o Excel em inglês) usa `,`. Empate favorece
 * `;`, que é o nosso.
 */
export function detectSeparator(firstLine: string): ';' | ',' {
  let semicolons = 0;
  let commas = 0;
  let quoted = false;
  for (const char of firstLine) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && char === ';') semicolons += 1;
    else if (!quoted && char === ',') commas += 1;
  }
  return commas > semicolons ? ',' : ';';
}

/**
 * Parser mínimo de CSV (RFC 4180): campos entre aspas podem conter o
 * separador, quebras de linha e aspas dobradas. Remove o BOM e ignora linhas
 * vazias. Devolve as células cruas — quem interpreta é o formato.
 */
export function parseCsv(text: string, separator?: ';' | ','): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const firstBreak = source.search(/\r?\n/);
  const sep =
    separator ?? detectSeparator(firstBreak === -1 ? source : source.slice(0, firstBreak));

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === sep) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== '')) rows.push(row);

  return rows;
}
