/**
 * Tradução de cada formato de arquivo para `ParsedRow`.
 *
 * Só o cabeçalho decide o formato: o flowly exporta uma coluna "Natureza" que
 * nenhum outro app tem, e o Fortuno tem "Transação" + "Status". Quem quiser
 * adicionar um formato novo escreve um `parseX` e registra em `FORMATS`.
 */

import { parseCsv } from '@/lib/csv';
import { PAYMENT_METHOD_LABEL } from '@/lib/constants';
import type { PaymentMethod } from '@/types/database.types';
import type { ImportFormat, ParsedRow, ParseResult, SkippedLine } from './types';

// ---------------------------------------------------------------------------
// Utilitários compartilhados
// ---------------------------------------------------------------------------

const MONTHS_PT: Record<string, string> = {
  jan: '01',
  fev: '02',
  mar: '03',
  abr: '04',
  mai: '05',
  jun: '06',
  jul: '07',
  ago: '08',
  set: '09',
  out: '10',
  nov: '11',
  dez: '12',
};

/**
 * Aceita `2026-03-31`, `31/03/2026`, `31/03/26` e o formato por extenso do
 * Fortuno, `31 de mar. de 2026`. Devolve null quando não entende — data
 * errada é motivo para pular a linha, nunca para chutar.
 */
export function parseImportDate(raw: string): string | null {
  const value = raw.trim().toLowerCase();

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const br = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${year}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  }

  const extenso = value.match(/^(\d{1,2})\s+(?:de\s+)?([a-zç]{3})[a-zç]*\.?\s+(?:de\s+)?(\d{4})$/);
  if (extenso) {
    const month = MONTHS_PT[extenso[2]];
    if (!month) return null;
    return `${extenso[3]}-${month}-${extenso[1].padStart(2, '0')}`;
  }

  return null;
}

/**
 * `1.234,56` e `51,52` (pt-BR) ou `1,234.56` e `51.52` (en). Quando só há um
 * dos dois sinais, ele é o decimal. Sinal de menos é descartado: o tipo da
 * linha diz se é entrada ou saída.
 */
