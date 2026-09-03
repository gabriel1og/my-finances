/**
 * Do arquivo traduzido ao plano de importação: casa as pontas das
 * transferências, lista o que o arquivo cita (contas, cartões, categorias,
 * tags) para o usuário mapear, e resume os números para a tela de revisão.
 *
 * Tudo aqui é puro — roda no navegador logo depois do parse, e é testado sem
 * banco.
 */

import type {
  ImportCategory,
  ImportOrigin,
  ImportPlan,
  OriginKind,
  ParsedRow,
  PlanItem,
  PlannedTransfer,
} from './types';

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function originKey(kind: OriginKind, name: string): string {
  return `${kind}:${normalizeName(name)}`;
}

export function categoryKey(name: string): string {
  return normalizeName(name);
}

/**
 * Uma saída e uma entrada na mesma data e com o mesmo valor viram uma
 * transferência. Casamento é 1:1 na ordem do arquivo: duas transferências
 * iguais no mesmo dia continuam sendo duas. Ponta sem par vira lançamento
 * comum, com aviso — é a única forma de o valor não sumir.
 */
export function pairTransfers(rows: ParsedRow[]): { items: PlanItem[]; orphans: number } {
  const items: PlanItem[] = [];
  const pendingIn = new Map<string, ParsedRow[]>();
  const matchKey = (row: ParsedRow) => `${row.date}|${row.amount.toFixed(2)}`;

  for (const row of rows) {
    if (row.nature === 'transfer_in') {
      const list = pendingIn.get(matchKey(row)) ?? [];
      list.push(row);
      pendingIn.set(matchKey(row), list);
    }
  }

  const consumed = new Set<number>();
  let orphans = 0;

  const asOrphan = (row: ParsedRow): PlanItem => {
    orphans += 1;
    return {
      id: `t-${row.line}`,
      kind: 'transaction',
      row: {
        ...row,
        nature: 'transaction',
        warnings: [
          ...row.warnings,
          'Transferência sem a outra ponta; entra como lançamento comum.',
        ],
      },
    };
  };

  for (const row of rows) {
    if (consumed.has(row.line)) continue;

    if (row.nature === 'transfer_out') {
      const candidates = pendingIn.get(matchKey(row)) ?? [];
      const partner = candidates.find(
        (candidate) => !consumed.has(candidate.line) && candidate.origin !== row.origin,
      );
      if (!partner || !row.origin || !partner.origin) {
        items.push(asOrphan(row));
        continue;
      }
      consumed.add(partner.line);
      const transfer: PlannedTransfer = {
        date: row.date,
        amount: row.amount,
        description: '',
        from: row.origin,
        to: partner.origin,
        lines: [row.line, partner.line],
      };
      items.push({ id: `x-${row.line}-${partner.line}`, kind: 'transfer', transfer });
      continue;
    }

    if (row.nature === 'transfer_in') {
      items.push(asOrphan(row));
      continue;
    }

    items.push({ id: `t-${row.line}`, kind: 'transaction', row });
  }

  return { items, orphans };
}

export function collectOrigins(items: PlanItem[]): ImportOrigin[] {
  const map = new Map<string, ImportOrigin>();
  const add = (kind: OriginKind, name: string | null) => {
    if (!name) return;
    const key = originKey(kind, name);
    const existing = map.get(key);
    if (existing) existing.uses += 1;
    else map.set(key, { key, name: name.trim(), kind, uses: 1 });
  };

  for (const item of items) {
    if (item.kind === 'transfer') {
      add('account', item.transfer.from);
      add('account', item.transfer.to);
      continue;
    }
    add(item.row.settlement === 'card' ? 'card' : 'account', item.row.origin);
    if (item.row.nature === 'card_payment') add('card', item.row.paidCard);
  }

  return [...map.values()].sort((a, b) => a.kind.localeCompare(b.kind) || b.uses - a.uses);
}

export function collectCategories(items: PlanItem[]): ImportCategory[] {
  const map = new Map<string, ImportCategory & { income: number; expense: number }>();

  for (const item of items) {
    if (item.kind !== 'transaction' || !item.row.category) continue;
    const key = categoryKey(item.row.category);
    const entry = map.get(key) ?? {
      key,
      name: item.row.category.trim(),
      kind: item.row.type,
      uses: 0,
      mixed: false,
      income: 0,
      expense: 0,
    };
    entry.uses += 1;
    entry[item.row.type] += 1;
    map.set(key, entry);
  }

  return [...map.values()]
    .map(({ income, expense, ...entry }) => ({
      ...entry,
      kind: (income > expense ? 'income' : 'expense') as ImportCategory['kind'],
      mixed: income > 0 && expense > 0,
    }))
    .sort((a, b) => b.uses - a.uses);
}

export function collectTags(items: PlanItem[]): string[] {
  const set = new Map<string, string>();
  for (const item of items) {
    if (item.kind !== 'transaction') continue;
    for (const tag of item.row.tags) set.set(normalizeName(tag), tag.trim());
  }
  return [...set.values()].sort((a, b) => a.localeCompare(b));
}

export function buildPlan(rows: ParsedRow[]): ImportPlan {
  const { items, orphans } = pairTransfers(rows);
  return {
    items,
    origins: collectOrigins(items),
    categories: collectCategories(items),
    tags: collectTags(items),
    orphanTransfers: orphans,
  };
}

export type PlanSummary = {
  transactions: number;
  transfers: number;
  income: number;
  expense: number;
  warnings: number;
};

/** Totais só dos itens selecionados: é o que vai entrar de fato. */
export function summarize(items: PlanItem[]): PlanSummary {
  const summary: PlanSummary = {
    transactions: 0,
    transfers: 0,
    income: 0,
    expense: 0,
    warnings: 0,
  };
  for (const item of items) {
    if (item.kind === 'transfer') {
      summary.transfers += 1;
      continue;
    }
    summary.transactions += 1;
    if (item.row.warnings.length > 0) summary.warnings += 1;
    if (item.row.nature === 'card_payment') continue; // já contou quando a compra foi feita
    if (item.row.type === 'income') summary.income += item.row.amount;
    else summary.expense += item.row.amount;
  }
  summary.income = Math.round(summary.income * 100) / 100;
  summary.expense = Math.round(summary.expense * 100) / 100;
  return summary;
}

/** Chave de duplicata: mesma data, valor e descrição (sem caixa). */
export function duplicateKey(date: string, amount: number, description: string): string {
  return `${date}|${amount.toFixed(2)}|${normalizeName(description)}`;
}

export function itemDuplicateKeys(item: PlanItem): string[] {
  if (item.kind === 'transaction') {
    return [duplicateKey(item.row.date, item.row.amount, item.row.description)];
  }
  // Transferência: a descrição gravada é gerada pelo servidor, então a
  // checagem olha só data + valor entre as transferências existentes.
  return [`${item.transfer.date}|${item.transfer.amount.toFixed(2)}|transfer`];
}
