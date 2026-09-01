import type { TransactionWithCategory } from '@/types/database.types';

/**
 * Uma transferência são duas linhas no banco (saída numa conta, entrada em
 * outra). Na listagem isso confunde: a mesma operação aparece duplicada, com
 * o mesmo texto. Aqui as duas pontas viram uma entrada só.
 */
export type Entry =
  | { kind: 'single'; key: string; tx: TransactionWithCategory }
  | {
      kind: 'transfer';
      key: string;
      group: string;
      description: string;
      amount: number;
      date: string;
      from: string | null;
      to: string | null;
      fromId: string | null;
      toId: string | null;
      /** A ponta de despesa, usada como referência para editar/excluir. */
      tx: TransactionWithCategory;
    };

export function groupTransfers(transactions: TransactionWithCategory[]): Entry[] {
  const entries: Entry[] = [];
  const seen = new Set<string>();

  for (const tx of transactions) {
    if (!tx.is_transfer || !tx.transfer_group) {
      entries.push({ kind: 'single', key: tx.id, tx });
      continue;
    }

    if (seen.has(tx.transfer_group)) continue;
    seen.add(tx.transfer_group);

    const pair = transactions.filter((item) => item.transfer_group === tx.transfer_group);
    const out = pair.find((item) => item.type === 'expense');
    const into = pair.find((item) => item.type === 'income');

    entries.push({
      kind: 'transfer',
      key: tx.transfer_group,
      group: tx.transfer_group,
      description: tx.description,
      amount: Number(tx.amount),
      date: tx.date,
      from: out?.account?.name ?? null,
      to: into?.account?.name ?? null,
      fromId: out?.account_id ?? null,
      toId: into?.account_id ?? null,
      // Se a outra ponta estiver fora do período carregado, a que temos serve.
      tx: out ?? tx,
    });
  }

  return entries;
}
