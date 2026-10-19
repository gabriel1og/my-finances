import type { SettlementKind, TransactionType } from '@/types/database.types';

type FinancialEntry = { type: TransactionType; settlement: SettlementKind; amount: number };

/** Identifica crédito de estorno sem confundi-lo com renda. Ex.: income/card → true. */
export function isCardRefund(entry: Pick<FinancialEntry, 'type' | 'settlement'>): boolean {
  return entry.type === 'income' && entry.settlement === 'card';
}

/** Gasto líquido para categorias e indicadores. Ex.: estorno de 150 → -150. */
export function expenseEffect(entry: FinancialEntry): number {
  if (isCardRefund(entry)) return -Number(entry.amount);
  return entry.type === 'expense' ? Number(entry.amount) : 0;
}

/** Composição da fatura: compra soma, estorno abate. Ex.: income/card → -amount. */
export function statementEffect(entry: FinancialEntry): number {
  return entry.type === 'income' ? -Number(entry.amount) : Number(entry.amount);
}