export function parseImportAmount(raw: string): number | null {
  let text = raw.trim().replace(/[R$\s]/g, '');
  if (!text) return null;

  const hasComma = text.includes(',');
  const hasDot = text.includes('.');

  if (hasComma && hasDot) {
    text =
      text.lastIndexOf(',') > text.lastIndexOf('.')
        ? text.replace(/\./g, '').replace(',', '.')
        : text.replace(/,/g, '');
  } else if (hasComma) {
    text = text.replace(',', '.');
  }

  const value = Math.abs(Number(text));
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

function clean(value: string | undefined): string {
  return (value ?? '').trim();
}

function emptyToNull(value: string | undefined): string | null {
  const text = clean(value);
  return text === '' || text === '-' ? null : text;
}

function normalizeHeader(cells: string[]): string[] {
  return cells.map((cell) => clean(cell).toLowerCase());
}

// ---------------------------------------------------------------------------
// flowly — o próprio export
// ---------------------------------------------------------------------------

const METHOD_BY_LABEL: Record<string, PaymentMethod> = Object.fromEntries(
  (Object.entries(PAYMENT_METHOD_LABEL) as [PaymentMethod, string][]).map(([key, label]) => [
    label.toLowerCase(),
    key,
  ]),
);

const FLOWLY_COLUMNS = {
  date: 'data',
  description: 'descrição',
  type: 'tipo',
  amount: 'valor',
  category: 'categoria',
  origin: 'conta/cartão',
  method: 'forma',
  installment: 'parcela',
  tags: 'tags',
  nature: 'natureza',
  paidCard: 'fatura de',
  paidMonth: 'mês da fatura',
  notes: 'observações',
} as const;

function parseFlowly(records: string[][]): Omit<ParseResult, 'format'> {
  const header = normalizeHeader(records[0]);
  const col = (name: string) => header.indexOf(name);
  const idx = Object.fromEntries(
    Object.entries(FLOWLY_COLUMNS).map(([key, label]) => [key, col(label)]),
  ) as Record<keyof typeof FLOWLY_COLUMNS, number>;

  const rows: ParsedRow[] = [];
  const skipped: SkippedLine[] = [];

  records.slice(1).forEach((cells, offset) => {
    const line = offset + 2;
    const at = (key: keyof typeof FLOWLY_COLUMNS) => (idx[key] >= 0 ? cells[idx[key]] : undefined);

    const date = parseImportDate(clean(at('date')));
    if (!date)
      return skipped.push({ line, reason: `Data não reconhecida: "${clean(at('date'))}"` });

    const amount = parseImportAmount(clean(at('amount')));
    if (amount === null) return skipped.push({ line, reason: 'Valor inválido ou zero' });

    const typeLabel = clean(at('type')).toLowerCase();
    const type = typeLabel === 'receita' ? 'income' : typeLabel === 'despesa' ? 'expense' : null;
    if (!type)
      return skipped.push({ line, reason: `Tipo não reconhecido: "${clean(at('type'))}"` });

    const natureLabel = clean(at('nature')).toLowerCase();
    const method = METHOD_BY_LABEL[clean(at('method')).toLowerCase()] ?? null;
    const warnings: string[] = [];

    let nature: ParsedRow['nature'] = 'transaction';
    let paidCard: string | null = null;
    let paidMonth: string | null = null;
    if (natureLabel === 'transferência') {
      nature = type === 'expense' ? 'transfer_out' : 'transfer_in';
    } else if (natureLabel === 'pagamento de fatura') {
      paidCard = emptyToNull(at('paidCard'));
      const rawMonth = clean(at('paidMonth'));
      paidMonth = /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : null;
      if (paidCard) nature = 'card_payment';
      else warnings.push('Pagamento de fatura sem cartão identificado; entra como despesa comum.');
    }

    const settlement = method === 'credit' ? 'card' : 'account';
    if (settlement === 'card' && type === 'income') {
      return skipped.push({ line, reason: 'Receita não entra em fatura de cartão' });
    }

    const installment = clean(at('installment'));
    if (installment) warnings.push(`Parcela ${installment}: entra como lançamento avulso.`);

    rows.push({
      line,
      date,
      description: clean(at('description')) || 'Sem descrição',
      amount,
      type,
      nature,
      settlement,
      origin: emptyToNull(at('origin')),
      category: nature === 'transaction' ? emptyToNull(at('category')) : null,
      paidCard,
      paidMonth,
      method,
      tags: clean(at('tags'))
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      notes: emptyToNull(at('notes')),
      warnings,
    });
  });

  return { rows, skipped };
}

// ---------------------------------------------------------------------------
// Fortuno
// ---------------------------------------------------------------------------

/**
 * Cabeçalho: `Data, Transação, Descrição, Valor, Status, Categoria,
 * Conta/Cartão, Observações` — separado por vírgula, com espaço depois dela.
 *
 * Duas armadilhas do arquivo real:
 * - A descrição **não vem entre aspas** mesmo quando tem vírgula ("Água,
 *   Bacon e Suporte p/ filtro"), então a linha ganha células a mais. As cinco
 *   últimas colunas são fixas; tudo entre "Transação" e elas é descrição.
 * - O arquivo termina com um rodapé de totais ("Total", "Despesas,665.46"),
 *   que tem menos células e é pulado.
 *
 * Transferência chega como duas linhas — "(saída)" na conta de origem e
 * "(entrada)" na de destino — sem categoria e com status "-". O casamento
 * das pontas é feito no plano, não aqui.
 */
const FORTUNO_TAIL = 5; // Valor, Status, Categoria, Conta/Cartão, Observações

function parseFortuno(records: string[][]): Omit<ParseResult, 'format'> {
  const rows: ParsedRow[] = [];
  const skipped: SkippedLine[] = [];

  records.slice(1).forEach((cells, offset) => {
    const line = offset + 2;

    if (cells.length < 2 + FORTUNO_TAIL) {
      const label = clean(cells[0]).toLowerCase();
      const isFooter = ['total', 'despesas', 'despesas no crédito', 'receitas'].includes(label);
      return skipped.push({ line, reason: isFooter ? 'Rodapé de totais' : 'Linha incompleta' });
    }

    const [rawDate, rawKind] = cells;
    const tail = cells.slice(cells.length - FORTUNO_TAIL);
    const description = cells
      .slice(2, cells.length - FORTUNO_TAIL)
      .map((part) => part.trim())
      .join(', ');
    const [rawAmount, rawStatus, rawCategory, rawOrigin, rawNotes] = tail;

    const date = parseImportDate(clean(rawDate));
    if (!date) return skipped.push({ line, reason: `Data não reconhecida: "${clean(rawDate)}"` });

    const amount = parseImportAmount(clean(rawAmount));
    if (amount === null) return skipped.push({ line, reason: 'Valor inválido ou zero' });

    const kind = clean(rawKind).toLowerCase();
    const warnings: string[] = [];
    let type: ParsedRow['type'];
    let nature: ParsedRow['nature'] = 'transaction';
    let settlement: ParsedRow['settlement'] = 'account';

    if (kind === 'receita') {
      type = 'income';
    } else if (kind === 'despesa') {
      type = 'expense';
    } else if (kind === 'despesas no crédito' || kind === 'despesa no crédito') {
      type = 'expense';
      settlement = 'card';
    } else if (kind === 'transferência') {
      const label = description.toLowerCase();
      if (label.includes('saída') || label.includes('saida')) {
        type = 'expense';
        nature = 'transfer_out';
      } else if (label.includes('entrada')) {
        type = 'income';
        nature = 'transfer_in';
      } else {
        return skipped.push({ line, reason: 'Transferência sem indicação de saída/entrada' });
      }
    } else {
      return skipped.push({
        line,
        reason: `Tipo de transação não reconhecido: "${clean(rawKind)}"`,
      });
    }

    const status = clean(rawStatus).toLowerCase();
    if (nature === 'transaction' && status && !['pago', 'recebido', '-'].includes(status)) {
      warnings.push(`Status "${clean(rawStatus)}" no Fortuno; o flowly não tem pendência.`);
    }

    rows.push({
      line,
      date,
      description: description || 'Sem descrição',
      amount,
      type,
      nature,
      settlement,
      origin: emptyToNull(rawOrigin),
      category: nature === 'transaction' ? emptyToNull(rawCategory) : null,
      paidCard: null,
      paidMonth: null,
      method: settlement === 'card' ? 'credit' : null,
      tags: [],
      notes: emptyToNull(rawNotes),
      warnings,
    });
  });

  return { rows, skipped };
}

// ---------------------------------------------------------------------------
// Detecção e entrada única
// ---------------------------------------------------------------------------

const FORMATS: Record<
  ImportFormat,
  {
    matches: (header: string[]) => boolean;
    parse: (records: string[][]) => Omit<ParseResult, 'format'>;
  }
> = {
  flowly: {
    matches: (header) => header.includes('natureza') && header.includes('descrição'),
    parse: parseFlowly,
  },
  fortuno: {
    matches: (header) =>
      header.includes('transação') && header.includes('status') && header.includes('conta/cartão'),
    parse: parseFortuno,
  },
};

export const FORMAT_LABEL: Record<ImportFormat, string> = {
  flowly: 'Exportação do flowly',
  fortuno: 'Fortuno',
};

export function detectFormat(headerCells: string[]): ImportFormat | null {
  const header = normalizeHeader(headerCells);
  for (const [format, spec] of Object.entries(FORMATS) as [
    ImportFormat,
    (typeof FORMATS)['flowly'],
  ][]) {
    if (spec.matches(header)) return format;
  }
  return null;
}

export type ParseFileResult = { ok: true; result: ParseResult } | { ok: false; error: string };

export function parseImportFile(text: string): ParseFileResult {
  const records = parseCsv(text);
  if (records.length < 2)
    return { ok: false, error: 'O arquivo não tem linhas além do cabeçalho.' };

  const format = detectFormat(records[0]);
  if (!format) {
    return {
      ok: false,
      error:
        'Cabeçalho não reconhecido. Aceitamos a exportação do flowly e o CSV do Fortuno (Data, Transação, Descrição, Valor, Status, Categoria, Conta/Cartão, Observações).',
    };
  }

  const parsed = FORMATS[format].parse(records);
  return { ok: true, result: { format, ...parsed } };
}
